-- ============================================================
-- DDL for MySQL — Chess Platform
-- Generated: 2026-06-22
-- Source: Drizzle ORM schema (PostgreSQL → MySQL converted)
-- Requires: MySQL 8.0+ (for UUID(), DESC indexes, CTE support)
-- Usage: Run in MySQL Workbench → Database → Reverse Engineer → ERD
-- ============================================================

CREATE DATABASE IF NOT EXISTS chess_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chess_platform;

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE users (
    id              CHAR(36)        NOT NULL,
    username        VARCHAR(255)    NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    password_hash   TEXT            NOT NULL,
    blitz_rating    INT             DEFAULT 1200,
    rapid_rating    INT             DEFAULT 1200,
    bullet_rating   INT             DEFAULT 1200,
    role            VARCHAR(50)     DEFAULT 'user',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY UQ_users_username (username),
    UNIQUE KEY UQ_users_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- 2. tournaments
-- ============================================================
CREATE TABLE tournaments (
    id              CHAR(36)        NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    format          VARCHAR(50)     NULL,
    status          VARCHAR(50)     NULL,
    time_control    VARCHAR(50)     NULL,
    start_time      DATETIME        NULL,
    end_time        DATETIME        NULL,
    creator_id      CHAR(36)        NULL,

    PRIMARY KEY (id),
    CONSTRAINT FK_tournaments_creator FOREIGN KEY (creator_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 3. games
-- ============================================================
CREATE TABLE games (
    id              CHAR(36)        NOT NULL,
    white_id        CHAR(36)        NULL,
    black_id        CHAR(36)        NULL,
    white_username  VARCHAR(255)    NULL,
    black_username  VARCHAR(255)    NULL,
    winner_id       CHAR(36)        NULL,
    status          VARCHAR(50)     NULL,
    time_control    VARCHAR(50)     NULL,
    pgn             LONGTEXT        NULL,
    final_fen       TEXT            NULL,
    moves           JSON            NULL,
    tournament_id   CHAR(36)        NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT FK_games_white      FOREIGN KEY (white_id)      REFERENCES users(id),
    CONSTRAINT FK_games_black      FOREIGN KEY (black_id)      REFERENCES users(id),
    CONSTRAINT FK_games_winner     FOREIGN KEY (winner_id)     REFERENCES users(id),
    CONSTRAINT FK_games_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
) ENGINE=InnoDB;

-- ============================================================
-- 4. tournament_participants
-- ============================================================
CREATE TABLE tournament_participants (
    tournament_id   CHAR(36)    NOT NULL,
    user_id         CHAR(36)    NOT NULL,
    points          FLOAT       DEFAULT 0,
    tie_break       FLOAT       DEFAULT 0,
    `rank`          INT         NULL,

    PRIMARY KEY (tournament_id, user_id),
    CONSTRAINT FK_tp_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    CONSTRAINT FK_tp_user       FOREIGN KEY (user_id)       REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 5. chat_rooms
-- ============================================================
CREATE TABLE chat_rooms (
    id              CHAR(36)        NOT NULL,
    type            VARCHAR(50)     NULL,
    reference_id    CHAR(36)        NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ============================================================
-- 6. chat_room_members
-- ============================================================
CREATE TABLE chat_room_members (
    room_id         CHAR(36)    NOT NULL,
    user_id         CHAR(36)    NOT NULL,

    PRIMARY KEY (room_id, user_id),
    CONSTRAINT FK_crm_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    CONSTRAINT FK_crm_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 7. messages
-- ============================================================
CREATE TABLE messages (
    id              CHAR(36)        NOT NULL,
    room_id         CHAR(36)        NULL,
    sender_id       CHAR(36)        NULL,
    sender_username VARCHAR(255)    NOT NULL,
    content         TEXT            NOT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT FK_messages_room   FOREIGN KEY (room_id)   REFERENCES chat_rooms(id),
    CONSTRAINT FK_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 8. friends
-- ============================================================
CREATE TABLE friends (
    user_id_1       CHAR(36)    NOT NULL,
    user_id_2       CHAR(36)    NOT NULL,
    status          VARCHAR(50) NULL,

    PRIMARY KEY (user_id_1, user_id_2),
    CONSTRAINT FK_friends_user1 FOREIGN KEY (user_id_1) REFERENCES users(id),
    CONSTRAINT FK_friends_user2 FOREIGN KEY (user_id_2) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- 9. profileInfo
-- ============================================================
CREATE TABLE profileInfo (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    metadata        JSON            NULL,
    userId          CHAR(36)        NOT NULL,

    UNIQUE KEY UQ_profileInfo_userId (userId),
    CONSTRAINT FK_profileInfo_user FOREIGN KEY (userId) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============================================================
-- INDEXES (23 indexes)
-- MySQL: FK columns are NOT auto-indexed in InnoDB
-- ============================================================

-- CRITICAL: FK indexes (10)
CREATE INDEX idx_games_white_id                ON games(white_id);
CREATE INDEX idx_games_black_id                ON games(black_id);
CREATE INDEX idx_games_winner_id               ON games(winner_id);
CREATE INDEX idx_games_tournament_id           ON games(tournament_id);
CREATE INDEX idx_messages_room_id              ON messages(room_id);
CREATE INDEX idx_messages_sender_id            ON messages(sender_id);
CREATE INDEX idx_friends_user_id_2             ON friends(user_id_2);
CREATE INDEX idx_chat_room_members_user_id     ON chat_room_members(user_id);
CREATE INDEX idx_tournament_participants_user_id ON tournament_participants(user_id);
-- idx_profileinfo_user_id: already UNIQUE KEY above

-- HIGH: Frequent query columns (6)
CREATE INDEX idx_games_status                  ON games(status);
CREATE INDEX idx_games_created_at              ON games(created_at);
CREATE INDEX idx_messages_created_at           ON messages(created_at);
CREATE INDEX idx_tournaments_status            ON tournaments(status);
CREATE INDEX idx_tournaments_creator_id        ON tournaments(creator_id);
CREATE INDEX idx_chat_rooms_reference_id       ON chat_rooms(reference_id);

-- MEDIUM: Composite indexes (5)
CREATE INDEX idx_messages_room_created         ON messages(room_id, created_at);
CREATE INDEX idx_games_white_status            ON games(white_id, status);
CREATE INDEX idx_games_black_status            ON games(black_id, status);
CREATE INDEX idx_games_tournament_created      ON games(tournament_id, created_at);
CREATE INDEX idx_chat_rooms_type_ref           ON chat_rooms(type, reference_id);

-- LOW: Optional (2)
CREATE INDEX idx_games_time_control            ON games(time_control);
CREATE INDEX idx_tournaments_start_time        ON tournaments(start_time);

-- ============================================================
-- DONE: 9 tables, 11 FK relationships, 23 indexes
-- ============================================================
