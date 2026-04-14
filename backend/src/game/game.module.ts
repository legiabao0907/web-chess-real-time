import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { RedisModule } from '../redis/redis.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [RedisModule, LeaderboardModule],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
