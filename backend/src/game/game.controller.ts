import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { GameService } from './game.service';
import { JwtAuthGuard } from '../user/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: string; username: string; email: string };
}

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) { }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: AuthRequest) {
    return this.gameService.getGameHistory(req.user.id);
  }
}
