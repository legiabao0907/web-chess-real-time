import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { GameService } from './src/game/game.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gameService = app.get(GameService);
  const history = await gameService.getGameHistory('c877f16a-5576-4d29-abb5-bb6df335bf6a');
  console.log('History length:', history.length);
  const found = history.find(h => h.id === 'b1736c6c-758f-42af-ab72-62cdee669c68');
  console.log('Found game?', !!found);
  await app.close();
  process.exit(0);
}
bootstrap();
