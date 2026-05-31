import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  GameState,
  VerboseMove,
  MatchmakingEntry,
  CreateGameDto,
  JoinGameDto,
  MakeMoveDto,
  BOT_USER_ID,
} from './dto/game.dto';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema/schema';
import { games } from '../drizzle/schema/game.schema';
import { eq, or, desc } from 'drizzle-orm';

const TIME_CONTROLS: Record<string, { baseMs: number; incrementMs: number }> = {
  bullet_1: { baseMs: 60_000, incrementMs: 0 },
  bullet_1_1: { baseMs: 60_000, incrementMs: 1_000 },
  blitz_3: { baseMs: 3 * 60_000, incrementMs: 0 },
  blitz_3_2: { baseMs: 3 * 60_000, incrementMs: 2_000 },
  blitz_5: { baseMs: 5 * 60_000, incrementMs: 0 },
  blitz_5_3: { baseMs: 5 * 60_000, incrementMs: 3_000 },
  rapid_10: { baseMs: 10 * 60_000, incrementMs: 0 },
  rapid_15_10: { baseMs: 15 * 60_000, incrementMs: 10_000 },
};

// ── Lua script: atomically dequeue an opponent OR enqueue self ──────────────
// KEYS[1] = queue key (e.g. chess:queue:blitz_5)
// ARGV[1] = current userId
// ARGV[2] = JSON string of MatchmakingEntry to push if no opponent found
//
// Returns:
//   "MATCHED:<raw JSON of opponent>"  — found an opponent, current user NOT added to queue
//   "QUEUED"                          — no opponent yet, current user added to queue
//   "ALREADY_QUEUED"                  — user was already in queue (socketId updated)
const JOIN_QUEUE_LUA = `
local key    = KEYS[1]
local uid    = ARGV[1]
local entry  = ARGV[2]

-- Step 1: scan the list for an existing entry by this user
local len = redis.call('LLEN', key)
for i = 0, len - 1 do
  local raw = redis.call('LINDEX', key, i)
  local decoded = cjson.decode(raw)
  if decoded.userId == uid then
    -- Already in queue — remove old entry, re-add updated one (new socketId), stop scan
    redis.call('LREM', key, 1, raw)
    redis.call('RPUSH', key, entry)
    redis.call('EXPIRE', key, 300)
    return 'ALREADY_QUEUED'
  end
end

-- Step 2: not in queue — try to pop an opponent from the front
local head = redis.call('LPOP', key)
if head then
  local opponent = cjson.decode(head)
  if opponent.userId ~= uid then
    -- Valid match found: return opponent JSON, do NOT push current user
    return 'MATCHED:' .. head
  end
  -- Edge case: somehow same user at front — put them back
  redis.call('LPUSH', key, head)
end

-- Step 3: no opponent — join the queue
redis.call('RPUSH', key, entry)
redis.call('EXPIRE', key, 300)
return 'QUEUED'
`;

// ── Lua script: atomically remove a user from the queue ──────────────────────
// KEYS[1] = queue key
// ARGV[1] = userId to remove
// Returns number of entries removed (0 or 1)
const LEAVE_QUEUE_LUA = `
local key = KEYS[1]
local uid = ARGV[1]
local len = redis.call('LLEN', key)
for i = 0, len - 1 do
  local raw = redis.call('LINDEX', key, i)
  local decoded = cjson.decode(raw)
  if decoded.userId == uid then
    redis.call('LREM', key, 1, raw)
    return 1
  end
end
return 0
`;

@Injectable()
export class GameService implements OnModuleInit {
  private readonly logger = new Logger(GameService.name);

  // Cached SHA1 digests for EVALSHA (faster than EVAL after first load)
  private joinQueueSha: string;
  private leaveQueueSha: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  /** Pre-load Lua scripts into Redis on startup so we can use EVALSHA */
  async onModuleInit() {
    this.joinQueueSha  = await this.redisClient.script('LOAD', JOIN_QUEUE_LUA)  as string;
    this.leaveQueueSha = await this.redisClient.script('LOAD', LEAVE_QUEUE_LUA) as string;
    this.logger.log('✅ Matchmaking Lua scripts loaded into Redis');
  }

  // ──────────────────────────────────────────────────────────────────────
  // Redis helpers
  // ──────────────────────────────────────────────────────────────────────

  private gameKey(gameId: string) {
    return `chess:game:${gameId}`;
  }

  private matchmakingKey(timeControl: string) {
    return `chess:queue:${timeControl}`;
  }

  private userGameKey(userId: string) {
    return `chess:user:${userId}:game`;
  }

  async getGame(gameId: string): Promise<GameState | null> {
    const data = await this.redisClient.get(this.gameKey(gameId));
    if (!data) return null;
    return JSON.parse(data) as GameState;
  }

  async saveGame(game: GameState, ttlSeconds = 3600) {
    await this.redisClient.setex(
      this.gameKey(game.id),
      ttlSeconds,
      JSON.stringify(game),
    );
  }

  async deleteGame(gameId: string) {
    await this.redisClient.del(this.gameKey(gameId));
  }

  async getUserCurrentGame(userId: string): Promise<string | null> {
    return this.redisClient.get(this.userGameKey(userId));
  }

  async setUserCurrentGame(userId: string, gameId: string) {
    await this.redisClient.setex(this.userGameKey(userId), 3600, gameId);
  }

  async clearUserCurrentGame(userId: string) {
    await this.redisClient.del(this.userGameKey(userId));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Matchmaking queue
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Atomic matchmaking via Lua script.
   *
   * Replaces the old multi-step (lrange → lrem → lpop → rpush) sequence
   * that suffered from race conditions when two players joined simultaneously.
   *
   * The Lua script runs entirely inside the Redis server as a single atomic
   * operation — no other command can interleave between steps.
   *
   * Returns the matched opponent's MatchmakingEntry, or null if queued.
   */
  async joinQueue(entry: MatchmakingEntry): Promise<MatchmakingEntry | null> {
    const key = this.matchmakingKey(entry.timeControl);
    const entryJson = JSON.stringify(entry);

    let result: string;
    try {
      // Use EVALSHA (cached script) for speed; fall back to EVAL if script was evicted
      result = await this.redisClient.evalsha(
        this.joinQueueSha,
        1,          // numkeys
        key,        // KEYS[1]
        entry.userId, // ARGV[1]
        entryJson,  // ARGV[2]
      ) as string;
    } catch (err: unknown) {
      const isNoScript = err instanceof Error && err.message.startsWith('NOSCRIPT');
      if (!isNoScript) throw err;
      // Script was flushed from Redis — reload and retry
      this.joinQueueSha = await this.redisClient.script('LOAD', JOIN_QUEUE_LUA) as string;
      result = await this.redisClient.evalsha(
        this.joinQueueSha,
        1,
        key,
        entry.userId,
        entryJson,
      ) as string;
    }

    if (result.startsWith('MATCHED:')) {
      const opponentJson = result.slice('MATCHED:'.length);
      this.logger.log(`⚡ Lua matchmaking: ${entry.userId} matched an opponent`);
      return JSON.parse(opponentJson) as MatchmakingEntry;
    }

    // 'QUEUED' or 'ALREADY_QUEUED'
    this.logger.log(`🕐 Lua matchmaking: ${entry.userId} → ${result} (${entry.timeControl})`);
    return null;
  }

  /**
   * Atomic queue removal via Lua script.
   * Ensures the player is removed in one step without any read-modify-write gap.
   */
  async leaveQueue(userId: string, timeControl: string) {
    const key = this.matchmakingKey(timeControl);
    try {
      await this.redisClient.evalsha(
        this.leaveQueueSha,
        1,
        key,
        userId,
      );
    } catch (err: unknown) {
      const isNoScript = err instanceof Error && err.message.startsWith('NOSCRIPT');
      if (!isNoScript) throw err;
      this.leaveQueueSha = await this.redisClient.script('LOAD', LEAVE_QUEUE_LUA) as string;
      await this.redisClient.evalsha(this.leaveQueueSha, 1, key, userId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Game creation
  // ──────────────────────────────────────────────────────────────────────

  createGameState(
    gameId: string,
    white: { userId: string; username: string },
    black: { userId: string; username: string },
    timeControl: string,
  ): GameState {
    const tc = TIME_CONTROLS[timeControl] ?? TIME_CONTROLS['blitz_5'];
    const chess = new Chess();

    return {
      id: gameId,
      fen: chess.fen(),
      pgn: '',
      whiteId: white.userId,
      blackId: black.userId,
      whiteUsername: white.username,
      blackUsername: black.username,
      status: 'active',
      timeControl,
      whiteTimeMs: tc.baseMs,
      blackTimeMs: tc.baseMs,
      turn: 'w',
      lastMoveAt: Date.now(),
      moveHistory: [],
      verboseMoves: [],
      createdAt: Date.now(),
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Move processing
  // ──────────────────────────────────────────────────────────────────────

  async processMove(
    gameId: string,
    userId: string,
    move: { from: string; to: string; promotion?: string },
  ): Promise<{ success: boolean; game?: GameState; error?: string }> {
    const game = await this.getGame(gameId);
    if (!game) return { success: false, error: 'Game not found' };

    if (game.status !== 'active') {
      return { success: false, error: 'Game is not active' };
    }

    // Check turn (BOT bypasses turn validation)
    const isWhiteTurn = game.turn === 'w';
    const isBot = userId === BOT_USER_ID;
    if (!isBot) {
      if (isWhiteTurn && userId !== game.whiteId) {
        return { success: false, error: 'Not your turn' };
      }
      if (!isWhiteTurn && userId !== game.blackId) {
        return { success: false, error: 'Not your turn' };
      }
    }

    // Apply time clock — bot's own clock is never decremented
    const now = Date.now();
    const elapsed = game.lastMoveAt ? now - game.lastMoveAt : 0;
    const tc = TIME_CONTROLS[game.timeControl] ?? TIME_CONTROLS['blitz_5'];
    const movingIsBot = isBot; // bot is making this move

    if (!movingIsBot) {
      // Only deduct time for human moves
      if (isWhiteTurn) {
        game.whiteTimeMs = Math.max(0, game.whiteTimeMs - elapsed) + tc.incrementMs;
        if (game.whiteTimeMs <= 0) {
          game.whiteTimeMs = 0;
          game.status = 'finished';
          game.winner = 'black';
          // Fall through — gateway will see status !== 'active' and handle game over
        }
      } else {
        game.blackTimeMs = Math.max(0, game.blackTimeMs - elapsed) + tc.incrementMs;
        if (game.blackTimeMs <= 0) {
          game.blackTimeMs = 0;
          game.status = 'finished';
          game.winner = 'white';
          // Fall through — gateway will see status !== 'active' and handle game over
        }
      }
    }

    // Chess.js validation
    // Priority order:
    //  1. Rebuild move-by-move from verboseMoves (most accurate, keeps PGN intact)
    //  2. Load from stored PGN (legacy games that have pgn but no verboseMoves)
    //  3. Last resort: load from FEN (loses full PGN history)
    const chess = new Chess();
    if (game.verboseMoves && game.verboseMoves.length > 0) {
      for (const vm of game.verboseMoves) {
        chess.move({ from: vm.from, to: vm.to, promotion: vm.promotion });
      }
    } else if (game.pgn) {
      try {
        chess.loadPgn(game.pgn);
      } catch {
        chess.load(game.fen);
      }
    } else {
      chess.load(game.fen);
    }

    try {
      const result = chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? 'q',
      });

      if (!result) return { success: false, error: 'Illegal move' };

      // Capture the verbose move detail
      const verboseResult: VerboseMove = {
        color: result.color as 'w' | 'b',
        from: result.from,
        to: result.to,
        piece: result.piece,
        captured: result.captured,
        promotion: result.promotion,
        flags: result.flags,
        san: result.san,
        lan: result.lan,
        before: result.before,
        after: result.after,
      };

      game.fen = chess.fen();
      game.pgn = chess.pgn();
      game.turn = chess.turn() as 'w' | 'b';
      game.lastMoveAt = now;
      game.moveHistory.push(result.san);
      game.verboseMoves = [...(game.verboseMoves ?? []), verboseResult];

      // Check game over
      if (chess.isGameOver()) {
        game.status = 'finished';
        if (chess.isCheckmate()) {
          game.winner = isWhiteTurn ? 'white' : 'black';
        } else {
          game.status = 'draw';
          game.winner = 'draw';
        }
      }

      await this.saveGame(game);
      return { success: true, game };
    } catch {
      return { success: false, error: 'Illegal move' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Resign / Draw
  // ──────────────────────────────────────────────────────────────────────

  async resign(gameId: string, userId: string): Promise<GameState | null> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'active') return null;

    game.status = 'resigned';
    game.winner = userId === game.whiteId ? 'black' : 'white';
    await this.saveGame(game);
    return game;
  }

  async offerDraw(gameId: string, userId: string): Promise<boolean> {
    const key = `chess:game:${gameId}:draw_offer`;
    const existing = await this.redisClient.get(key);
    if (existing && existing !== userId) {
      // Both players have offered draw - accept
      await this.redisClient.del(key);
      return true; // draw accepted
    }
    await this.redisClient.setex(key, 60, userId); // offer expires in 60s
    return false;
  }

  async acceptDraw(gameId: string): Promise<GameState | null> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'active') return null;

    game.status = 'draw';
    game.winner = 'draw';
    await this.saveGame(game);
    return game;
  }

  generateGameId(): string {
    return uuidv4();
  }

  // ──────────────────────────────────────────────────────────────────────
  // Persistence to PostgreSQL
  // ──────────────────────────────────────────────────────────────────────

  async saveGameToDb(gameId: string) {
    const game = await this.getGame(gameId);
    if (!game) {
      this.logger.warn(`saveGameToDb: game ${gameId} not found in Redis, cannot persist.`);
      return;
    }

    try {
      // BOT_USER_ID ('BOT') is NOT a valid UUID — replace with null for DB FK constraints
      const isWhiteBot = game.whiteId === BOT_USER_ID;
      const isBlackBot = game.blackId === BOT_USER_ID;

      const dbWhiteId = isWhiteBot ? null : game.whiteId;
      const dbBlackId = isBlackBot ? null : game.blackId;

      // Find winnerId if any (null for draws or bot wins)
      let winnerId: string | null = null;
      if (game.winner === 'white' && !isWhiteBot) winnerId = game.whiteId;
      else if (game.winner === 'black' && !isBlackBot) winnerId = game.blackId;

      const tournamentGameInfo = await this.redisClient.get(`tournament:game:${gameId}`);
      let tournamentId: string | null = null;
      if (tournamentGameInfo) {
        tournamentId = JSON.parse(tournamentGameInfo).tournamentId;
      }

      // Build the status string for the DB — normalise 'resigned' to 'finished'
      const dbStatus = game.status === 'resigned' ? 'resigned' : game.status;

      this.logger.log(
        `Persisting game ${gameId}: white=${dbWhiteId}, black=${dbBlackId}, winner=${winnerId}, status=${dbStatus}, isBot=${!!game.isBot}`,
      );

      await (this.db as any).insert(games).values({
        id: game.id,
        whiteId: dbWhiteId,
        blackId: dbBlackId,
        whiteUsername: game.whiteUsername || 'Unknown',
        blackUsername: game.blackUsername || 'Unknown',
        winnerId: winnerId,
        status: dbStatus,
        timeControl: game.timeControl,
        pgn: game.pgn || '',
        finalFen: game.fen,
        moves: game.verboseMoves ?? [],   // ← persist full verbose move list
        tournamentId: tournamentId,
        createdAt: new Date(game.createdAt || Date.now()),
      }).onConflictDoNothing();

      this.logger.log(`✅ Game ${gameId} persisted to database successfully`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to persist game ${gameId} to database: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
    }
  }

  async getGameHistory(userId: string) {
    return this.db
      .select({
        id: games.id,
        whiteId: games.whiteId,
        blackId: games.blackId,
        whiteUsername: games.whiteUsername,
        blackUsername: games.blackUsername,
        winnerId: games.winnerId,
        status: games.status,
        timeControl: games.timeControl,
        pgn: games.pgn,
        finalFen: games.finalFen,
        createdAt: games.createdAt,
      })
      .from(games)
      .where(or(eq(games.whiteId, userId), eq(games.blackId, userId)))
      .orderBy(desc(games.createdAt));
  }

  /** Public game history — same as getGameHistory but for any userId (no auth required) */
  async getPublicGameHistory(targetUserId: string) {
    return this.db
      .select({
        id: games.id,
        whiteId: games.whiteId,
        blackId: games.blackId,
        whiteUsername: games.whiteUsername,
        blackUsername: games.blackUsername,
        winnerId: games.winnerId,
        status: games.status,
        timeControl: games.timeControl,
        finalFen: games.finalFen,
        createdAt: games.createdAt,
      })
      .from(games)
      .where(or(eq(games.whiteId, targetUserId), eq(games.blackId, targetUserId)))
      .orderBy(desc(games.createdAt))
      .limit(30);
  }

  async getGameById(gameId: string) {
    const result = await this.db
      .select({
        id: games.id,
        whiteId: games.whiteId,
        blackId: games.blackId,
        whiteUsername: games.whiteUsername,
        blackUsername: games.blackUsername,
        winnerId: games.winnerId,
        status: games.status,
        timeControl: games.timeControl,
        pgn: games.pgn,
        finalFen: games.finalFen,
        moves: games.moves,
        createdAt: games.createdAt,
        tournamentId: games.tournamentId,
      })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Returns the verbose move list for replay.
   * Priority:
   *   1. moves JSONB column (new games).
   *   2. Reconstruct from PGN (legacy games saved before the moves column existed).
   */
  async getGameMoveHistory(gameId: string): Promise<VerboseMove[]> {
    const result = await this.db
      .select({ moves: games.moves, pgn: games.pgn })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!result[0]) return [];

    // --- Path 1: moves column already populated --------------------------
    const stored = result[0].moves as VerboseMove[] | null;
    if (stored && Array.isArray(stored) && stored.length > 0) {
      return stored;
    }

    // --- Path 2: fallback — reconstruct verbose moves from PGN -----------
    const pgn = result[0].pgn;
    if (!pgn) return [];

    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      // chess.js history({ verbose: true }) returns the same shape as VerboseMove
      return chess.history({ verbose: true }) as unknown as VerboseMove[];
    } catch (err) {
      this.logger.warn(`getGameMoveHistory: PGN parse failed for game ${gameId}: ${(err as Error).message}`);
      return [];
    }
  }
}
