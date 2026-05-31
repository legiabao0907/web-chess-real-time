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
import { Inject, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JoinRoomDto, SendDmDto, GetHistoryDto } from './dto/chat.dto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/** Redis Hash lưu userId -> socketId để định tuyến DM trực tiếp */
const ONLINE_USERS_KEY = 'chess:online_users';

@WebSocketGateway({
  cors: {
    origin: true,
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

  // Map userId -> Set<socketId> (user có thể có nhiều tab)
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  afterInit(server: Server) {
    this.logger.log('💬 Chat WebSocket Gateway initialized');
  }

  // ─── KẾT NỐI: chỉ log, chờ identify để biết userId ─────────────────────
  async handleConnection(client: Socket) {
    this.logger.log(`Chat client connected: ${client.id}`);
    client.emit('chat_connected', { socketId: client.id });
  }

  // ─── NGẮT KẾT NỐI: dọn dẹp memory + Redis ───────────────────────────────
  async handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    if (info) {
      const sockets = this.userSockets.get(info.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(info.userId);
          // Xóa khỏi Redis Hash khi không còn tab nào online
          try {
            await this.redis.hdel(ONLINE_USERS_KEY, info.userId);
          } catch (err) {
            this.logger.error(`Failed to remove ${info.userId} from Redis: ${err}`);
          }
          this.broadcastUserStatus(info.userId, info.username, false);
        }
      }
      this.clients.delete(client.id);
    }
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  // ─── IDENTIFY: đăng ký socket với userId, lưu vào Redis ─────────────────
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

    // Lưu userId -> socketId vào Redis Hash (lấy socketId mới nhất)
    try {
      await this.redis.hset(ONLINE_USERS_KEY, userId, client.id);
    } catch (err) {
      this.logger.error(`Failed to save ${userId} to Redis online_users: ${err}`);
    }

    // Thông báo online cho bạn bè
    this.broadcastUserStatus(userId, username, true);
    client.emit('identified', { userId, username });
    this.logger.log(`User ${username} (${userId}) identified on chat`);
  }

  // ─── JOIN ROOM: mở DM với bạn bè (room-based, lấy lịch sử) ─────────────
  @SubscribeMessage('join_dm')
  async handleJoinDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    const { userId, username, friendId, friendUsername } = data;

    // Đăng ký identity nếu chưa có
    if (!this.clients.has(client.id)) {
      this.clients.set(client.id, { userId, username });
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      // Cũng lưu vào Redis
      try {
        await this.redis.hset(ONLINE_USERS_KEY, userId, client.id);
      } catch (err) {
        this.logger.error(`Redis hset failed in join_dm: ${err}`);
      }
    }

    const roomId = await this.chatService.getOrCreatePrivateRoom(userId, friendId);
    await client.join(roomId);

    // Tải lịch sử
    const history = await this.chatService.getMessages(roomId, 50);

    client.emit('dm_joined', {
      roomId,
      friendId,
      friendUsername,
      history,
    });

    this.logger.log(`User ${username} joined DM room ${roomId} with ${friendUsername}`);
  }

  // ─── SEND DM (room-based): gửi tin nhắn vào room ────────────────────────
  @SubscribeMessage('send_dm')
  async handleSendDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendDmDto,
  ) {
    const { roomId, senderId, senderUsername, content } = data;

    if (!content?.trim()) return;

    const trimmed = content.trim().slice(0, 1000);
    const msg = await this.chatService.saveMessage(roomId, senderId, senderUsername, trimmed);

    // Broadcast cho toàn bộ người trong room
    this.server.to(roomId).emit('dm_message', msg);

    this.logger.log(`[DM] ${senderUsername} in room ${roomId}: ${trimmed.substring(0, 50)}`);
  }

  // ─── SEND DIRECT MESSAGE (Redis-based routing): DM 1-1 trực tiếp ────────
  /**
   * Payload: { toUserId: string, message: string }
   * - Lấy fromUserId từ clients map (đã identify)
   * - Lưu tin nhắn vào DB qua chatService
   * - Tra cứu Redis Hash chess:online_users để tìm socketId của toUserId
   * - Emit receive_direct_message cho cả hai phía
   */
  @SubscribeMessage('send_direct_message')
  async handleSendDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; message: string },
  ) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) {
      client.emit('dm_error', { error: 'Bạn chưa được xác thực. Vui lòng identify trước.' });
      this.logger.warn(`Unauthenticated send_direct_message from socket ${client.id}`);
      return;
    }

    const { userId: fromUserId, username: fromUsername } = clientInfo;
    const { toUserId, message } = data;

    if (!message?.trim()) {
      client.emit('dm_error', { error: 'Tin nhắn không được để trống.' });
      return;
    }

    if (!toUserId) {
      client.emit('dm_error', { error: 'Thiếu toUserId.' });
      return;
    }

    const trimmedMsg = message.trim().slice(0, 1000);

    // 1. Lấy hoặc tạo private room giữa hai user
    let roomId: string;
    try {
      roomId = await this.chatService.getOrCreatePrivateRoom(fromUserId, toUserId);
    } catch (err) {
      this.logger.error(`getOrCreatePrivateRoom failed: ${err}`);
      client.emit('dm_error', { error: 'Không thể khởi tạo phòng chat. Vui lòng thử lại.' });
      return;
    }

    // 2. Lưu tin nhắn vào DB + Redis cache
    let savedMsg: Awaited<ReturnType<typeof this.chatService.saveMessage>>;
    try {
      savedMsg = await this.chatService.saveMessage(roomId, fromUserId, fromUsername, trimmedMsg);
    } catch (err) {
      this.logger.error(`saveMessage failed: ${err}`);
      client.emit('dm_error', { error: 'Không thể lưu tin nhắn. Vui lòng thử lại.' });
      return;
    }

    const payload = {
      fromUserId,
      fromUsername,
      toUserId,
      message: trimmedMsg,
      roomId,
      messageId: savedMsg.id,
      createdAt: savedMsg.createdAt,
    };

    // 3. Tra cứu Redis Hash để tìm socketId của người nhận
    let targetSocketId: string | null = null;
    try {
      targetSocketId = await this.redis.hget(ONLINE_USERS_KEY, toUserId);
    } catch (err) {
      this.logger.error(`Redis hget failed for toUserId=${toUserId}: ${err}`);
      // Không return ở đây — vẫn emit cho sender, chỉ skip emit cho receiver
    }

    if (targetSocketId) {
      // Kiểm tra socket còn tồn tại trong server
      const targetSocket = this.server.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        this.server.to(targetSocketId).emit('receive_direct_message', payload);
        this.logger.log(`[Direct DM] ${fromUsername} -> ${toUserId} (socket: ${targetSocketId})`);
      } else {
        // Socket đã đóng nhưng Redis chưa kịp cập nhật — cleanup
        this.logger.warn(`Socket ${targetSocketId} for user ${toUserId} not found, cleaning Redis`);
        try {
          await this.redis.hdel(ONLINE_USERS_KEY, toUserId);
        } catch (_) {}
      }
    } else {
      this.logger.log(`User ${toUserId} is offline — message saved to DB for later retrieval`);
    }

    // 4. Emit ngược lại cho chính người gửi (đồng bộ UI)
    // Tìm tất cả socket của fromUserId (multi-tab support)
    const senderSockets = this.userSockets.get(fromUserId);
    if (senderSockets) {
      for (const sid of senderSockets) {
        this.server.to(sid).emit('receive_direct_message', payload);
      }
    }
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
    this.server.emit('user_status', { userId, username, isOnline });
  }

  // ─── Public method: emit đến một userId cụ thể (dùng cho module khác) ────
  emitToUser(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
