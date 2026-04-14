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
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardCategory } from './dto/leaderboard.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/leaderboard',
  transports: ['websocket', 'polling'],
})
export class LeaderboardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LeaderboardGateway.name);

  // Map: socketId -> category (which room the client is watching)
  private subscribedClients = new Map<string, LeaderboardCategory>();

  constructor(private readonly leaderboardService: LeaderboardService) {}

  afterInit() {
    this.logger.log('🏆 Leaderboard WebSocket Gateway initialized');
    // Seed demo data on startup
    this.leaderboardService.seedDemoData().catch((e) =>
      this.logger.error('Failed to seed leaderboard data', e),
    );
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Leaderboard client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.subscribedClients.delete(client.id);
    this.logger.log(`Leaderboard client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to a specific leaderboard category.
   * Emits initial data immediately, then receives live updates.
   */
  @SubscribeMessage('subscribe_leaderboard')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { category: LeaderboardCategory; limit?: number },
  ) {
    const { category, limit = 50 } = data;

    // Leave previous category room if in one
    const prev = this.subscribedClients.get(client.id);
    if (prev) {
      await client.leave(`leaderboard:${prev}`);
    }

    // Join new category room
    await client.join(`leaderboard:${category}`);
    this.subscribedClients.set(client.id, category);

    // Emit current leaderboard immediately
    const leaderboard = await this.leaderboardService.getTopPlayers(category, limit);
    client.emit('leaderboard_data', leaderboard);

    this.logger.log(`Client ${client.id} subscribed to ${category} leaderboard`);
  }

  /**
   * Client unsubscribes from a category.
   */
  @SubscribeMessage('unsubscribe_leaderboard')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { category: LeaderboardCategory },
  ) {
    await client.leave(`leaderboard:${data.category}`);
    this.subscribedClients.delete(client.id);
    this.logger.log(`Client ${client.id} unsubscribed from ${data.category}`);
  }

  /**
   * Request a fresh snapshot of a leaderboard.
   */
  @SubscribeMessage('request_leaderboard')
  async handleRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { category: LeaderboardCategory; limit?: number; offset?: number },
  ) {
    const { category, limit = 50, offset = 0 } = data;
    const leaderboard = await this.leaderboardService.getTopPlayers(category, limit, offset);
    client.emit('leaderboard_data', leaderboard);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Called internally (from GameGateway after game ends) to push updates
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Push leaderboard update to all subscribers of a category.
   * Called after any ELO change (game end, manual update, etc.).
   */
  async broadcastLeaderboard(category: LeaderboardCategory, limit = 50): Promise<void> {
    const leaderboard = await this.leaderboardService.getTopPlayers(category, limit);
    this.server.to(`leaderboard:${category}`).emit('leaderboard_data', leaderboard);
    this.logger.log(`Broadcasted ${category} leaderboard to ${leaderboard.entries.length} entries`);
  }

  /**
   * Trigger ELO update and broadcast to all listeners.
   * This is the main entry point to update ELO after a game ends.
   */
  async triggerEloUpdate(params: {
    winnerId: string;
    winnerUsername: string;
    loserId: string;
    loserUsername: string;
    winnerElo: number;
    loserElo: number;
    isDraw: boolean;
    category: LeaderboardCategory;
  }): Promise<void> {
    const { winnerId, winnerUsername, loserId, loserUsername, winnerElo, loserElo, isDraw, category } = params;

    // ELO calculation (standard formula)
    const K = 32; // K-factor
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

    const winnerScore = isDraw ? 0.5 : 1;
    const loserScore = isDraw ? 0.5 : 0;

    const winnerChange = Math.round(K * (winnerScore - expectedWinner));
    const loserChange = Math.round(K * (loserScore - expectedLoser));

    // Update winner
    await this.leaderboardService.updateElo({
      userId: winnerId,
      username: winnerUsername,
      category,
      newElo: Math.max(100, winnerElo + winnerChange),
      eloDelta: winnerChange,
      wins: isDraw ? 0 : 1,
      losses: 0,
      draws: isDraw ? 1 : 0,
    });

    // Update loser
    await this.leaderboardService.updateElo({
      userId: loserId,
      username: loserUsername,
      category,
      newElo: Math.max(100, loserElo + loserChange),
      eloDelta: loserChange,
      wins: 0,
      losses: isDraw ? 0 : 1,
      draws: isDraw ? 1 : 0,
    });

    // Broadcast updated leaderboard to all subscribers
    await this.broadcastLeaderboard(category);

    this.logger.log(
      `ELO updated: ${winnerUsername} ${winnerElo}->${winnerElo + winnerChange} | ${loserUsername} ${loserElo}->${loserElo + loserChange}`,
    );
  }
}
