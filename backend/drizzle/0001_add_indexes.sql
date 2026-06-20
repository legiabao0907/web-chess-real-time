-- ============================================
-- Migration: Add Performance Indexes
-- Generated from docs/database-normalization-and-index-analysis.md
-- ============================================

-- ============================================
-- CRITICAL: FK Indexes (10 indexes)
-- ============================================

-- games table: FK indexes
CREATE INDEX IF NOT EXISTS idx_games_white_id ON games(white_id);
CREATE INDEX IF NOT EXISTS idx_games_black_id ON games(black_id);
CREATE INDEX IF NOT EXISTS idx_games_winner_id ON games(winner_id);
CREATE INDEX IF NOT EXISTS idx_games_tournament_id ON games(tournament_id);

-- messages table: FK indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- friends table: PK is (user_id_1, user_id_2), need index for user_id_2
CREATE INDEX IF NOT EXISTS idx_friends_user_id_2 ON friends(user_id_2);

-- chat_room_members: PK is (room_id, user_id), need index for user_id
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON chat_room_members(user_id);

-- tournament_participants: PK is (tournament_id, user_id), need index for user_id
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user_id ON tournament_participants(user_id);

-- profileInfo: Unique index (1 user = 1 profile) + fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_profileinfo_user_id ON "profileInfo"("userId");

-- ============================================
-- HIGH: Frequent Query Columns (6 indexes)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_creator_id ON tournaments(creator_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_reference_id ON chat_rooms(reference_id);

-- ============================================
-- MEDIUM: Composite Indexes (5 indexes)
-- ============================================

-- Chat: load history fast (most important composite index)
CREATE INDEX IF NOT EXISTS idx_messages_room_created 
    ON messages(room_id, created_at DESC);

-- Game: find active games of a user
CREATE INDEX IF NOT EXISTS idx_games_white_status 
    ON games(white_id, status);
CREATE INDEX IF NOT EXISTS idx_games_black_status 
    ON games(black_id, status);

-- Game in tournament by time
CREATE INDEX IF NOT EXISTS idx_games_tournament_created 
    ON games(tournament_id, created_at DESC);

-- Chat room lookup by type + reference
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type_ref 
    ON chat_rooms(type, reference_id);

-- ============================================
-- LOW: Optional (2 indexes)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_games_time_control ON games(time_control);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON tournaments(start_time);
