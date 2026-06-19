-- Migration: Add missing columns to games table
-- Run this once against your PostgreSQL database.
-- These columns exist in the TypeScript schema but were missing from the initial migration.

-- 1. Add white_username column (denormalized for performance)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS white_username varchar(255);

-- 2. Add black_username column (denormalized for performance)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS black_username varchar(255);

-- 3. Add moves column (verbose move list as JSONB for replay)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS moves jsonb DEFAULT '[]'::jsonb;

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_name = 'games'
ORDER BY ordinal_position;
