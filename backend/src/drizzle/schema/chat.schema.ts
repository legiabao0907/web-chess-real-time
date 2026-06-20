import { pgTable, uuid, varchar, text, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const chatRooms = pgTable('chat_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }), // 'private', 'game'
  referenceId: uuid('reference_id'),      // friendId or gameId
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  // HIGH: Lookup by reference
  referenceIdIdx: index('idx_chat_rooms_reference_id').on(t.referenceId),
  // MEDIUM: Composite lookup
  typeRefIdx: index('idx_chat_rooms_type_ref').on(t.type, t.referenceId),
}));

export const chatRoomMembers = pgTable('chat_room_members', {
  roomId: uuid('room_id').references(() => chatRooms.id),
  userId: uuid('user_id').references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.roomId, t.userId] }),
  // CRITICAL: FK index for finding rooms of a user
  userIdIdx: index('idx_chat_room_members_user_id').on(t.userId),
}));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').references(() => chatRooms.id),
  senderId: uuid('sender_id').references(() => users.id),
  senderUsername: varchar('sender_username', { length: 255 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  // CRITICAL: FK indexes
  roomIdIdx: index('idx_messages_room_id').on(t.roomId),
  senderIdIdx: index('idx_messages_sender_id').on(t.senderId),
  // HIGH: Sort by time
  createdAtIdx: index('idx_messages_created_at').on(t.createdAt),
  // MEDIUM: Load chat history (most important composite index)
  roomCreatedIdx: index('idx_messages_room_created').on(t.roomId, t.createdAt),
}));