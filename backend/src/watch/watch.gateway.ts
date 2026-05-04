import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { WatchService } from './watch.service';
import { GameService } from '../game/game.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/watch',
  transports: ['websocket', 'polling'],
})
export class WatchGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WatchGateway.name);

  // Map socketId -> gameId they are watching
  private spectators = new Map<string, string>();

  constructor(
    private readonly watchService: WatchService,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('👁️  Watch WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Watch client connected: ${client.id}`);
    client.emit('watch_connected', { socketId: client.id });
  }

  async handleDisconnect(client: Socket) {
    const gameId = this.spectators.get(client.id);
    if (gameId) {
      await this.handleLeaveInternal(client, gameId);
    }
    this.logger.log(`Watch client disconnected: ${client.id}`);
  }

  // ─── WATCH A GAME ─────────────────────────────────────────────────────────
  @SubscribeMessage('watch_game')
  async handleWatchGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const { gameId } = data;

    // Leave previous watched game if any
    const previousGameId = this.spectators.get(client.id);
    if (previousGameId && previousGameId !== gameId) {
      await this.handleLeaveInternal(client, previousGameId);
    }

    const game = await this.gameService.getGame(gameId);
    if (!game) {
      client.emit('watch_error', { message: 'Game not found or has ended' });
      return;
    }

    await client.join(gameId);
    this.spectators.set(client.id, gameId);

    const spectatorCount = await this.watchService.addSpectator(gameId);

    // Send current game state to the new spectator
    client.emit('watch_state', {
      gameId: game.id,
      fen: game.fen,
      pgn: game.pgn,
      whiteId: game.whiteId,
      blackId: game.blackId,
      whiteUsername: game.whiteUsername,
      blackUsername: game.blackUsername,
      status: game.status,
      timeControl: game.timeControl,
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      turn: game.turn,
      moveHistory: game.moveHistory,
      lastMoveAt: game.lastMoveAt,
      spectatorCount,
    });

    // Notify others in the room about spectator count update
    client.to(gameId).emit('spectator_count', { gameId, spectatorCount });

    this.logger.log(`Client ${client.id} now watching game ${gameId} (${spectatorCount} spectators)`);
  }

  // ─── LEAVE WATCH ──────────────────────────────────────────────────────────
  @SubscribeMessage('leave_watch')
  async handleLeaveWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    await this.handleLeaveInternal(client, data.gameId);
    client.emit('watch_left', { gameId: data.gameId });
  }

  // ─── LIST LIVE GAMES ──────────────────────────────────────────────────────
  @SubscribeMessage('list_live_games')
  async handleListLiveGames(@ConnectedSocket() client: Socket) {
    const games = await this.watchService.listActiveGames();
    client.emit('live_games', { games });
  }

  // ─── BROADCAST GAME UPDATE TO SPECTATORS (called from GameGateway) ────────
  broadcastGameUpdate(gameId: string, data: Record<string, unknown>) {
    this.server.to(gameId).emit('watch_update', data);
  }

  broadcastGameOver(gameId: string, data: Record<string, unknown>) {
    this.server.to(gameId).emit('watch_game_over', data);
    // Clean up spectator counts
    this.watchService.removeSpectator(gameId).catch(() => {});
  }

  // ─── Internal leave helper ─────────────────────────────────────────────────
  private async handleLeaveInternal(client: Socket, gameId: string) {
    await client.leave(gameId);
    this.spectators.delete(client.id);

    const spectatorCount = await this.watchService.removeSpectator(gameId);
    this.server.to(gameId).emit('spectator_count', { gameId, spectatorCount });
  }
}
