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
import { Logger, Optional } from '@nestjs/common';
import { GameService } from './game.service';
import {
  CreateGameDto,
  JoinGameDto,
  MakeMoveDto,
  MatchmakingEntry,
  GameState,
  StartBotGameDto,
  BOT_USER_ID,
  BOT_USERNAME,
} from './dto/game.dto';
import { LeaderboardGateway } from '../leaderboard/leaderboard.gateway';
import { LeaderboardCategory } from '../leaderboard/dto/leaderboard.dto';
import { WatchGateway } from '../watch/watch.gateway';
import { TournamentService } from '../tournament/tournament.service';
import { TournamentGateway } from '../tournament/tournament.gateway';
import { AiService, Difficulty } from '../ai/ai.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/chess',
  transports: ['websocket', 'polling'],
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // Map socketId -> { userId, gameId, timeControl, username }
  private connectedClients = new Map<
    string,
    { userId: string; gameId?: string; timeControl?: string; username: string }
  >();

  constructor(
    private readonly gameService: GameService,
    private readonly aiService: AiService,
    @Optional() private readonly leaderboardGateway: LeaderboardGateway,
    @Optional() private readonly watchGateway: WatchGateway,
    @Optional() private readonly tournamentService: TournamentService,
    @Optional() private readonly tournamentGateway: TournamentGateway,
  ) { }

  afterInit(server: Server) {
    this.logger.log('🎮 Chess WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { socketId: client.id, message: 'Connected to Chess Gateway' });
  }

  @SubscribeMessage('reconnect_check')
  async handleReconnectCheck(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; username: string },
  ) {
    const { userId, username } = data;
    if (!userId) return;

    this.connectedClients.set(client.id, { userId, username });

    const gameId = await this.gameService.getUserCurrentGame(userId);
    if (gameId) {
      this.logger.log(`User ${userId} reclaiming active game ${gameId}`);
      const game = await this.gameService.getGame(gameId);
      if (game && game.status === 'active') {
        await client.join(gameId);
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
          lastMoveAt: game.lastMoveAt,
          isBot: game.isBot,
          botDifficulty: game.botDifficulty,
          botColor: game.botColor,
        });
      }
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const info = this.connectedClients.get(client.id);

    if (info) {
      if (info.timeControl && !info.gameId) {
        await this.gameService.leaveQueue(info.userId, info.timeControl);
        this.logger.log(`User ${info.userId} removed from ${info.timeControl} queue`);
      }

      if (info.gameId) {
        const game = await this.gameService.getGame(info.gameId);
        if (game && game.status === 'active' && !game.isBot) {
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
      const gameId = this.gameService.generateGameId();

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

      const clientInfo = this.connectedClients.get(client.id);
      if (clientInfo) {
        clientInfo.gameId = gameId;
        clientInfo.timeControl = undefined;
      }

      await client.join(gameId);

      const opponentSocketId = opponent.socketId;
      const opponentSocket = (this.server.sockets as any).get(opponentSocketId);

      if (opponentSocket) {
        await opponentSocket.join(gameId);
        const opponentInfo = this.connectedClients.get(opponentSocketId);
        if (opponentInfo) {
          opponentInfo.gameId = gameId;
          opponentInfo.timeControl = undefined;
        }
      } else {
        this.logger.warn(`Opponent socket ${opponentSocketId} not found in this instance`);
      }

      const gameStartData = {
        gameId: gameState.id,
        fen: gameState.fen,
        pgn: gameState.pgn,
        whiteId: gameState.whiteId,
        blackId: gameState.blackId,
        whiteUsername: gameState.whiteUsername,
        blackUsername: gameState.blackUsername,
        status: gameState.status,
        timeControl: gameState.timeControl,
        whiteTimeMs: gameState.whiteTimeMs,
        blackTimeMs: gameState.blackTimeMs,
        turn: gameState.turn,
        moveHistory: gameState.moveHistory,
        lastMoveAt: gameState.lastMoveAt,
      };

      this.server.to(gameId).emit('game_start', gameStartData);

      this.logger.log(
        `Game ${gameId} started: ${white.username}(W) vs ${black.username}(B)`,
      );
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
  // BOT GAME
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('start_bot_game')
  async handleStartBotGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartBotGameDto,
  ) {
    const { userId, username, difficulty, side = 'white', timeControl = 'blitz_5' } = data;

    if (!userId) {
      client.emit('error', { message: 'userId required' });
      return;
    }

    // If user already has an active game, clear it
    const existingGameId = await this.gameService.getUserCurrentGame(userId);
    if (existingGameId) {
      await this.gameService.clearUserCurrentGame(userId);
    }

    const gameId = this.gameService.generateGameId();
    const botColor: 'w' | 'b' = side === 'white' ? 'b' : 'w';

    const white = side === 'white'
      ? { userId, username }
      : { userId: BOT_USER_ID, username: `${BOT_USERNAME} (${difficulty})` };
    const black = side === 'white'
      ? { userId: BOT_USER_ID, username: `${BOT_USERNAME} (${difficulty})` }
      : { userId, username };

    const gameState = this.gameService.createGameState(
      gameId,
      white,
      black,
      timeControl,
    );

    // Mark as bot game
    gameState.isBot = true;
    gameState.botDifficulty = difficulty;
    gameState.botColor = botColor;

    await this.gameService.saveGame(gameState);
    await this.gameService.setUserCurrentGame(userId, gameId);

    this.connectedClients.set(client.id, { userId, username, gameId });
    await client.join(gameId);

    const gameStartData = {
      gameId: gameState.id,
      fen: gameState.fen,
      pgn: gameState.pgn,
      whiteId: gameState.whiteId,
      blackId: gameState.blackId,
      whiteUsername: gameState.whiteUsername,
      blackUsername: gameState.blackUsername,
      status: gameState.status,
      timeControl: gameState.timeControl,
      whiteTimeMs: gameState.whiteTimeMs,
      blackTimeMs: gameState.blackTimeMs,
      turn: gameState.turn,
      moveHistory: gameState.moveHistory,
      lastMoveAt: gameState.lastMoveAt,
      isBot: true,
      botDifficulty: difficulty,
      botColor,
    };

    client.emit('bot_game_start', gameStartData);

    // If bot plays white, make the first move
    if (botColor === 'w') {
      setTimeout(() => this.triggerBotMove(gameId, client), 600);
    }

    this.logger.log(`Bot game ${gameId} started for ${username} (difficulty: ${difficulty}, player side: ${side})`);
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
      lastMoveAt: game.lastMoveAt,
      isBot: game.isBot,
      botDifficulty: game.botDifficulty,
      botColor: game.botColor,
      tournamentId: (game as any).tournamentId,
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
      lastMoveAt: game.lastMoveAt,
      isBot: game.isBot,
    };

    this.server.to(gameId).emit('move_made', moveUpdate);

    if (this.watchGateway) {
      this.watchGateway.broadcastGameUpdate(gameId, moveUpdate);
    }

    if (game.status !== 'active') {
      await this.handleGameOver(gameId, game, client);
      return;
    }

    // If this is a bot game and it's now the bot's turn, trigger bot move
    if (game.isBot && game.turn === game.botColor) {
      const delay = this.getBotDelay(game.botDifficulty ?? 'medium');
      setTimeout(() => this.triggerBotMove(gameId, client), delay);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // POSITION ANALYSIS
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('analyze_position')
  async handleAnalyzePosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { fen: string; gameId?: string },
  ) {
    try {
      const { fen } = data;
      const score = this.aiService.evaluatePosition(fen);

      // Get best move suggestion at depth 4
      const Chess = (await import('chess.js')).Chess;
      const chess = new Chess(fen);
      let bestMove: { from: string; to: string } | null = null;

      if (!chess.isGameOver()) {
        bestMove = this.aiService.getBestMove(fen, 'hard', chess.turn() as 'w' | 'b');
      }

      client.emit('position_analysis', {
        fen,
        score,         // centipawns, white-positive
        bestMove,
        isGameOver: chess.isGameOver(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
      });
    } catch (err) {
      this.logger.error('Analysis error:', err);
      client.emit('position_analysis', { fen: data.fen, score: 0, bestMove: null });
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

    // Calculate ELO changes BEFORE emitting game_over
    let eloResult: any = null;
    if (!game.isBot) {
      eloResult = await this.triggerLeaderboardUpdate(game);
    }

    const resignData: any = {
      gameId,
      status: 'resigned',
      winner: game.winner,
      message: `${userId === game.whiteId ? game.whiteUsername : game.blackUsername} resigned`,
    };

    if (eloResult) {
      resignData.whiteEloChange = eloResult.whiteChange;
      resignData.blackEloChange = eloResult.blackChange;
      resignData.whiteNewElo = eloResult.whiteNewElo;
      resignData.blackNewElo = eloResult.blackNewElo;
    }

    this.server.to(gameId).emit('game_over', resignData);

    if (this.watchGateway) {
      this.watchGateway.broadcastGameOver(gameId, resignData);
    }

    // Persist to DB FIRST before clearing Redis
    this.logger.log(`[handleResign] Saving resigned game ${gameId} to DB. Winner: ${game.winner}`);
    await this.gameService.saveGameToDb(gameId);

    await this.gameService.clearUserCurrentGame(game.whiteId);
    if (!game.isBot) await this.gameService.clearUserCurrentGame(game.blackId);

    if (!game.isBot) {
      await this.recordTournamentGameResult(gameId, game);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // CLAIM TIMEOUT (frontend clock hit 0)
  // ──────────────────────────────────────────────────────────────────────

  @SubscribeMessage('claim_timeout')
  async handleClaimTimeout(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    const { gameId, userId } = data;
    const game = await this.gameService.getGame(gameId);

    if (!game || game.status !== 'active') return;

    // Verify the claimer is a player in this game
    if (game.whiteId !== userId && game.blackId !== userId) return;

    const now = Date.now();
    const elapsed = game.lastMoveAt ? now - game.lastMoveAt : 0;

    // Determine whose clock is out: the side whose turn it is has been running
    const isWhiteTurn = game.turn === 'w';

    let loserColor: 'white' | 'black';
    let winner: 'white' | 'black';

    if (isWhiteTurn) {
      const remainingWhite = game.whiteTimeMs - elapsed;
      if (remainingWhite > 2000) {
        // More than 2 seconds left — bogus claim, ignore
        return;
      }
      loserColor = 'white';
      winner = 'black';
      game.whiteTimeMs = 0;
    } else {
      const remainingBlack = game.blackTimeMs - elapsed;
      if (remainingBlack > 2000) {
        return;
      }
      loserColor = 'black';
      winner = 'white';
      game.blackTimeMs = 0;
    }

    game.status = 'finished';
    game.winner = winner;
    await this.gameService.saveGame(game);

    this.logger.log(`Game ${gameId}: ${loserColor} flagged on time. Winner: ${winner}`);
    await this.handleGameOver(gameId, game, client);
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
    const game = await this.gameService.getGame(gameId);

    // Bot always declines draw
    if (game?.isBot) {
      client.emit('draw_declined', { message: 'The bot declines the draw offer.' });
      return;
    }

    const drawAccepted = await this.gameService.offerDraw(gameId, userId);

    if (drawAccepted) {
      const updatedGame = await this.gameService.acceptDraw(gameId);
      if (updatedGame) {
        // Calculate ELO change for draw
        let eloResult: any = null;
        if (!updatedGame.isBot) {
          eloResult = await this.triggerLeaderboardUpdate(updatedGame);
        }

        const drawData: any = {
          gameId,
          status: 'draw',
          winner: 'draw',
          message: 'Draw agreed by both players',
        };
        if (eloResult) {
          drawData.whiteEloChange = eloResult.whiteChange;
          drawData.blackEloChange = eloResult.blackChange;
          drawData.whiteNewElo = eloResult.whiteNewElo;
          drawData.blackNewElo = eloResult.blackNewElo;
        }

        this.server.to(gameId).emit('game_over', drawData);
        await this.gameService.clearUserCurrentGame(updatedGame.whiteId);
        await this.gameService.clearUserCurrentGame(updatedGame.blackId);
        await this.gameService.saveGameToDb(gameId);
      }
    } else {
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
      // Calculate ELO change for draw
      let eloResult: any = null;
      if (!game.isBot) {
        eloResult = await this.triggerLeaderboardUpdate(game);
      }

      const drawData: any = {
        gameId,
        status: 'draw',
        winner: 'draw',
        message: 'Draw agreed',
      };
      if (eloResult) {
        drawData.whiteEloChange = eloResult.whiteChange;
        drawData.blackEloChange = eloResult.blackChange;
        drawData.whiteNewElo = eloResult.whiteNewElo;
        drawData.blackNewElo = eloResult.blackNewElo;
      }

      this.server.to(gameId).emit('game_over', drawData);
      await this.gameService.clearUserCurrentGame(game.whiteId);
      await this.gameService.clearUserCurrentGame(game.blackId);
      await this.gameService.saveGameToDb(gameId);
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
  // Private Helpers
  // ──────────────────────────────────────────────────────────────────────

  /** Trigger the AI to make its move in a bot game */
  private async triggerBotMove(gameId: string, playerClient?: Socket) {
    const game = await this.gameService.getGame(gameId);
    if (!game || game.status !== 'active' || !game.isBot) return;
    if (game.turn !== game.botColor) return;

    const botMove = this.aiService.getBestMove(
      game.fen,
      (game.botDifficulty ?? 'medium') as Difficulty,
      game.botColor!,
    );

    if (!botMove) {
      this.logger.warn(`Bot has no legal moves in game ${gameId}`);
      return;
    }

    const result = await this.gameService.processMove(
      gameId,
      BOT_USER_ID,
      botMove,
    );

    if (!result.success || !result.game) {
      this.logger.error(`Bot move failed in game ${gameId}: ${result.error}`);
      return;
    }

    const updatedGame = result.game;
    const moveUpdate = {
      gameId,
      fen: updatedGame.fen,
      pgn: updatedGame.pgn,
      move: botMove,
      moveHistory: updatedGame.moveHistory,
      turn: updatedGame.turn,
      whiteTimeMs: updatedGame.whiteTimeMs,
      blackTimeMs: updatedGame.blackTimeMs,
      status: updatedGame.status,
      winner: updatedGame.winner ?? null,
      lastMove: botMove,
      lastMoveAt: updatedGame.lastMoveAt,
      isBot: true,
      isBotMove: true,
    };

    this.server.to(gameId).emit('move_made', moveUpdate);

    if (updatedGame.status !== 'active') {
      await this.handleGameOver(gameId, updatedGame, playerClient);
    }
  }

  /** Get thinking delay for bot based on difficulty */
  private getBotDelay(difficulty: string): number {
    switch (difficulty) {
      case 'easy': return 300 + Math.random() * 400;
      case 'medium': return 500 + Math.random() * 800;
      case 'hard': return 800 + Math.random() * 1200;
      default: return 600;
    }
  }

  /** Central game-over handler */
  private async handleGameOver(gameId: string, game: GameState, client?: Socket) {
    // Calculate ELO changes FIRST (before emitting game_over)
    let eloResult: { whiteChange: number; blackChange: number; whiteNewElo: number; blackNewElo: number } | null = null;
    if (!game.isBot) {
      eloResult = await this.triggerLeaderboardUpdate(game);
    }

    const gameOverData: any = {
      gameId,
      status: game.status,
      winner: game.winner,
      pgn: game.pgn,
      message: this.getGameOverMessage(game.status, game.winner),
    };

    // Attach ELO changes if available
    if (eloResult) {
      gameOverData.whiteEloChange = eloResult.whiteChange;
      gameOverData.blackEloChange = eloResult.blackChange;
      gameOverData.whiteNewElo = eloResult.whiteNewElo;
      gameOverData.blackNewElo = eloResult.blackNewElo;
    }

    this.server.to(gameId).emit('game_over', gameOverData);

    if (this.watchGateway) {
      this.watchGateway.broadcastGameOver(gameId, gameOverData);
    }

    // Persist to DB FIRST (before clearing Redis keys so data is still available)
    this.logger.log(`[handleGameOver] Saving game ${gameId} to DB. Status: ${game.status}, Winner: ${game.winner}`);
    await this.gameService.saveGameToDb(gameId);

    // Then clean up Redis user-game mappings
    await this.gameService.clearUserCurrentGame(game.whiteId);
    if (!game.isBot) {
      await this.gameService.clearUserCurrentGame(game.blackId);
      await this.recordTournamentGameResult(gameId, game);
    }
  }

  private async recordTournamentGameResult(gameId: string, game: GameState): Promise<void> {
    if (!this.tournamentService || !this.tournamentGateway) return;
    try {
      const info = await this.tournamentService.getTournamentGameInfo(gameId);
      if (!info) return;
      const result: 'white' | 'black' | 'draw' =
        game.winner === 'white' ? 'white' : game.winner === 'black' ? 'black' : 'draw';
      const round = await this.tournamentService.recordTournamentResult(
        info.tournamentId,
        gameId,
        result,
      );
      if (round) {
        const tournament = await this.tournamentService.getTournament(info.tournamentId);
        const rounds = await this.tournamentService.getTournamentRounds(info.tournamentId);
        this.tournamentGateway.broadcastTournamentUpdate(info.tournamentId, {
          type: 'game_result',
          tournament,
          rounds,
          gameId,
          result,
        });

        // Auto start next round if all games finished
        const allFinished = round.games.every((g: any) => g.status === 'finished');
        if (allFinished && tournament.status === 'ongoing') {
          if (round.round >= 7) {
            this.logger.log(`Tournament ${info.tournamentId} reached round 7. Finishing tournament.`);
            try {
              await this.tournamentService!.finishTournament(info.tournamentId, tournament.creatorId);
              const updatedT = await this.tournamentService!.getTournament(info.tournamentId);
              const updatedRounds = await this.tournamentService!.getTournamentRounds(info.tournamentId);
              this.tournamentGateway!.broadcastTournamentUpdate(info.tournamentId, {
                type: 'tournament_finished',
                tournament: updatedT,
                rounds: updatedRounds,
              });
            } catch (e: any) {
              this.logger.error(`Error auto-finishing tournament: ${e.message}`);
            }
          } else {
            this.logger.log(`All games in round ${round.round} finished. Auto-starting next round in 30s.`);
            
            // Broadcast countdown start to frontend
            const nextRoundAt = Date.now() + 30000;
            this.tournamentGateway!.setNextRoundTimer(info.tournamentId, nextRoundAt);
            this.tournamentGateway!.broadcastTournamentUpdate(info.tournamentId, {
              type: 'round_countdown',
              countdownMs: 30000,
            });

            setTimeout(async () => {
            try {
              this.tournamentGateway!.clearNextRoundTimer(info.tournamentId);
              const checkT = await this.tournamentService!.getTournament(info.tournamentId);
              if (checkT.status === 'ongoing') {
                const nextResult = await this.tournamentService!.nextRound(info.tournamentId);
                const updatedT = await this.tournamentService!.getTournament(info.tournamentId);
                const updatedRounds = await this.tournamentService!.getTournamentRounds(info.tournamentId);
                this.tournamentGateway!.broadcastTournamentUpdate(info.tournamentId, {
                  type: 'next_round',
                  tournament: updatedT,
                  rounds: updatedRounds,
                });
                
                if (nextResult.round) {
                  for (const g of nextResult.round.games) {
                    if (g.blackId !== 'BYE') {
                      this.tournamentGateway!.notifyPlayer(g.whiteId, 'tournament_game_ready', {
                        type: 'tournament_game_ready',
                        gameId: g.gameId,
                        tournamentId: info.tournamentId,
                        round: g.round,
                        yourColor: 'white',
                        opponentId: g.blackId,
                        opponentUsername: g.blackUsername,
                      });
                      this.tournamentGateway!.notifyPlayer(g.blackId, 'tournament_game_ready', {
                        type: 'tournament_game_ready',
                        gameId: g.gameId,
                        tournamentId: info.tournamentId,
                        round: g.round,
                        yourColor: 'black',
                        opponentId: g.whiteId,
                        opponentUsername: g.whiteUsername,
                      });
                    }
                  }
                }
              }
            } catch (e: any) {
              this.logger.error(`Auto next round error: ${e.message}`);
            }
          }, 30000);
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed to record tournament game result', err);
    }
  }

  private getGameOverMessage(status: string, winner?: string): string {
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

  private getCategory(timeControl: string): LeaderboardCategory {
    if (timeControl.startsWith('bullet')) return 'bullet';
    if (timeControl.startsWith('rapid')) return 'rapid';
    return 'blitz';
  }

  private async triggerLeaderboardUpdate(game: GameState): Promise<{
    whiteChange: number; blackChange: number;
    whiteNewElo: number; blackNewElo: number;
  } | null> {
    if (!this.leaderboardGateway) return null;
    try {
      const category = this.getCategory(game.timeControl);
      const isDraw = game.winner === 'draw';

      const [whiteLbRank, blackLbRank] = await Promise.all([
        this.leaderboardGateway['leaderboardService'].getPlayerRank(game.whiteId, category),
        this.leaderboardGateway['leaderboardService'].getPlayerRank(game.blackId, category),
      ]);

      const whiteElo = whiteLbRank.elo ?? 1200;
      const blackElo = blackLbRank.elo ?? 1200;

      const winnerId = isDraw ? game.whiteId : (game.winner === 'white' ? game.whiteId : game.blackId);
      const loserId = isDraw ? game.blackId : (game.winner === 'white' ? game.blackId : game.whiteId);
      const winnerName = isDraw ? game.whiteUsername : (game.winner === 'white' ? game.whiteUsername : game.blackUsername);
      const loserName = isDraw ? game.blackUsername : (game.winner === 'white' ? game.blackUsername : game.whiteUsername);
      const winnerElo = isDraw ? whiteElo : (game.winner === 'white' ? whiteElo : blackElo);
      const loserElo = isDraw ? blackElo : (game.winner === 'white' ? blackElo : whiteElo);

      const result = await this.leaderboardGateway.triggerEloUpdate({
        winnerId,
        winnerUsername: winnerName,
        loserId,
        loserUsername: loserName,
        winnerElo,
        loserElo,
        isDraw,
        category,
      });

      // Map winner/loser changes back to white/black
      const isWhiteWinner = game.winner === 'white';
      return {
        whiteChange: isDraw ? result.winnerChange : (isWhiteWinner ? result.winnerChange : result.loserChange),
        blackChange: isDraw ? result.loserChange : (isWhiteWinner ? result.loserChange : result.winnerChange),
        whiteNewElo: isDraw ? result.winnerNewElo : (isWhiteWinner ? result.winnerNewElo : result.loserNewElo),
        blackNewElo: isDraw ? result.loserNewElo : (isWhiteWinner ? result.loserNewElo : result.winnerNewElo),
      };
    } catch (err) {
      this.logger.error('Failed to update leaderboard after game', err);
      return null;
    }
  }
}
