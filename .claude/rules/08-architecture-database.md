# Database Schema

## Drizzle ORM

Schema được định nghĩa trong [backend/src/drizzle/schema/](backend/src/drizzle/schema/)

## Các Bảng Chính

### users
- `id`: UUID (PK)
- `username`: varchar (unique)
- `email`: varchar (unique)
- `passwordHash`: text
- `blitzRating`: integer (default 1200)
- `rapidRating`: integer (default 1200)
- `bulletRating`: integer (default 1200)
- `role`: varchar ('user' | 'admin')
- `createdAt`: timestamp

### games
- `id`: UUID (PK)
- `whiteId`: UUID (FK to users)
- `blackId`: UUID (FK to users, nullable for bot games)
- `winnerId`: UUID (FK to users, nullable)
- `status`: varchar ('active' | 'checkmate' | 'stalemate' | 'draw' | 'timeout' | 'resign')
- `timeControl`: varchar ('blitz' | 'rapid' | 'bullet')
- `pgn`: text (Portable Game Notation)
- `finalFen`: text (Final board position)
- `moves`: jsonb (Array of moves)
- `tournamentId`: UUID (FK to tournaments, nullable)
- `createdAt`: timestamp

### tournaments
- `id`: UUID (PK)
- `name`: varchar
- `format`: varchar ('swiss' | 'round-robin' | 'knockout')
- `status`: varchar ('pending' | 'active' | 'completed')
- `timeControl`: varchar
- `startTime`: timestamp
- `endTime`: timestamp
- `creatorId`: UUID (FK to users)

### tournament_participants
- `tournamentId`: UUID (PK, FK to tournaments)
- `userId`: UUID (PK, FK to users)
- `points`: real (default 0)
- `tieBreak`: real (default 0)
- `rank`: integer

### chat_rooms
- `id`: UUID (PK)
- `type`: varchar ('game' | 'tournament' | 'private')
- `referenceId`: UUID (gameId or tournamentId)
- `createdAt`: timestamp

### messages
- `id`: UUID (PK)
- `roomId`: UUID (FK to chat_rooms)
- `senderId`: UUID (FK to users)
- `senderUsername`: varchar
- `content`: text
- `createdAt`: timestamp

### friends
- `user1Id`: UUID (PK, FK to users)
- `user2Id`: UUID (PK, FK to users)
- `status`: varchar ('pending' | 'accepted' | 'blocked')

### profile_info
- `id`: serial (PK)
- `userId`: UUID (FK to users, unique)
- `metadata`: jsonb (Avatar, bio, preferences, etc.)
