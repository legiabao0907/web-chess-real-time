import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  GameState,
  MatchmakingEntry,
  CreateGameDto,
  JoinGameDto,
  MakeMoveDto,
} from './dto/game.dto';

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

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

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

  async joinQueue(entry: MatchmakingEntry): Promise<MatchmakingEntry | null> {
    const key = this.matchmakingKey(entry.timeControl);

    // Check if already in queue for this time control
    const existing = await this.redisClient.lrange(key, 0, -1);
    for (const raw of existing) {
      const e = JSON.parse(raw) as MatchmakingEntry;
      if (e.userId === entry.userId) {
        // Already queued, return null (no opponent found yet)
        return null;
      }
    }

    // Look for an opponent
    const raw = await this.redisClient.lpop(key);
    if (raw) {
      const opponent = JSON.parse(raw) as MatchmakingEntry;
      if (opponent.userId !== entry.userId) {
        return opponent; // Found an opponent!
      }
      // Same user somehow, re-add and fall through
      await this.redisClient.rpush(key, raw);
    }

    // No opponent found, add to queue
    await this.redisClient.rpush(key, JSON.stringify(entry));
    await this.redisClient.expire(key, 300); // 5 min TTL for queue entries
    return null;
  }

  async leaveQueue(userId: string, timeControl: string) {
    const key = this.matchmakingKey(timeControl);
    const existing = await this.redisClient.lrange(key, 0, -1);
    for (const raw of existing) {
      const e = JSON.parse(raw) as MatchmakingEntry;
      if (e.userId === userId) {
        await this.redisClient.lrem(key, 1, raw);
        break;
      }
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

    // Check turn
    const isWhiteTurn = game.turn === 'w';
    if (isWhiteTurn && userId !== game.whiteId) {
      return { success: false, error: 'Not your turn' };
    }
    if (!isWhiteTurn && userId !== game.blackId) {
      return { success: false, error: 'Not your turn' };
    }

    // Apply time increment
    const now = Date.now();
    const elapsed = game.lastMoveAt ? now - game.lastMoveAt : 0;
    const tc = TIME_CONTROLS[game.timeControl] ?? TIME_CONTROLS['blitz_5'];

    if (isWhiteTurn) {
      game.whiteTimeMs = Math.max(0, game.whiteTimeMs - elapsed) + tc.incrementMs;
      if (game.whiteTimeMs <= 0) {
        game.status = 'finished';
        game.winner = 'black';
        await this.saveGame(game);
        return { success: true, game };
      }
    } else {
      game.blackTimeMs = Math.max(0, game.blackTimeMs - elapsed) + tc.incrementMs;
      if (game.blackTimeMs <= 0) {
        game.status = 'finished';
        game.winner = 'white';
        await this.saveGame(game);
        return { success: true, game };
      }
    }

    // Chess.js validation
    const chess = new Chess(game.fen);
    try {
      const result = chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? 'q',
      });

      if (!result) return { success: false, error: 'Illegal move' };

      game.fen = chess.fen();
      game.pgn = chess.pgn();
      game.turn = chess.turn() as 'w' | 'b';
      game.lastMoveAt = now;
      game.moveHistory.push(result.san);

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
}
