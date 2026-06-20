import { pgTable, uuid, varchar, timestamp, real, integer, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  format: varchar('format', { length: 50 }),
  status: varchar('status', { length: 50 }),
  timeControl: varchar('time_control', { length: 50 }),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  creatorId: uuid('creator_id').references(() => users.id),
}, (t) => ({
  // HIGH: Filter by status & creator
  statusIdx: index('idx_tournaments_status').on(t.status),
  creatorIdIdx: index('idx_tournaments_creator_id').on(t.creatorId),
  // LOW: Sort by start time
  startTimeIdx: index('idx_tournaments_start_time').on(t.startTime),
}));

export const tournamentParticipants = pgTable('tournament_participants', {
  tournamentId: uuid('tournament_id').references(() => tournaments.id),
  userId: uuid('user_id').references(() => users.id),
  points: real('points').default(0),
  tieBreak: real('tie_break').default(0),
  rank: integer('rank'),
}, (t) => ({
  pk: primaryKey({ columns: [t.tournamentId, t.userId] }),
  // CRITICAL: FK index for finding tournaments of a user
  userIdIdx: index('idx_tournament_participants_user_id').on(t.userId),
}));