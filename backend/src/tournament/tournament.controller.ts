import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { TournamentGateway } from './tournament.gateway';
import { JwtAuthGuard } from '../user/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: string; username: string; email: string };
}

class CreateTournamentDto {
  name!: string;
  format?: string;
  timeControl?: string;
  startTime?: string;
  maxPlayers?: number;
}

@Controller('tournament')
export class TournamentController {
  constructor(
    private readonly tournamentService: TournamentService,
    private readonly tournamentGateway: TournamentGateway,
  ) {}

  // GET /tournament — all tournaments
  @Get()
  async list() {
    return this.tournamentService.listTournaments();
  }

  // GET /tournament/my — my joined tournaments (requires auth)
  @Get('my')
  @UseGuards(JwtAuthGuard)
  async myTournaments(@Req() req: AuthRequest) {
    return this.tournamentService.getMyTournaments(req.user.id);
  }

  // GET /tournament/:id — one tournament with participants
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.tournamentService.getTournament(id);
  }

  // GET /tournament/:id/rounds — get rounds info
  @Get(':id/rounds')
  async getRounds(@Param('id') id: string) {
    return this.tournamentService.getTournamentRounds(id);
  }

  // POST /tournament — create
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: AuthRequest, @Body() dto: CreateTournamentDto) {
    return this.tournamentService.createTournament(req.user.id, dto);
  }

  // POST /tournament/:id/join — join
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  async join(@Req() req: AuthRequest, @Param('id') id: string) {
    const result = await this.tournamentService.joinTournament(id, req.user.id);
    // Broadcast updated participant count
    const tournament = await this.tournamentService.getTournament(id);
    this.tournamentGateway.broadcastTournamentUpdate(id, { type: 'participant_joined', tournament });
    return result;
  }

  // DELETE /tournament/:id/leave — leave
  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leave(@Req() req: AuthRequest, @Param('id') id: string) {
    const result = await this.tournamentService.leaveTournament(id, req.user.id);
    const tournament = await this.tournamentService.getTournament(id);
    this.tournamentGateway.broadcastTournamentUpdate(id, { type: 'participant_left', tournament });
    return result;
  }

  // PATCH /tournament/:id/start — start (creator only), generates Swiss Round 1
  @Patch(':id/start')
  @UseGuards(JwtAuthGuard)
  async start(@Req() req: AuthRequest, @Param('id') id: string) {
    const result = await this.tournamentService.startTournament(id, req.user.id);

    // Broadcast to all players in the tournament room
    const tournament = await this.tournamentService.getTournament(id);
    const rounds = await this.tournamentService.getTournamentRounds(id);
    this.tournamentGateway.broadcastTournamentUpdate(id, {
      type: 'tournament_started',
      tournament,
      rounds,
    });

    // Notify each paired player about their game
    if (result.round) {
      for (const game of result.round.games) {
        if (game.blackId !== 'BYE') {
          const gameInfo = {
            type: 'tournament_game_ready',
            gameId: game.gameId,
            tournamentId: id,
            round: game.round,
            opponentId: game.blackId,
            opponentUsername: game.blackUsername,
            yourColor: 'white',
          };
          this.tournamentGateway.notifyPlayer(game.whiteId, 'tournament_game_ready', {
            ...gameInfo,
            yourColor: 'white',
          });
          this.tournamentGateway.notifyPlayer(game.blackId, 'tournament_game_ready', {
            ...gameInfo,
            opponentId: game.whiteId,
            opponentUsername: game.whiteUsername,
            yourColor: 'black',
          });
        }
      }
    }

    return result;
  }

  // PATCH /tournament/:id/next-round — advance to next Swiss round
  @Patch(':id/next-round')
  @UseGuards(JwtAuthGuard)
  async nextRound(@Req() req: AuthRequest, @Param('id') id: string) {
    const result = await this.tournamentService.nextRound(id, req.user.id);

    // Broadcast
    const tournament = await this.tournamentService.getTournament(id);
    const rounds = await this.tournamentService.getTournamentRounds(id);
    this.tournamentGateway.broadcastTournamentUpdate(id, {
      type: 'next_round',
      tournament,
      rounds,
    });

    // Notify each paired player
    if (result.round) {
      for (const game of result.round.games) {
        if (game.blackId !== 'BYE') {
          this.tournamentGateway.notifyPlayer(game.whiteId, 'tournament_game_ready', {
            type: 'tournament_game_ready',
            gameId: game.gameId,
            tournamentId: id,
            round: game.round,
            yourColor: 'white',
            opponentId: game.blackId,
            opponentUsername: game.blackUsername,
          });
          this.tournamentGateway.notifyPlayer(game.blackId, 'tournament_game_ready', {
            type: 'tournament_game_ready',
            gameId: game.gameId,
            tournamentId: id,
            round: game.round,
            yourColor: 'black',
            opponentId: game.whiteId,
            opponentUsername: game.whiteUsername,
          });
        }
      }
    }

    return result;
  }

  // PATCH /tournament/:id/finish — end tournament early
  @Patch(':id/finish')
  @UseGuards(JwtAuthGuard)
  async finish(@Req() req: AuthRequest, @Param('id') id: string) {
    const result = await this.tournamentService.finishTournament(id, req.user.id);

    // Broadcast
    const tournament = await this.tournamentService.getTournament(id);
    const rounds = await this.tournamentService.getTournamentRounds(id);
    this.tournamentGateway.broadcastTournamentUpdate(id, {
      type: 'tournament_finished',
      tournament,
      rounds,
    });

    return result;
  }

  // DELETE /tournament/:id — delete tournament (creator or admin only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteTournament(@Req() req: AuthRequest, @Param('id') id: string) {
    // Check if user is admin
    const isAdmin = await this.tournamentService.isAdmin(req.user.id);
    const result = await this.tournamentService.deleteTournament(
      id,
      req.user.id,
      isAdmin,
    );
    // Clean up timer if exists
    this.tournamentGateway.clearNextRoundTimer(id);
    return result;
  }
}
