import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardGateway } from './leaderboard.gateway';
import { RedisModule } from '../redis/redis.module';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [RedisModule, DrizzleModule],
  providers: [LeaderboardService, LeaderboardGateway],
  exports: [LeaderboardService, LeaderboardGateway],
})
export class LeaderboardModule {}
