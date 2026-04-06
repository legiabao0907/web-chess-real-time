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
import { GameService } from './game.service';
import {
  CreateGameDto,
  JoinGameDto,
  MakeMoveDto,
  MatchmakingEntry,
} from './dto/game.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chess',
  transports: ['websocket', 'polling'],
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // Map socketId -> { userId, gameId, timeControl }
  private connectedClients = new Map<
    string,
    { userId: string; gameId?: string; timeControl?: string; username: string }
  >();

  constructor(private readonly gameService: GameService) {}

  afterInit(server: Server) {
    this.logger.log('🎮 Chess WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { socketId: client.id, message: 'Connected to Chess Gateway' });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const info = this.connectedClients.get(client.id);

    if (info) {
      // Leave matchmaking queue if in one
      if (info.timeControl && !info.gameId) {
        await this.gameService.leaveQueue(info.userId, info.timeControl);
        this.logger.log(`User ${info.userId} removed from ${info.timeControl} queue`);
      }

      // Handle mid-game disconnect (optional: auto-resign after grace period)
      if (info.gameId) {
        const game = await this.gameService.getGame(info.gameId);
        if (game && game.status === 'active') {
          // Notify opponent of disconnect
          client.to(info.gameId).emit('opponent_disconnected', {
            gameId: info.gameId,
            message: 'Opponent disconnected',
          });
        }
      }

      this.connectedClients.delete(client.id);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // MATCHMAKING
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('find_game')
  async handleFindGame(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { userId: string; username: string; timeControl: string; rating?: number },
  ) {
    const { userId, username, timeControl, rating = 1200 } = data;

    if (!userId || !timeControl) {
      client.emit('error', { message: 'userId and timeControl required' });
      return;
    }

    // Track this client
    this.connectedClients.set(client.id, { userId, username, timeControl });

    const entry: MatchmakingEntry = {
      userId,
      username,
      socketId: client.id,
      timeControl,
      rating,
      joinedAt: Date.now(),
    };

    this.logger.log(`User ${username} searching for ${timeControl} game`);
    client.emit('searching', { timeControl, message: 'Looking for opponent...' });

    const opponent = await this.gameService.joinQueue(entry);

    if (opponent) {
      // Match found! Create game
      const gameId = this.gameService.generateGameId();

      // Randomly assign colors
      const whiteIsRequester = Math.random() > 0.5;
      const white = whiteIsRequester ? entry : opponent;
      const black = whiteIsRequester ? opponent : entry;

      const gameState = this.gameService.createGameState(
        gameId,
        { userId: white.userId, username: white.username },
        { userId: black.userId, username: black.username },
        timeControl,
      );

      await this.gameService.saveGame(gameState);
      await this.gameService.setUserCurrentGame(white.userId, gameId);
      await this.gameService.setUserCurrentGame(black.userId, gameId);

      // Update client tracking
      const clientInfo = this.connectedClients.get(client.id);
      if (clientInfo) {
        clientInfo.gameId = gameId;
        clientInfo.timeControl = undefined; // no longer in queue
      }

      // Both clients join the game room
      client.join(gameId);

      // Find opponent's socket and join them to the room
      const opponentSocket = this.server.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) {
        opponentSocket.join(gameId);
        const opponentInfo = this.connectedClients.get(opponent.socketId);
        if (opponentInfo) {
          opponentInfo.gameId = gameId;
          opponentInfo.timeControl = undefined;
        }
      }

      // Emit game_start to both
      this.server.to(gameId).emit('game_start', {
        gameId,
        fen: gameState.fen,
        whiteId: gameState.whiteId,
        blackId: gameState.blackId,
        whiteUsername: gameState.whiteUsername,
        blackUsername: gameState.blackUsername,
        timeControl: gameState.timeControl,
        whiteTimeMs: gameState.whiteTimeMs,
        blackTimeMs: gameState.blackTimeMs,
        turn: gameState.turn,
      });

      this.logger.log(
        `Game ${gameId} started: ${white.username}(W) vs ${black.username}(B)`,
      );
    } else {
      // Added to queue, waiting
    }
  }

  @SubscribeMessage('cancel_search')
  async handleCancelSearch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; timeControl: string },
  ) {
    await this.gameService.leaveQueue(data.userId, data.timeControl);
    const info = this.connectedClients.get(client.id);
    if (info) info.timeControl = undefined;
    client.emit('search_cancelled', { message: 'Search cancelled' });
  }

  // ──────────────────────────────────────────────────────────────────────
  // JOIN EXISTING GAME (reconnect)
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('join_game')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinGameDto,
  ) {
    const { gameId, userId, username } = data;
    const game = await this.gameService.getGame(gameId);

    if (!game) {
      client.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.whiteId !== userId && game.blackId !== userId) {
      client.emit('error', { message: 'You are not a player in this game' });
      return;
    }

    client.join(gameId);
    this.connectedClients.set(client.id, { userId, username, gameId });

    client.emit('game_state', {
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
      winner: game.winner,
    });

    this.logger.log(`User ${username} rejoined game ${gameId}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // MAKE MOVE
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('make_move')
  async handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MakeMoveDto,
  ) {
    const { gameId, userId, move } = data;

    const result = await this.gameService.processMove(gameId, userId, move);

    if (!result.success || !result.game) {
      client.emit('move_error', { error: result.error ?? 'Invalid move' });
      return;
    }

    const game = result.game;

    // Broadcast updated state to both players
    const moveUpdate = {
      gameId,
      fen: game.fen,
      pgn: game.pgn,
      move,
      moveHistory: game.moveHistory,
      turn: game.turn,
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      status: game.status,
      winner: game.winner ?? null,
      lastMove: move,
    };

    this.server.to(gameId).emit('move_made', moveUpdate);

    // If game is over, emit game_over
    if (game.status !== 'active') {
      this.server.to(gameId).emit('game_over', {
        gameId,
        status: game.status,
        winner: game.winner,
        pgn: game.pgn,
        message: this.getGameOverMessage(game.status, game.winner),
      });

      // Cleanup user game tracking
      await this.gameService.clearUserCurrentGame(game.whiteId);
      await this.gameService.clearUserCurrentGame(game.blackId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // RESIGN
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('resign')
  async handleResign(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    const { gameId, userId } = data;
    const game = await this.gameService.resign(gameId, userId);

    if (!game) {
      client.emit('error', { message: 'Cannot resign this game' });
      return;
    }

    this.server.to(gameId).emit('game_over', {
      gameId,
      status: 'resigned',
      winner: game.winner,
      message: `${userId === game.whiteId ? game.whiteUsername : game.blackUsername} resigned`,
    });

    await this.gameService.clearUserCurrentGame(game.whiteId);
    await this.gameService.clearUserCurrentGame(game.blackId);
  }

  // ──────────────────────────────────────────────────────────────────────
  // DRAW OFFER
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('offer_draw')
  async handleOfferDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    const { gameId, userId } = data;
    const drawAccepted = await this.gameService.offerDraw(gameId, userId);

    if (drawAccepted) {
      const game = await this.gameService.acceptDraw(gameId);
      if (game) {
        this.server.to(gameId).emit('game_over', {
          gameId,
          status: 'draw',
          winner: 'draw',
          message: 'Draw agreed by both players',
        });
        await this.gameService.clearUserCurrentGame(game.whiteId);
        await this.gameService.clearUserCurrentGame(game.blackId);
      }
    } else {
      // Notify opponent of draw offer
      client.to(gameId).emit('draw_offered', {
        gameId,
        fromUserId: userId,
        message: 'Opponent offers draw',
      });
      client.emit('draw_offer_sent', { message: 'Draw offer sent to opponent' });
    }
  }

  @SubscribeMessage('accept_draw')
  async handleAcceptDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    const { gameId } = data;
    const game = await this.gameService.acceptDraw(gameId);

    if (game) {
      this.server.to(gameId).emit('game_over', {
        gameId,
        status: 'draw',
        winner: 'draw',
        message: 'Draw agreed',
      });
      await this.gameService.clearUserCurrentGame(game.whiteId);
      await this.gameService.clearUserCurrentGame(game.blackId);
    }
  }

  @SubscribeMessage('decline_draw')
  handleDeclineDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    client.to(data.gameId).emit('draw_declined', { message: 'Opponent declined draw offer' });
  }

  // ──────────────────────────────────────────────────────────────────────
  // CHAT (in-game)
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { gameId: string; userId: string; username: string; message: string },
  ) {
    const { gameId, userId, username, message } = data;
    if (!message?.trim()) return;

    this.server.to(gameId).emit('chat_message', {
      userId,
      username,
      message: message.trim().slice(0, 500),
      timestamp: Date.now(),
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────

  private getGameOverMessage(
    status: string,
    winner?: string,
  ): string {
    switch (status) {
      case 'finished':
        return winner === 'draw'
          ? 'Draw by stalemate/insufficient material'
          : `${winner === 'white' ? 'White' : 'Black'} wins by checkmate!`;
      case 'resigned':
        return `${winner === 'white' ? 'White' : 'Black'} wins by resignation`;
      case 'draw':
        return 'Game drawn';
      default:
        return 'Game over';
    }
  }
}
