import { pgTable, uuid, varchar, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  blitzRating: integer('blitz_rating').default(1200),
  rapidRating: integer('rapid_rating').default(1200),
  bulletRating: integer('bullet_rating').default(1200),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const friends = pgTable('friends', {
  user1Id: uuid('user_id_1').references(() => users.id),
  user2Id: uuid('user_id_2').references(() => users.id),
  status: varchar('status', { length: 50 }), // Pending, Accepted
}, (t) => ({
  pk: primaryKey({ columns: [t.user1Id, t.user2Id] }),
}));