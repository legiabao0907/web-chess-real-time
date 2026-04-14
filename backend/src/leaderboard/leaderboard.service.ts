import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  LeaderboardEntry,
  LeaderboardCategory,
  UpdateEloDto,
  LeaderboardUpdate,
} from './dto/leaderboard.dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  // Redis Sorted Set keys: chess:leaderboard:{category}
  // Score = ELO rating (higher = better rank)
  // Member = JSON string of player data

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private leaderboardKey(category: LeaderboardCategory) {
    return `chess:leaderboard:${category}`;
  }

  private playerDataKey(userId: string, category: LeaderboardCategory) {
    return `chess:player:${userId}:${category}`;
  }

  /**
   * Update or insert a player's ELO in the leaderboard.
   * Uses Redis Sorted Set (ZADD) for O(log N) ranking.
   */
  async updateElo(dto: UpdateEloDto): Promise<void> {
    const { userId, username, category, newElo, eloDelta, wins = 0, losses = 0, draws = 0 } = dto;

    // Get existing player data
    const existingRaw = await this.redis.get(this.playerDataKey(userId, category));
    const existing = existingRaw ? JSON.parse(existingRaw) : null;

    const playerData = {
      userId,
      username,
      elo: newElo,
      wins: (existing?.wins ?? 0) + wins,
      losses: (existing?.losses ?? 0) + losses,
      draws: (existing?.draws ?? 0) + draws,
      gamesPlayed: (existing?.gamesPlayed ?? 0) + wins + losses + draws,
      eloChange: eloDelta,
      trend: eloDelta > 0 ? 'up' : eloDelta < 0 ? 'down' : 'stable',
    };

    // Save extended player data
    await this.redis.setex(
      this.playerDataKey(userId, category),
      86400 * 7, // 7 day TTL
      JSON.stringify(playerData),
    );

    // Update sorted set with ELO as score
    await this.redis.zadd(this.leaderboardKey(category), newElo, userId);

    this.logger.log(`Leaderboard updated: ${username} ${category} ELO=${newElo} (${eloDelta >= 0 ? '+' : ''}${eloDelta})`);
  }

  /**
   * Get top N players for a category with full data.
   * ZREVRANGE: highest ELO first.
   */
  async getTopPlayers(
    category: LeaderboardCategory,
    limit = 50,
    offset = 0,
  ): Promise<LeaderboardUpdate> {
    const key = this.leaderboardKey(category);

    // Get userId list ordered by ELO descending
    const userIds = await this.redis.zrevrange(key, offset, offset + limit - 1);
    const totalPlayers = await this.redis.zcard(key);

    if (userIds.length === 0) {
      return {
        category,
        entries: [],
        updatedAt: Date.now(),
        totalPlayers: 0,
      };
    }

    // Fetch player data in parallel
    const pipeline = this.redis.pipeline();
    for (const uid of userIds) {
      pipeline.get(this.playerDataKey(uid, category));
    }
    const results = await pipeline.exec();

    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const raw = results?.[i]?.[1] as string | null;

      if (raw) {
        const data = JSON.parse(raw);
        const gamesPlayed = data.gamesPlayed || 1;
        entries.push({
          rank: offset + i + 1,
          userId,
          username: data.username,
          elo: data.elo,
          wins: data.wins ?? 0,
          losses: data.losses ?? 0,
          draws: data.draws ?? 0,
          gamesPlayed,
          winRate: Math.round((data.wins / gamesPlayed) * 100),
          trend: data.trend ?? 'stable',
          eloChange: data.eloChange ?? 0,
        });
      } else {
        // Fallback: player in sorted set but no data hash (edge case)
        const elo = await this.redis.zscore(key, userId);
        entries.push({
          rank: offset + i + 1,
          userId,
          username: userId,
          elo: Number(elo) || 1200,
          wins: 0,
          losses: 0,
          draws: 0,
          gamesPlayed: 0,
          winRate: 0,
          trend: 'stable',
          eloChange: 0,
        });
      }
    }

    return {
      category,
      entries,
      updatedAt: Date.now(),
      totalPlayers,
    };
  }

  /**
   * Get a player's rank and data for a specific category.
   */
  async getPlayerRank(
    userId: string,
    category: LeaderboardCategory,
  ): Promise<{ rank: number | null; elo: number | null }> {
    const key = this.leaderboardKey(category);
    // ZREVRANK returns 0-indexed rank from top
    const rankRaw = await this.redis.zrevrank(key, userId);
    const elo = await this.redis.zscore(key, userId);

    return {
      rank: rankRaw !== null ? rankRaw + 1 : null,
      elo: elo !== null ? Number(elo) : null,
    };
  }

  /**
   * Seed demo data for development/demo purposes.
   * Only adds if leaderboard is empty.
   */
  async seedDemoData(): Promise<void> {
    const categories: LeaderboardCategory[] = ['blitz', 'bullet', 'rapid'];

    for (const category of categories) {
      const count = await this.redis.zcard(this.leaderboardKey(category));
      if (count > 0) continue; // Already has data

      const demoPlayers = [
        { username: 'MagnusCarlsen', elo: 2860, wins: 540, losses: 45, draws: 120 },
        { username: 'HikariNakamura', elo: 2815, wins: 490, losses: 62, draws: 98 },
        { username: 'FabianoCaru', elo: 2800, wins: 450, losses: 70, draws: 110 },
        { username: 'WesleySo', elo: 2780, wins: 420, losses: 80, draws: 100 },
        { username: 'LevonAronian', elo: 2760, wins: 400, losses: 85, draws: 115 },
        { username: 'AnishGiri', elo: 2745, wins: 380, losses: 90, draws: 120 },
        { username: 'AlirezaFiro', elo: 2730, wins: 360, losses: 95, draws: 130 },
        { username: 'IanNepo', elo: 2715, wins: 350, losses: 100, draws: 140 },
        { username: 'DingLiren', elo: 2700, wins: 340, losses: 110, draws: 150 },
        { username: 'MaximeMVL', elo: 2685, wins: 330, losses: 115, draws: 140 },
        { username: 'VladimirKramnik', elo: 2670, wins: 320, losses: 120, draws: 150 },
        { username: 'SergeyKarjakin', elo: 2655, wins: 310, losses: 125, draws: 140 },
        { username: 'PentalaHari', elo: 2640, wins: 300, losses: 130, draws: 145 },
        { username: 'GataKamsky', elo: 2625, wins: 290, losses: 135, draws: 150 },
        { username: 'BorisGelfand', elo: 2610, wins: 280, losses: 140, draws: 155 },
      ];

      for (let i = 0; i < demoPlayers.length; i++) {
        const p = demoPlayers[i];
        // Slight variation per category
        const eloVariation = category === 'bullet' ? Math.floor(Math.random() * 100 - 50) :
                             category === 'rapid' ? Math.floor(Math.random() * 80 - 40) : 0;
        await this.updateElo({
          userId: `demo_${p.username.toLowerCase()}`,
          username: p.username,
          category,
          newElo: p.elo + eloVariation,
          eloDelta: Math.floor(Math.random() * 30 - 15),
          wins: p.wins,
          losses: p.losses,
          draws: p.draws,
        });
      }

      this.logger.log(`Seeded ${demoPlayers.length} demo players for ${category} leaderboard`);
    }
  }
}
