import {  jsonb, pgTable, serial, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { relations } from 'drizzle-orm';

export const profileInfo = pgTable('profileInfo', {
  id: serial('id').primaryKey(),
  metadata: jsonb('metadata'),
  userId: uuid('userId')
    .references(() => users.id)
    .notNull(),
}, (t) => ({
  // CRITICAL: Unique index (1 user = 1 profile) + fast lookup
  userIdUniqIdx: uniqueIndex('idx_profileinfo_user_id').on(t.userId),
}));

export const profileInfoRelations = relations(profileInfo, ({ one }) => ({
  user: one(users, {
    fields: [profileInfo.userId],
    references: [users.id],
  }),
}));
