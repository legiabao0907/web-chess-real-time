import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { GameService } from './src/game/game.service';
import { BOT_USER_ID, BOT_USERNAME } from './src/game/dto/game.dto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gameService = app.get(GameService);
  
  const gameId = gameService.generateGameId();
  const gameState = gameService.createGameState(
    gameId, 
    { userId: '265cc988-c46d-4b62-a48b-a0f17101d2a1', username: 'test1' }, 
    { userId: BOT_USER_ID, username: `${BOT_USERNAME} (easy)` }, 
    'blitz_5'
  );
  gameState.isBot = true;
  gameState.botColor = 'b';
  gameState.status = 'finished';
  gameState.winner = 'white';
  
  await gameService.saveGame(gameState);
  await gameService.saveGameToDb(gameId);
  
  console.log('Done test bot save');
  await app.close();
  process.exit(0);
}
bootstrap();
