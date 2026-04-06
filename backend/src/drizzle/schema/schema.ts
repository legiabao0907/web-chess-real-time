export * from './users.schema';
export * from './tournament.schema';
export * from './game.schema';
export * from './chat.schema';
export * from './profileInfo.schema';

// Export relations (nếu bạn dùng Drizzle Relations Queries)
import { relations } from 'drizzle-orm';
import * as usersSchema from './users.schema';
import * as gamesSchema from './game.schema';

export const usersRelations = relations(usersSchema.users, ({ many }) => ({
  gamesAsWhite: many(gamesSchema.games, { relationName: 'white' }),
  gamesAsBlack: many(gamesSchema.games, { relationName: 'black' }),
}));

export const gamesRelations = relations(gamesSchema.games, ({ one }) => ({
  whitePlayer: one(usersSchema.users, {
    fields: [gamesSchema.games.whiteId],
    references: [usersSchema.users.id],
    relationName: 'white',
  }),
  blackPlayer: one(usersSchema.users, {
    fields: [gamesSchema.games.blackId],
    references: [usersSchema.users.id],
    relationName: 'black',
  }),
}));

export function posts(posts: any) {
  throw new Error('Function not implemented.');
}
