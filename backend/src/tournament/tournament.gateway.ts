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
import { Logger } from '@nestjs/common';
import { TournamentService } from './tournament.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/tournament',
  transports: ['websocket', 'polling'],
})
export class TournamentGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TournamentGateway.name);

  // userId -> socketId mapping for pushing game notifications
  private userSockets = new Map<string, Set<string>>();
  // socketId -> { userId, tournamentId }
  private clients = new Map<string, { userId: string; tournamentId?: string }>();

  constructor(private readonly tournamentService: TournamentService) {}

  afterInit() {
    this.logger.log('🏆 Tournament WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Tournament client connected: ${client.id}`);
    client.emit('tournament_connected', { socketId: client.id });
  }

  async handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    if (info) {
      const sockets = this.userSockets.get(info.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(info.userId);
      }
      if (info.tournamentId) {
        client.leave(`tournament:${info.tournamentId}`);
      }
      this.clients.delete(client.id);
    }
    this.logger.log(`Tournament client disconnected: ${client.id}`);
  }

  // ─── IDENTIFY (register userId for push notifications) ────────────────────
  @SubscribeMessage('tournament_identify')
  handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    this.clients.set(client.id, { userId });
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId)!.add(client.id);
    client.emit('tournament_identified', { userId });
  }

  // ─── JOIN a tournament room for live updates ──────────────────────────────
  @SubscribeMessage('join_tournament_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; tournamentId: string },
  ) {
    const { userId, tournamentId } = data;
    const info = this.clients.get(client.id) ?? { userId };
    info.tournamentId = tournamentId;
    this.clients.set(client.id, info);

    await client.join(`tournament:${tournamentId}`);

    // Send current tournament state
    try {
      const tournament = await this.tournamentService.getTournament(tournamentId);
      const rounds = await this.tournamentService.getTournamentRounds(tournamentId);
      client.emit('tournament_state', { tournament, rounds });
    } catch {}
  }

  // ─── LEAVE tournament room ────────────────────────────────────────────────
  @SubscribeMessage('leave_tournament_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tournamentId: string },
  ) {
    await client.leave(`tournament:${data.tournamentId}`);
    const info = this.clients.get(client.id);
    if (info) info.tournamentId = undefined;
  }

  // ─── Public: broadcast tournament update to all in room ───────────────────
  broadcastTournamentUpdate(tournamentId: string, data: Record<string, unknown>) {
    this.server.to(`tournament:${tournamentId}`).emit('tournament_update', data);
  }

  // ─── Public: notify a specific player about their game ───────────────────
  notifyPlayer(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
