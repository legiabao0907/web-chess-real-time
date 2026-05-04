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
import { ChatService } from './chat.service';
import { JoinRoomDto, SendDmDto, GetHistoryDto } from './dto/chat.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
  transports: ['websocket', 'polling'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Map socketId -> { userId, username }
  private clients = new Map<string, { userId: string; username: string }>();

  // Map userId -> Set<socketId> (user can have multiple tabs)
  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('💬 Chat WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Chat client connected: ${client.id}`);
    client.emit('chat_connected', { socketId: client.id });
  }

  async handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    if (info) {
      const sockets = this.userSockets.get(info.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(info.userId);
          // Notify friends user went offline
          this.broadcastUserStatus(info.userId, info.username, false);
        }
      }
      this.clients.delete(client.id);
    }
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  // ─── IDENTIFY: register this socket with a userId ─────────────────────────
  @SubscribeMessage('identify')
  async handleIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; username: string },
  ) {
    const { userId, username } = data;
    this.clients.set(client.id, { userId, username });

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    // Notify friends user is online
    this.broadcastUserStatus(userId, username, true);
    client.emit('identified', { userId, username });
    this.logger.log(`User ${username} (${userId}) identified on chat`);
  }

  // ─── JOIN ROOM: open DM with a friend ─────────────────────────────────────
  @SubscribeMessage('join_dm')
  async handleJoinDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    const { userId, username, friendId, friendUsername } = data;

    // Register identity if not done yet
    if (!this.clients.has(client.id)) {
      this.clients.set(client.id, { userId, username });
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
    }

    const roomId = await this.chatService.getOrCreatePrivateRoom(userId, friendId);
    await client.join(roomId);

    // Load history
    const history = await this.chatService.getMessages(roomId, 50);

    client.emit('dm_joined', {
      roomId,
      friendId,
      friendUsername,
      history,
    });

    this.logger.log(`User ${username} joined DM room ${roomId} with ${friendUsername}`);
  }

  // ─── SEND DM ───────────────────────────────────────────────────────────────
  @SubscribeMessage('send_dm')
  async handleSendDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendDmDto,
  ) {
    const { roomId, senderId, senderUsername, content } = data;

    if (!content?.trim()) return;

    const trimmed = content.trim().slice(0, 1000);
    const msg = await this.chatService.saveMessage(roomId, senderId, senderUsername, trimmed);

    // Broadcast to everyone in the room (both users)
    this.server.to(roomId).emit('dm_message', msg);

    this.logger.log(`[DM] ${senderUsername} in room ${roomId}: ${trimmed.substring(0, 50)}`);
  }

  // ─── GET HISTORY ──────────────────────────────────────────────────────────
  @SubscribeMessage('get_dm_history')
  async handleGetHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GetHistoryDto,
  ) {
    const { roomId, limit = 50 } = data;
    const history = await this.chatService.getMessages(roomId, limit);
    client.emit('dm_history', { roomId, history });
  }

  // ─── TYPING INDICATOR ─────────────────────────────────────────────────────
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; username: string; isTyping: boolean },
  ) {
    client.to(data.roomId).emit('user_typing', {
      userId: data.userId,
      username: data.username,
      isTyping: data.isTyping,
    });
  }

  // ─── HELPER: broadcast online/offline status ───────────────────────────────
  private broadcastUserStatus(userId: string, username: string, isOnline: boolean) {
    // Notify all connected sockets about status change
    this.server.emit('user_status', { userId, username, isOnline });
  }

  // ─── Public method: emit to a specific user by userId ─────────────────────
  emitToUser(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
