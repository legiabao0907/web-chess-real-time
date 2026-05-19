import { Controller, Get, Post, Param, UseGuards, Req, NotFoundException, Logger } from '@nestjs/common';
import { GameService } from './game.service';
import { JwtAuthGuard } from '../user/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: string; username: string; email: string };
}

@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) { }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: AuthRequest) {
    const games = await this.gameService.getGameHistory(req.user.id);
    this.logger.log(`getHistory for user ${req.user.id}: found ${games.length} games`);
    return games;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getGameById(@Param('id') id: string) {
    const game = await this.gameService.getGameById(id);
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  /**
   * GET /game/:id/history
   * Returns the full verbose move list for replay.
   * Requires authentication so only logged-in users can access game data.
   */
  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  async getGameMoveHistory(@Param('id') id: string) {
    // Verify the game exists first
    const game = await this.gameService.getGameById(id);
    if (!game) throw new NotFoundException('Game not found');

    const moves = await this.gameService.getGameMoveHistory(id);
    this.logger.log(`getGameMoveHistory for game ${id}: ${moves.length} moves`);

    return {
      gameId: id,
      whiteUsername: game.whiteUsername,
      blackUsername: game.blackUsername,
      status: game.status,
      winner: game.winnerId,
      timeControl: game.timeControl,
      finalFen: game.finalFen,
      moves,
    };
  }
}
