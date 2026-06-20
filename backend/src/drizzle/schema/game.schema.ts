import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { tournaments } from './tournament.schema';

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  whiteId: uuid('white_id').references(() => users.id),
  blackId: uuid('black_id').references(() => users.id),
  whiteUsername: varchar('white_username', { length: 255 }),
  blackUsername: varchar('black_username', { length: 255 }),
  winnerId: uuid('winner_id').references(() => users.id),
  status: varchar('status', { length: 50 }),
  timeControl: varchar('time_control', { length: 50 }),
  pgn: text('pgn'),
  finalFen: text('final_fen'),
  moves: jsonb('moves'),
  tournamentId: uuid('tournament_id').references(() => tournaments.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  // CRITICAL: FK indexes
  whiteIdIdx: index('idx_games_white_id').on(t.whiteId),
  blackIdIdx: index('idx_games_black_id').on(t.blackId),
  winnerIdIdx: index('idx_games_winner_id').on(t.winnerId),
  tournamentIdIdx: index('idx_games_tournament_id').on(t.tournamentId),
  // HIGH: Frequent query columns
  statusIdx: index('idx_games_status').on(t.status),
  createdAtIdx: index('idx_games_created_at').on(t.createdAt),
  // MEDIUM: Composite indexes
  whiteStatusIdx: index('idx_games_white_status').on(t.whiteId, t.status),
  blackStatusIdx: index('idx_games_black_status').on(t.blackId, t.status),
  tournamentCreatedIdx: index('idx_games_tournament_created').on(t.tournamentId, t.createdAt),
  // LOW: Optional
  timeControlIdx: index('idx_games_time_control').on(t.timeControl),
}));
