import { pgTable, uuid, varchar, timestamp, real, integer, primaryKey } from 'drizzle-orm/pg-core';
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
});

export const tournamentParticipants = pgTable('tournament_participants', {
  tournamentId: uuid('tournament_id').references(() => tournaments.id),
  userId: uuid('user_id').references(() => users.id),
  points: real('points').default(0),
  tieBreak: real('tie_break').default(0),
  rank: integer('rank'),
}, (t) => ({
  pk: primaryKey({ columns: [t.tournamentId, t.userId] }),
}));