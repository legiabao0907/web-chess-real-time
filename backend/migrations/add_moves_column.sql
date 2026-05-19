-- Migration: add verbose moves column to games table
-- Run this once against your PostgreSQL database.
-- Compatible with PostgreSQL 12+

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS moves jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Optional: index for faster JSON queries (e.g. filtering by piece)
-- CREATE INDEX IF NOT EXISTS idx_games_moves ON games USING gin(moves);

-- Verify
SELECT column_name, data_type, column_default
FROM   information_schema.columns
WHERE  table_name = 'games'
  AND  column_name = 'moves';
