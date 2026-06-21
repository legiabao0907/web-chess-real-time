# ERD (Entity-Relationship Diagram) — Chess Platform

> **Cập nhật**: 2026-06-21  
> **Migration**: `0000_fearless_betty_brant.sql` + `0001_add_indexes.sql`

---

## Sơ Đồ ERD

```mermaid
erDiagram
    %% ============================================================
    %% ENTITY-RELATIONSHIP DIAGRAM (ERD) — Chess Platform
    %% ============================================================

    users {
        uuid id PK "defaultRandom()"
        varchar username UK "NOT NULL"
        varchar email UK "NOT NULL"
        text password_hash "NOT NULL"
        integer blitz_rating "DEFAULT 1200"
        integer rapid_rating "DEFAULT 1200"
        integer bullet_rating "DEFAULT 1200"
        varchar role "DEFAULT 'user'"
        timestamp created_at "DEFAULT now()"
    }

    games {
        uuid id PK "defaultRandom()"
        uuid white_id FK "→ users.id"
        uuid black_id FK "→ users.id (nullable for bot)"
        varchar white_username
        varchar black_username
        uuid winner_id FK "→ users.id (nullable)"
        varchar status "'active'|'checkmate'|'stalemate'|'draw'|'timeout'|'resign'"
        varchar time_control "'bullet'|'blitz'|'rapid'"
        text pgn
        text final_fen
        jsonb moves "DEFAULT '[]'"
        uuid tournament_id FK "→ tournaments.id (nullable)"
        timestamp created_at "DEFAULT now()"
    }

    tournaments {
        uuid id PK "defaultRandom()"
        varchar name "NOT NULL"
        varchar format "'swiss'|'round-robin'|'knockout'"
        varchar status "'pending'|'active'|'completed'"
        varchar time_control "'blitz'|'rapid'|'bullet'"
        timestamp start_time
        timestamp end_time
        uuid creator_id FK "→ users.id"
    }

    tournament_participants {
        uuid tournament_id PK_FK "→ tournaments.id"
        uuid user_id PK_FK "→ users.id"
        real points "DEFAULT 0"
        real tie_break "DEFAULT 0"
        integer rank
    }

    chat_rooms {
        uuid id PK "defaultRandom()"
        varchar type "'private'|'game'"
        uuid reference_id "friendId or gameId"
        timestamp created_at "DEFAULT now()"
    }

    chat_room_members {
        uuid room_id PK_FK "→ chat_rooms.id"
        uuid user_id PK_FK "→ users.id"
    }

    messages {
        uuid id PK "defaultRandom()"
        uuid room_id FK "→ chat_rooms.id"
        uuid sender_id FK "→ users.id"
        varchar sender_username "NOT NULL"
        text content "NOT NULL"
        timestamp created_at "DEFAULT now()"
    }

    friends {
        uuid user_id_1 PK_FK "→ users.id"
        uuid user_id_2 PK_FK "→ users.id"
        varchar status "'pending'|'accepted'"
    }

    profileInfo {
        serial id PK
        jsonb metadata "avatar, bio, preferences"
        uuid userId UK_FK "NOT NULL → users.id"
    }

    %% ============================================================
    %% RELATIONSHIPS
    %% ============================================================

    users ||--o{ games : "whiteId"
    users ||--o{ games : "blackId"
    users ||--o{ games : "winnerId"
    users ||--o{ tournaments : "creatorId"
    users ||--o{ tournament_participants : "userId"
    users ||--o{ messages : "senderId"
    users ||--o{ friends : "user1Id"
    users ||--o{ friends : "user2Id"
    users ||--o{ chat_room_members : "userId"
    users ||--|| profileInfo : "userId (1:1)"

    tournaments ||--o{ games : "tournamentId"
    tournaments ||--o{ tournament_participants : "tournamentId"

    chat_rooms ||--o{ chat_room_members : "roomId"
    chat_rooms ||--o{ messages : "roomId"
```

---

## Toàn Bộ Index (23 indexes)

### 🔴 CRITICAL: FK Indexes (10)

| # | Tên Index | Bảng | Cột | Ghi chú |
|---|-----------|------|-----|---------|
| 1 | `idx_games_white_id` | games | `white_id` | FK lookup |
| 2 | `idx_games_black_id` | games | `black_id` | FK lookup |
| 3 | `idx_games_winner_id` | games | `winner_id` | FK lookup |
| 4 | `idx_games_tournament_id` | games | `tournament_id` | FK lookup |
| 5 | `idx_messages_room_id` | messages | `room_id` | FK lookup |
| 6 | `idx_messages_sender_id` | messages | `sender_id` | FK lookup |
| 7 | `idx_friends_user_id_2` | friends | `user_id_2` | PK chỉ cover `(user_id_1, user_id_2)`, cần index riêng cho `user_id_2` |
| 8 | `idx_chat_room_members_user_id` | chat_room_members | `user_id` | PK chỉ cover `(room_id, user_id)`, cần index riêng cho `user_id` |
| 9 | `idx_tournament_participants_user_id` | tournament_participants | `user_id` | PK chỉ cover `(tournament_id, user_id)`, cần index riêng cho `user_id` |
| 10 | `idx_profileinfo_user_id` | profileInfo | `userId` | **UNIQUE** — 1 user = 1 profile |

### 🟠 HIGH: Frequent Query Columns (6)

| # | Tên Index | Bảng | Cột |
|---|-----------|------|-----|
| 11 | `idx_games_status` | games | `status` |
| 12 | `idx_games_created_at` | games | `created_at DESC` |
| 13 | `idx_messages_created_at` | messages | `created_at` |
| 14 | `idx_tournaments_status` | tournaments | `status` |
| 15 | `idx_tournaments_creator_id` | tournaments | `creator_id` |
| 16 | `idx_chat_rooms_reference_id` | chat_rooms | `reference_id` |

### 🟡 MEDIUM: Composite Indexes (5)

| # | Tên Index | Bảng | Cột | Mục đích |
|---|-----------|------|-----|----------|
| 17 | `idx_messages_room_created` | messages | `(room_id, created_at DESC)` | Load chat history nhanh |
| 18 | `idx_games_white_status` | games | `(white_id, status)` | Tìm active games của user (white) |
| 19 | `idx_games_black_status` | games | `(black_id, status)` | Tìm active games của user (black) |
| 20 | `idx_games_tournament_created` | games | `(tournament_id, created_at DESC)` | Game trong tournament theo thời gian |
| 21 | `idx_chat_rooms_type_ref` | chat_rooms | `(type, reference_id)` | Tìm chat room theo type + reference |

### 🟢 LOW: Optional (2)

| # | Tên Index | Bảng | Cột |
|---|-----------|------|-----|
| 22 | `idx_games_time_control` | games | `time_control` |
| 23 | `idx_tournaments_start_time` | tournaments | `start_time` |

---

## Tổng Quan Quan Hệ

| Bảng cha | Bảng con | Quan hệ | FK Column(s) | Ghi chú |
|----------|----------|---------|-------------|---------|
| `users` | `games` | 1:N (×3) | `whiteId`, `blackId`, `winnerId` | `blackId` nullable cho bot |
| `users` | `tournaments` | 1:N | `creatorId` | |
| `users` | `tournament_participants` | 1:N | `userId` | Composite PK |
| `users` | `messages` | 1:N | `senderId` | |
| `users` | `friends` | 1:N (×2) | `user1Id`, `user2Id` | Composite PK |
| `users` | `chat_room_members` | 1:N | `userId` | Composite PK |
| `users` | `profileInfo` | **1:1** | `userId` | Unique index |
| `tournaments` | `games` | 1:N | `tournamentId` | nullable |
| `tournaments` | `tournament_participants` | 1:N | `tournamentId` | Composite PK |
| `chat_rooms` | `messages` | 1:N | `roomId` | |
| `chat_rooms` | `chat_room_members` | 1:N | `roomId` | Composite PK |

> **Tổng**: 9 bảng · 11 quan hệ khóa ngoại · 23 indexes · 2 migrations
