import { Module, forwardRef } from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { TournamentSwissService } from './tournament-swiss.service';
import { TournamentController } from './tournament.controller';
import { TournamentGateway } from './tournament.gateway';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { UserModule } from '../user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    DrizzleModule,
    UserModule,
    ConfigModule,
    JwtModule.register({}),
    RedisModule,
    forwardRef(() => GameModule),
  ],
  providers: [TournamentService, TournamentSwissService, TournamentGateway],
  controllers: [TournamentController],
  exports: [TournamentService, TournamentSwissService, TournamentGateway],
})
export class TournamentModule {}
