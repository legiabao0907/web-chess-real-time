import { pgTable, uuid, varchar, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const chatRooms = pgTable('chat_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }), // 'private', 'game'
  referenceId: uuid('reference_id'),      // friendId or gameId
  createdAt: timestamp('created_at').defaultNow(),
});

export const chatRoomMembers = pgTable('chat_room_members', {
  roomId: uuid('room_id').references(() => chatRooms.id),
  userId: uuid('user_id').references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.roomId, t.userId] }),
}));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').references(() => chatRooms.id),
  senderId: uuid('sender_id').references(() => users.id),
  senderUsername: varchar('sender_username', { length: 255 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});