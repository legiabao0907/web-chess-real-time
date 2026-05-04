import { Module, forwardRef } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';
import { RedisModule } from '../redis/redis.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { WatchModule } from '../watch/watch.module';
import { TournamentModule } from '../tournament/tournament.module';

@Module({
  imports: [
    RedisModule,
    DrizzleModule,
    LeaderboardModule,
    forwardRef(() => WatchModule),
    forwardRef(() => TournamentModule),
  ],
  providers: [GameService, GameGateway],
  controllers: [GameController],
  exports: [GameService, GameGateway],
})
export class GameModule {}
