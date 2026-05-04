import { Module, forwardRef } from '@nestjs/common';
import { WatchService } from './watch.service';
import { WatchGateway } from './watch.gateway';
import { RedisModule } from '../redis/redis.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [RedisModule, forwardRef(() => GameModule)],
  providers: [WatchService, WatchGateway],
  exports: [WatchGateway],
})
export class WatchModule {}
