import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, desc } from 'drizzle-orm';
import * as schema from '../drizzle/schema/schema';
import { chatRooms, chatRoomMembers, messages } from '../drizzle/schema/chat.schema';
import { REDIS_CLIENT } from '../redis/redis.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { ChatMessage } from './dto/chat.dto';

const CACHE_MAX_MESSAGES = 50;
const CACHE_TTL_SECONDS = 3600;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private roomCacheKey(roomId: string) {
    return `chat:room:${roomId}:messages`;
  }

  // ─── Get or create private DM room between two users ──────────────────────
  async getOrCreatePrivateRoom(user1Id: string, user2Id: string): Promise<string> {
    // Find existing private room shared by both users
    const memberships1 = await this.db
      .select({ roomId: chatRoomMembers.roomId })
      .from(chatRoomMembers)
      .where(eq(chatRoomMembers.userId, user1Id));

    const roomIds1 = memberships1.map((m) => m.roomId).filter(Boolean) as string[];

    if (roomIds1.length > 0) {
      const memberships2 = await this.db
        .select({ roomId: chatRoomMembers.roomId })
        .from(chatRoomMembers)
        .where(
          and(
            eq(chatRoomMembers.userId, user2Id),
            inArray(chatRoomMembers.roomId, roomIds1),
          ),
        );

      if (memberships2.length > 0) {
        // Verify it's a private room
        const roomId = memberships2[0].roomId as string;
        const [room] = await this.db
          .select()
          .from(chatRooms)
          .where(and(eq(chatRooms.id, roomId), eq(chatRooms.type, 'private')))
          .limit(1);

        if (room) return room.id;
      }
    }

    // Create new private room
    const [newRoom] = await this.db
      .insert(chatRooms)
      .values({ type: 'private', referenceId: null })
      .returning({ id: chatRooms.id });

    await this.db.insert(chatRoomMembers).values([
      { roomId: newRoom.id, userId: user1Id },
      { roomId: newRoom.id, userId: user2Id },
    ]);

    this.logger.log(`Created private room ${newRoom.id} for users ${user1Id} and ${user2Id}`);
    return newRoom.id;
  }

  // ─── Save message to DB + Redis cache ─────────────────────────────────────
  async saveMessage(
    roomId: string,
    senderId: string,
    senderUsername: string,
    content: string,
  ): Promise<ChatMessage> {
    const [saved] = await (this.db as any)
      .insert(messages)
      .values({ roomId, senderId, senderUsername, content })
      .returning();

    const msg: ChatMessage = {
      id: saved.id,
      roomId: saved.roomId!,
      senderId: saved.senderId!,
      senderUsername: saved.senderUsername,
      content: saved.content,
      createdAt: saved.createdAt ? new Date(saved.createdAt).getTime() : Date.now(),
    };

    // Push to Redis cache
    const cacheKey = this.roomCacheKey(roomId);
    await this.redis.rpush(cacheKey, JSON.stringify(msg));
    await this.redis.ltrim(cacheKey, -CACHE_MAX_MESSAGES, -1); // Keep last 50
    await this.redis.expire(cacheKey, CACHE_TTL_SECONDS);

    return msg;
  }

  // ─── Get messages for a room (Redis first, fallback to DB) ────────────────
  async getMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
    const cacheKey = this.roomCacheKey(roomId);
    const cached = await this.redis.lrange(cacheKey, -limit, -1);

    if (cached.length > 0) {
      return cached.map((raw) => JSON.parse(raw) as ChatMessage);
    }

    // Fallback: load from DB
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    const result: ChatMessage[] = rows.reverse().map((r) => ({
      id: r.id,
      roomId: r.roomId!,
      senderId: r.senderId!,
      senderUsername: r.senderUsername,
      content: r.content,
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    }));

    // Warm cache
    if (result.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const msg of result) {
        pipeline.rpush(cacheKey, JSON.stringify(msg));
      }
      pipeline.expire(cacheKey, CACHE_TTL_SECONDS);
      await pipeline.exec();
    }

    return result;
  }

  // ─── Get user's chat rooms ─────────────────────────────────────────────────
  async getUserRooms(userId: string) {
    const memberships = await this.db
      .select({ roomId: chatRoomMembers.roomId })
      .from(chatRoomMembers)
      .where(eq(chatRoomMembers.userId, userId));

    return memberships.map((m) => m.roomId).filter(Boolean) as string[];
  }
}
