import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { tournaments } from './tournament.schema';

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  whiteId: uuid('white_id').references(() => users.id),
  blackId: uuid('black_id').references(() => users.id),
  winnerId: uuid('winner_id').references(() => users.id),
  status: varchar('status', { length: 50 }),
  timeControl: varchar('time_control', { length: 50 }),
  pgn: text('pgn'),
  finalFen: text('final_fen'),
  tournamentId: uuid('tournament_id').references(() => tournaments.id),
  createdAt: timestamp('created_at').defaultNow(),
});