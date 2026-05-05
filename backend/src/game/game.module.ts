import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';
import { RedisModule } from '../redis/redis.module';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { WatchModule } from '../watch/watch.module';
import { TournamentModule } from '../tournament/tournament.module';
import { UserModule } from '../user/user.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    RedisModule,
    DrizzleModule,
    JwtModule.register({}),
    UserModule,
    LeaderboardModule,
    AiModule,
    forwardRef(() => WatchModule),
    forwardRef(() => TournamentModule),
  ],
  providers: [GameService, GameGateway],
  controllers: [GameController],
  exports: [GameService, GameGateway],
})
export class GameModule { }
