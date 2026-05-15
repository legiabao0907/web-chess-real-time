import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { GameService } from './src/game/game.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gameService = app.get(GameService);
  
  const gameId = gameService.generateGameId();
  const gameState = gameService.createGameState(
    gameId, 
    { userId: '265cc988-c46d-4b62-a48b-a0f17101d2a1', username: 'test1' }, 
    { userId: 'c877f16a-5576-4d29-abb5-bb6df335bf6a', username: 'test2' }, 
    'blitz_5'
  );
  gameState.status = 'finished';
  gameState.winner = 'white';
  
  await gameService.saveGame(gameState);
  await gameService.saveGameToDb(gameId);
  
  console.log('Done test');
  await app.close();
  process.exit(0);
}
bootstrap();
