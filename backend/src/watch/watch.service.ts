import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { GameState } from '../game/dto/game.dto';

export interface LiveGameSummary {
  gameId: string;
  whiteUsername: string;
  blackUsername: string;
  timeControl: string;
  spectatorCount: number;
  startedAt: number;
  fen: string;
  moveCount: number;
}

@Injectable()
export class WatchService {
  private readonly logger = new Logger(WatchService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private spectatorKey(gameId: string) {
    return `watch:game:${gameId}:spectators`;
  }

  async addSpectator(gameId: string): Promise<number> {
    const key = this.spectatorKey(gameId);
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 7200); // 2 hours TTL
    return count;
  }

  async removeSpectator(gameId: string): Promise<number> {
    const key = this.spectatorKey(gameId);
    const count = await this.redis.decr(key);
    if (count <= 0) {
      await this.redis.del(key);
      return 0;
    }
    return count;
  }

  async getSpectatorCount(gameId: string): Promise<number> {
    const count = await this.redis.get(this.spectatorKey(gameId));
    return parseInt(count ?? '0', 10);
  }

  async listActiveGames(): Promise<LiveGameSummary[]> {
    // Scan for all active chess games in Redis
    const gameKeys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'chess:game:*',
        'COUNT',
        '100',
      );
      cursor = nextCursor;
      // Filter out helper keys like draw_offer keys
      const filtered = keys.filter(
        (k) => !k.includes(':draw_offer') && !k.includes(':spectators'),
      );
      gameKeys.push(...filtered);
    } while (cursor !== '0');

    const games: LiveGameSummary[] = [];

    for (const key of gameKeys) {
      try {
        const raw = await this.redis.get(key);
        if (!raw) continue;
        const game = JSON.parse(raw) as GameState;
        if (game.status !== 'active') continue;

        const gameId = game.id;
        const spectatorCount = await this.getSpectatorCount(gameId);

        games.push({
          gameId,
          whiteUsername: game.whiteUsername,
          blackUsername: game.blackUsername,
          timeControl: game.timeControl,
          spectatorCount,
          startedAt: game.createdAt,
          fen: game.fen,
          moveCount: game.moveHistory?.length ?? 0,
        });
      } catch {
        // Malformed key, skip
      }
    }

    // Sort by most spectators, then most moves
    return games.sort((a, b) => b.spectatorCount - a.spectatorCount || b.moveCount - a.moveCount);
  }
}
