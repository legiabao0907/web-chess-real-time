import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema/schema';
import { tournaments, tournamentParticipants } from '../drizzle/schema/tournament.schema';
import { users } from '../drizzle/schema/users.schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { v4 as uuidv4 } from 'uuid';
import { TournamentSwissService } from './tournament-swiss.service';

// ── Swiss round/game types (stored in Redis) ─────────────────────────────────
export interface TournamentGame {
  gameId: string;
  tournamentId: string;
  round: number;
  whiteId: string;
  whiteUsername: string;
  blackId: string;
  blackUsername: string;
  status: 'pending' | 'active' | 'finished';
  result?: 'white' | 'black' | 'draw' | null; // null = not played / bye
  whitePoints?: number; // points awarded
  blackPoints?: number;
}

export interface TournamentRound {
  tournamentId: string;
  round: number;
  games: TournamentGame[];
  status: 'active' | 'finished';
}

@Injectable()
export class TournamentService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly swissService: TournamentSwissService,
  ) {}

  // ── Redis key helpers ─────────────────────────────────────────────────────
  private roundsKey(tournamentId: string) {
    return `tournament:${tournamentId}:rounds`;
  }
  private roundKey(tournamentId: string, round: number) {
    return `tournament:${tournamentId}:round:${round}`;
  }
  private currentRoundKey(tournamentId: string) {
    return `tournament:${tournamentId}:currentRound`;
  }

  // ── List all tournaments ──────────────────────────────────────────────────
  async listTournaments() {
    const rows = await this.db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        format: tournaments.format,
        status: tournaments.status,
        timeControl: tournaments.timeControl,
        startTime: tournaments.startTime,
        endTime: tournaments.endTime,
        creatorId: tournaments.creatorId,
        creatorUsername: users.username,
      })
      .from(tournaments)
      .leftJoin(users, eq(users.id, tournaments.creatorId))
      .orderBy(desc(tournaments.startTime));

    const result = await Promise.all(
      rows.map(async (t) => {
        const [{ value: participantCount }] = await this.db
          .select({ value: count() })
          .from(tournamentParticipants)
          .where(eq(tournamentParticipants.tournamentId, t.id));
        return { ...t, participantCount: Number(participantCount) };
      }),
    );

    return result;
  }

  // ── Get one tournament with participants ──────────────────────────────────
  async getTournament(id: string) {
    const [t] = await this.db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        format: tournaments.format,
        status: tournaments.status,
        timeControl: tournaments.timeControl,
        startTime: tournaments.startTime,
        endTime: tournaments.endTime,
        creatorId: tournaments.creatorId,
        creatorUsername: users.username,
      })
      .from(tournaments)
      .leftJoin(users, eq(users.id, tournaments.creatorId))
      .where(eq(tournaments.id, id))
      .limit(1);

    if (!t) throw new NotFoundException('Tournament not found');

    const participants = await this.db
      .select({
        userId: tournamentParticipants.userId,
        username: users.username,
        points: tournamentParticipants.points,
        tieBreak: tournamentParticipants.tieBreak,
        rank: tournamentParticipants.rank,
      })
      .from(tournamentParticipants)
      .leftJoin(users, eq(users.id, tournamentParticipants.userId))
      .where(eq(tournamentParticipants.tournamentId, id))
      .orderBy(tournamentParticipants.rank);

    // Get current round info
    const currentRound = await this.getCurrentRound(id);

    return { ...t, participants, currentRound };
  }

  // ── Get tournament rounds (from Redis) ────────────────────────────────────
  async getTournamentRounds(tournamentId: string): Promise<TournamentRound[]> {
    const currentRound = await this.getCurrentRound(tournamentId);
    if (!currentRound) return [];

    const rounds: TournamentRound[] = [];
    for (let r = 1; r <= currentRound; r++) {
      const data = await this.redis.get(this.roundKey(tournamentId, r));
      if (data) rounds.push(JSON.parse(data));
    }
    return rounds;
  }

  async getCurrentRound(tournamentId: string): Promise<number> {
    const val = await this.redis.get(this.currentRoundKey(tournamentId));
    return val ? parseInt(val) : 0;
  }

  // ── Create tournament ─────────────────────────────────────────────────────
  async createTournament(
    creatorId: string,
    dto: {
      name: string;
      format?: string;
      timeControl?: string;
      startTime?: string;
      maxPlayers?: number;
    },
  ) {
    const [created] = await (this.db as any)
      .insert(tournaments)
      .values({
        name: dto.name,
        format: dto.format ?? 'swiss',
        status: 'upcoming',
        timeControl: dto.timeControl ?? 'blitz_5',
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        creatorId,
      })
      .returning();

    // Auto-join creator
    await (this.db as any)
      .insert(tournamentParticipants)
      .values({ tournamentId: created.id, userId: creatorId, points: 0, tieBreak: 0 });

    return created;
  }

  // ── Join tournament ───────────────────────────────────────────────────────
  async joinTournament(tournamentId: string, userId: string) {
    const [t] = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!t) throw new NotFoundException('Tournament not found');
    if (t.status === 'finished') throw new ForbiddenException('Tournament already finished');
    if (t.status === 'ongoing') throw new ForbiddenException('Tournament already started');

    const [existing] = await this.db
      .select()
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, userId),
        ),
      )
      .limit(1);

    if (existing) throw new ConflictException('Already joined this tournament');

    await (this.db as any)
      .insert(tournamentParticipants)
      .values({ tournamentId, userId, points: 0, tieBreak: 0 });

    return { message: 'Joined tournament successfully' };
  }

  // ── Leave tournament ──────────────────────────────────────────────────────
  async leaveTournament(tournamentId: string, userId: string) {
    const [t] = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!t) throw new NotFoundException('Tournament not found');
    if (t.status !== 'upcoming') throw new ForbiddenException('Can only leave upcoming tournaments');

    await this.db
      .delete(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, userId),
        ),
      );

    return { message: 'Left tournament' };
  }

  // ── Start tournament — generate Swiss Round 1 ─────────────────────────────
  async startTournament(tournamentId: string, userId: string) {
    const [t] = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!t) throw new NotFoundException('Tournament not found');
    if (t.creatorId !== userId) throw new ForbiddenException('Only creator can start the tournament');
    if (t.status !== 'upcoming') throw new ForbiddenException('Tournament is not in upcoming state');

    const participants = await this.db
      .select({
        userId: tournamentParticipants.userId,
        username: users.username,
        points: tournamentParticipants.points,
      })
      .from(tournamentParticipants)
      .leftJoin(users, eq(users.id, tournamentParticipants.userId))
      .where(eq(tournamentParticipants.tournamentId, tournamentId));

    if (participants.length < 2) {
      throw new ForbiddenException('Need at least 2 players to start');
    }

    // Update tournament status
    await (this.db as any)
      .update(tournaments)
      .set({ status: 'ongoing' })
      .where(eq(tournaments.id, tournamentId));

    // Generate Round 1 Swiss pairings
    const round1 = this.generateSwissPairings(
      tournamentId,
      1,
      participants as { userId: string; username: string; points: number }[],
      [],
    );

    // Save round to Redis
    await this.redis.setex(this.roundKey(tournamentId, 1), 86400 * 7, JSON.stringify(round1));
    await this.redis.set(this.currentRoundKey(tournamentId), '1');

    return { message: 'Tournament started', round: round1 };
  }

  // ── Next Round — generate Swiss pairings based on results ────────────────
  async nextRound(tournamentId: string, userId: string) {
    const [t] = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!t) throw new NotFoundException('Tournament not found');
    if (t.creatorId !== userId) throw new ForbiddenException('Only creator can advance rounds');
    if (t.status !== 'ongoing') throw new ForbiddenException('Tournament is not ongoing');

    const currentRound = await this.getCurrentRound(tournamentId);
    if (!currentRound) throw new ForbiddenException('No active round');

    // Check if current round is complete
    const currentRoundData: TournamentRound = JSON.parse(
      (await this.redis.get(this.roundKey(tournamentId, currentRound))) ?? '{}',
    );

    const allFinished = currentRoundData.games.every(
      (g) => g.status === 'finished' || g.result === null,
    );
    if (!allFinished) throw new ForbiddenException('Current round is not finished yet');

    // Mark current round as finished
    currentRoundData.status = 'finished';
    await this.redis.setex(
      this.roundKey(tournamentId, currentRound),
      86400 * 7,
      JSON.stringify(currentRoundData),
    );

    // Update points in DB
    await this.applyRoundResults(tournamentId, currentRoundData);

    const nextRound = currentRound + 1;

    // Dùng TournamentSwissService để sinh cặp đấu theo đúng Hệ Thụy Sĩ
    const swissResult = await this.swissService.generateNextRoundPairs(
      tournamentId,
      nextRound,
    );

    // Chuyển SwissPairing[] → TournamentGame[]
    const games: TournamentGame[] = swissResult.pairings.map((p) => ({
      gameId: p.gameId,
      tournamentId,
      round: nextRound,
      whiteId: p.whiteId,
      whiteUsername: p.whiteUsername,
      blackId: p.blackId,
      blackUsername: p.blackUsername,
      status: p.type === 'bye' ? 'finished' : 'pending',
      result: p.type === 'bye' ? null : null,
      whitePoints: p.type === 'bye' ? 1 : undefined,
      blackPoints: p.type === 'bye' ? 0 : undefined,
    }));

    const round: TournamentRound = {
      tournamentId,
      round: nextRound,
      games,
      status: 'active',
    };

    await this.redis.setex(this.roundKey(tournamentId, nextRound), 86400 * 7, JSON.stringify(round));
    await this.redis.set(this.currentRoundKey(tournamentId), String(nextRound));

    return { message: `Round ${nextRound} started`, round };
  }

  // ── Record game result in a tournament round ──────────────────────────────
  async recordTournamentResult(
    tournamentId: string,
    gameId: string,
    result: 'white' | 'black' | 'draw',
  ) {
    const currentRound = await this.getCurrentRound(tournamentId);
    if (!currentRound) return;

    const roundData: TournamentRound = JSON.parse(
      (await this.redis.get(this.roundKey(tournamentId, currentRound))) ?? '{}',
    );

    const game = roundData.games.find((g) => g.gameId === gameId);
    if (!game) return;

    game.result = result;
    game.status = 'finished';
    game.whitePoints = result === 'white' ? 1 : result === 'draw' ? 0.5 : 0;
    game.blackPoints = result === 'black' ? 1 : result === 'draw' ? 0.5 : 0;

    await this.redis.setex(
      this.roundKey(tournamentId, currentRound),
      86400 * 7,
      JSON.stringify(roundData),
    );

    return roundData;
  }

  // ── Get tournament game info by gameId ────────────────────────────────────
  async getTournamentGameInfo(
    gameId: string,
  ): Promise<{ tournamentId: string; round: number } | null> {
    const key = `tournament:game:${gameId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // ── My tournaments ────────────────────────────────────────────────────────
  async getMyTournaments(userId: string) {
    const rows = await this.db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        format: tournaments.format,
        status: tournaments.status,
        timeControl: tournaments.timeControl,
        startTime: tournaments.startTime,
        points: tournamentParticipants.points,
        rank: tournamentParticipants.rank,
      })
      .from(tournamentParticipants)
      .leftJoin(tournaments, eq(tournaments.id, tournamentParticipants.tournamentId))
      .where(eq(tournamentParticipants.userId, userId))
      .orderBy(desc(tournaments.startTime));

    return rows;
  }

  // ── SWISS PAIRING LOGIC ───────────────────────────────────────────────────
  private generateSwissPairings(
    tournamentId: string,
    round: number,
    participants: { userId: string; username: string; points: number }[],
    pastPairings: Array<[string, string]>,
  ): TournamentRound {
    // Sort by points descending (higher rated first)
    const sorted = [...participants].sort((a, b) => b.points - a.points);
    const paired = new Set<string>();
    const games: TournamentGame[] = [];

    // Build past pairing set for quick lookup
    const pairingSet = new Set<string>();
    for (const [w, b] of pastPairings) {
      pairingSet.add(`${w}:${b}`);
      pairingSet.add(`${b}:${w}`);
    }

    // Greedy Swiss pairing
    for (let i = 0; i < sorted.length; i++) {
      if (paired.has(sorted[i].userId)) continue;

      // Find next available opponent
      let opponentIdx = -1;
      for (let j = i + 1; j < sorted.length; j++) {
        if (!paired.has(sorted[j].userId)) {
          const key1 = `${sorted[i].userId}:${sorted[j].userId}`;
          const key2 = `${sorted[j].userId}:${sorted[i].userId}`;
          // Prefer opponents without prior games; allow rematches only if no other choice
          if (!pairingSet.has(key1) && !pairingSet.has(key2)) {
            opponentIdx = j;
            break;
          }
          if (opponentIdx === -1) opponentIdx = j; // fallback: first available
        }
      }

      if (opponentIdx === -1) {
        // Bye — odd number of players
        const gameId = uuidv4();
        games.push({
          gameId,
          tournamentId,
          round,
          whiteId: sorted[i].userId,
          whiteUsername: sorted[i].username ?? 'Unknown',
          blackId: 'BYE',
          blackUsername: 'BYE',
          status: 'finished',
          result: null,
          whitePoints: 1,
          blackPoints: 0,
        });
        paired.add(sorted[i].userId);
      } else {
        const gameId = uuidv4();
        // Alternate colors: higher-ranked player gets white in odd rounds, black in even
        const white = round % 2 === 1 ? sorted[i] : sorted[opponentIdx];
        const black = round % 2 === 1 ? sorted[opponentIdx] : sorted[i];

        games.push({
          gameId,
          tournamentId,
          round,
          whiteId: white.userId,
          whiteUsername: white.username ?? 'Unknown',
          blackId: black.userId,
          blackUsername: black.username ?? 'Unknown',
          status: 'pending',
          result: null,
        });

        // Store reverse lookup: gameId -> { tournamentId, round }
        this.redis
          .setex(`tournament:game:${gameId}`, 86400 * 7, JSON.stringify({ tournamentId, round }))
          .catch(() => {});

        paired.add(sorted[i].userId);
        paired.add(sorted[opponentIdx].userId);
      }
    }

    return { tournamentId, round, games, status: 'active' };
  }

  // ── Apply round results to participant points ─────────────────────────────
  private async applyRoundResults(tournamentId: string, round: TournamentRound) {
    for (const game of round.games) {
      if (game.result === null || game.blackId === 'BYE') {
        // Bye: give 1 point to the player
        if (game.whiteId !== 'BYE') {
          await this.incrementPoints(tournamentId, game.whiteId, 1);
        }
        continue;
      }
      if (game.whitePoints !== undefined)
        await this.incrementPoints(tournamentId, game.whiteId, game.whitePoints);
      if (game.blackPoints !== undefined)
        await this.incrementPoints(tournamentId, game.blackId, game.blackPoints);
    }
    // Update rankings
    await this.updateRankings(tournamentId);
  }

  private async incrementPoints(tournamentId: string, userId: string, delta: number) {
    const [existing] = await this.db
      .select()
      .from(tournamentParticipants)
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, userId),
        ),
      )
      .limit(1);
    if (!existing) return;
    const newPoints = (existing.points ?? 0) + delta;
    await (this.db as any)
      .update(tournamentParticipants)
      .set({ points: newPoints })
      .where(
        and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, userId),
        ),
      );
  }

  private async updateRankings(tournamentId: string) {
    const participants = await this.db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(desc(tournamentParticipants.points));

    for (let i = 0; i < participants.length; i++) {
      await (this.db as any)
        .update(tournamentParticipants)
        .set({ rank: i + 1 })
        .where(
          and(
            eq(tournamentParticipants.tournamentId, tournamentId),
            eq(tournamentParticipants.userId, participants[i].userId!),
          ),
        );
    }
  }
}
