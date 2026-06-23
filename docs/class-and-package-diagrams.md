# Class Diagram & Package/Subsystem Diagram — Hệ Thống Cờ Vua Trực Tuyến

> Tài liệu này bổ sung Class Diagram và Package/Subsystem Diagram dựa trên các [Sequence Diagram](sequence-diagrams.md) đã có.  
> **Đã cập nhật (23/06/2026)**: Bổ sung Section 1.3 — Drizzle ORM Layer: `DrizzleModule`, `DrizzleDB` type, Schema Table Definitions (`PgTable` objects), `$inferSelect`/`$inferInsert` inferred types, `relations()`, và `SchemaBundle`. Giải thích cơ chế type phát sinh tự động từ `pgTable()` và cách Service kết nối qua `@Inject(DRIZZLE)`.  
> Dùng [Mermaid Live Editor](https://mermaid.live/) hoặc Markdown Preview trên IDE để xem trực quan.

---

## Mục Lục

1. [Backend Class Diagram — Tổng quan](#1-backend-class-diagram--tổng-quan)
   - [1.1 Toàn bộ class backend (với Multiplicity)](#11-toàn-bộ-class-backend-với-multiplicity)
   - [1.2 Database Entities — Quan hệ ERD (với Multiplicity)](#12-database-entities--quan-hệ-erd-với-multiplicity)
   - [1.3 Drizzle ORM Layer — Schema Definitions & Phát Sinh](#13-drizzle-orm-layer--schema-definitions--phát-sinh-derived-types)
2. [Module Game — Chi tiết](#2-module-game--chi-tiết)
3. [Module Tournament — Chi tiết](#3-module-tournament--chi-tiết)
4. [Module Chat — Chi tiết](#4-module-chat--chi-tiết)
5. [Module Auth & User — Chi tiết](#5-module-auth--user--chi-tiết)
6. [Module Leaderboard — Chi tiết](#6-module-leaderboard--chi-tiết)
7. [Frontend Class Diagram](#7-frontend-class-diagram)
8. [Package/Subsystem Diagram](#8-packagesubsystem-diagram)
9. [Mối liên hệ với Sequence Diagram](#9-mối-liên-hệ-với-sequence-diagram)

---

## 1. Backend Class Diagram — Tổng quan

### 1.1 Backend Class Diagram — Gateways & Services (Đầy đủ thuộc tính + phương thức)

Sơ đồ **tinh gọn** chỉ thể hiện quan hệ giữa **Gateways (WebSocket)** và **Services (Business Logic)**.  
Controllers, Redis, PostgreSQL, DTOs đã được lược bỏ để tập trung vào kiến trúc cốt lõi.

> 📘 **Giải thích ký hiệu mũi tên**: Xem [UML Relationship Arrows — Toàn Tập](uml-relationship-arrows.md)

```mermaid
classDiagram
    direction TB

    %% ═══════════════════════════════════════════════════════
    %% GATEWAYS (WebSocket)
    %% ═══════════════════════════════════════════════════════
    class GameGateway {
        -Server server
        -Logger logger
        -Map connectedClients
        -Map reMatchIntervals
        -GameService gameService
        -AiService aiService
        -LeaderboardGateway leaderboardGateway
        -WatchGateway watchGateway
        -TournamentGateway tournamentGateway
        +afterInit(server)
        +handleConnection(client)
        +handleDisconnect(client)
        +handleReconnectCheck(data)
        +handleFindGame(data)
        +handleCancelSearch(data)
        +handleMakeMove(data)
        +handleResign(data)
        +handleOfferDraw(data)
        +handleAcceptDraw(data)
        +handleDeclineDraw(data)
        +handleStartBotGame(data)
        +handleJoinGame(data)
        +handleClaimTimeout(data)
        -startReMatchIntervals()
        -emitSearchProgress(timeControl)
        -createGameFromMatch(p1, p2, tc)
    }

    class WatchGateway {
        -Server server
        -Logger logger
        -Map spectators
        -WatchService watchService
        -GameService gameService
        +afterInit(server)
        +handleConnection(client)
        +handleDisconnect(client)
        +handleWatchGame(data)
        +handleLeaveWatch(data)
        +handleListLiveGames(client)
        +broadcastGameUpdate(gameId, data)
        +broadcastGameOver(gameId, data)
        -handleLeaveInternal(client, gameId)
    }

    class ChatGateway {
        -Server server
        -Logger logger
        -Map clients
        -Map userSockets
        -Redis redis
        -ChatService chatService
        +afterInit(server)
        +handleConnection(client)
        +handleDisconnect(client)
        +handleIdentify(data)
        +handleJoinDm(data)
        +handleSendDm(data)
        +handleSendDirectMessage(data)
        +handleGetHistory(data)
        +handleTyping(data)
        +emitToUser(userId, event, data)
        -broadcastUserStatus(userId, username, isOnline)
    }

    class TournamentGateway {
        -Server server
        -Logger logger
        -Map userSockets
        -Map clients
        -Map nextRoundTimers
        -TournamentService tournamentService
        +afterInit()
        +handleConnection(client)
        +handleDisconnect(client)
        +handleIdentify(data)
        +handleJoinRoom(data)
        +handleLeaveRoom(data)
        +broadcastTournamentUpdate(tournamentId, data)
        +notifyPlayer(userId, event, data)
        +setNextRoundTimer(tournamentId, ts)
        +clearNextRoundTimer(tournamentId)
    }

    class LeaderboardGateway {
        -Server server
        -Logger logger
        -Map subscribedClients
        -LeaderboardService leaderboardService
        +afterInit()
        +handleConnection(client)
        +handleDisconnect(client)
        +handleSubscribe(data)
        +handleUnsubscribe(data)
        +handleRequest(data)
        +triggerEloUpdate(params)
        +broadcastLeaderboard(category, limit)
    }

    %% ═══════════════════════════════════════════════════════
    %% SERVICES (Business Logic)
    %% ═══════════════════════════════════════════════════════
    class GameService {
        -Logger logger
        -Redis redisClient
        -NodePgDatabase db
        -string matchmakeSha
        -string leaveQueueSha
        +onModuleInit()
        +joinQueue(entry, maxEloDiff) MatchmakingEntry|null
        +leaveQueue(userId, timeControl) void
        +getQueueSize(timeControl) number
        +getQueueEntries(timeControl) MatchmakingEntry[]
        +reMatchWaitingPlayers(tc) Match[]
        +getExpandedEloRange(joinedAt) number
        +generateGameId() string
        +createGameState(gameId, white, black, tc) GameState
        +processMove(gameId, userId, move) MoveResult|null
        +resign(gameId, userId) GameState
        +offerDraw(gameId, userId) boolean
        +acceptDraw(gameId) GameState
        +getGame(gameId) GameState|null
        +saveGame(game, ttl) void
        +deleteGame(gameId) void
        +getUserCurrentGame(userId) string|null
        +setUserCurrentGame(userId, gameId) void
        +clearUserCurrentGame(userId) void
        +saveGameToDb(gameId) void
        +getGameHistory(userId) Game[]
        -gameKey(gameId) string
        -matchmakingKey(timeControl) string
        -userGameKey(userId) string
    }

    class AiService {
        -Logger logger
        +getBestMove(fen, difficulty, botColor) Move|null
        +evaluatePosition(fen) number
        -minimax(chess, depth, alpha, beta, maximizing) number
        -quiescence(chess, alpha, beta, maximizing) number
        -evaluate(chess) number
        -evaluateMaterial(chess) number
        -evaluatePst(chess) number
        -evaluateMobility(chess) number
        -orderMoves(moves, chess) Move[]
        -getRandomMove(chess) Move|null
    }

    class AuthService {
        -NodePgDatabase db
        -JwtService jwtService
        -ConfigService configService
        +register(dto) AuthResponse
        +login(dto) AuthResponse
        +refreshTokens(refreshToken) AuthTokens
        -generateTokens(userId, username, email) AuthTokens
    }

    class ChatService {
        -Logger logger
        -Redis redis
        -NodePgDatabase db
        +getOrCreatePrivateRoom(user1Id, user2Id) string
        +saveMessage(roomId, senderId, senderUsername, content) ChatMessage
        +getMessages(roomId, limit) ChatMessage[]
        +getUserRooms(userId) string[]
        -roomCacheKey(roomId) string
    }

    class TournamentService {
        -NodePgDatabase db
        -Redis redis
        -TournamentSwissService swissService
        -GameService gameService
        +listTournaments() Tournament[]
        +getTournament(id) Tournament
        +getTournamentRounds(tournamentId) TournamentRound[]
        +getCurrentRound(tournamentId) number
        +createTournament(creatorId, dto) Tournament
        +joinTournament(tournamentId, userId) void
        +leaveTournament(tournamentId, userId) void
        +startTournament(tournamentId, userId) RoundResult
        +nextRound(tournamentId, userId?) RoundResult
        +finishTournament(tournamentId, userId) void
        +deleteTournament(tournamentId, userId, isAdmin) void
        +recordTournamentResult(tournamentId, gameId, result) TournamentRound
        +getTournamentGameInfo(gameId) GameInfo
        +getMyTournaments(userId) Tournament[]
        -roundsKey(tournamentId) string
        -roundKey(tournamentId, round) string
        -currentRoundKey(tournamentId) string
        -generateSwissPairings(tournamentId, round) TournamentRound
        -applyRoundResults(tournamentId, games) void
    }

    class TournamentSwissService {
        -NodePgDatabase db
        +generateNextRoundPairs(tournamentId, nextRound) SwissRoundResult
        -resolveResult(whiteId, blackId, winnerId, status) string
        -buildPlayerStats(tournamentId) SwissPlayer[]
        -runSwissPairing(players, pastMatches, tournamentId, round) SwissPairing[]
        -buildScoreGroups(players) SwissPlayer[][]
        -pairGroup(players, pastMatches, round) SwissPairing[]
        -assignColor(p1, p2) SwissPairing
        -pairKey(id1, id2) string
    }

    class LeaderboardService {
        -Logger logger
        -Redis redis
        -NodePgDatabase db
        +updateElo(dto) void
        +getTopPlayers(category, limit, offset) LeaderboardUpdate
        +getPlayerRank(userId, category) RankResult
        +seedDemoData() void
        -leaderboardKey(category) string
        -playerDataKey(userId, category) string
    }

    class UserService {
        -NodePgDatabase db
        +getMe(userId) UserProfile
        +updateMe(userId, dto) void
        +getPublicProfile(userId) PublicProfile
        +getFriendshipStatus(myId, targetId) FriendshipStatus
        +sendFriendRequest(myId, targetId) void
        +acceptFriendRequest(myId, requesterId) void
        +removeFriend(myId, targetId) void
        +getPendingRequests(userId) FriendRequest[]
    }

    class WatchService {
        -Logger logger
        -Redis redis
        +addSpectator(gameId) number
        +removeSpectator(gameId) number
        +getSpectatorCount(gameId) number
        +listActiveGames() LiveGameSummary[]
        -spectatorKey(gameId) string
    }

    %% ═══════════════════════════════════════════════════════
    %% RELATIONSHIPS
    %% ═══════════════════════════════════════════════════════

    %% ─── [ASSOCIATION] Gateway ──Service: Gateway GIỮ reference đến Service ───
    GameGateway        "1" --> "1" GameService         : delegates
    GameGateway        "1" --> "1" AiService           : botMoves
    WatchGateway       "1" --> "1" GameService         : reads
    WatchGateway       "1" --> "1" WatchService        : manages
    ChatGateway        "1" --> "1" ChatService         : delegates
    TournamentGateway  "1" --> "1" TournamentService   : delegates
    LeaderboardGateway "1" --> "1" LeaderboardService  : delegates

    %% ─── [ASSOCIATION] Service ──Service: Service gọi Service khác ───
    GameService        "1" --> "1" LeaderboardService     : updateELO
    TournamentService  "1" --> "1" TournamentSwissService : pairings
    TournamentService  "1" --> "1" GameService            : createGames

    %% ─── [DEPENDENCY] Gateway ──Gateway: Giao tiếp GIÁN TIẾP qua event (không giữ ref) ───
    GameGateway "1" ..> "0..1" WatchGateway       : broadcastGameUpdate
    GameGateway "1" ..> "0..1" LeaderboardGateway : notifyELO
    GameGateway "1" ..> "0..1" TournamentGateway  : notifyResult

    %% ─── [IMPLEMENTATION] Gateway implements NestJS interfaces ───
    GameGateway ..|> OnGatewayInit
    GameGateway ..|> OnGatewayConnection
    GameGateway ..|> OnGatewayDisconnect

    %% ─── Chú thích từng class ───
    note for GameGateway "namespace: /chess — Xử lý matchmaking, nước đi, đầu hàng, hòa, bot game"
    note for WatchGateway "namespace: /watch — Chế độ khán giả xem trận đấu trực tiếp"
    note for ChatGateway "namespace: /chat — DM 1-1: room-based + Redis direct routing"
    note for TournamentGateway "namespace: /tournament — Cập nhật giải đấu + countdown timer"
    note for LeaderboardGateway "namespace: /leaderboard — Bảng xếp hạng + cập nhật ELO real-time"
    
    note for GameService "Lua script matchmaking, quản lý game state Redis, persist PostgreSQL"
    note for AiService "Minimax Alpha-Beta + Quiescence Search + PST evaluation"
    note for AuthService "JWT access/refresh token + bcrypt password hashing"
    note for ChatService "Quản lý room, cache 50 msg gần nhất, TTL 1 giờ"
    note for TournamentService "Swiss pairing, quản lý vòng đấu, round state Redis"
    note for TournamentSwissService "Thuật toán Swiss: score groups, color balancing, byes"
    note for LeaderboardService "Redis ZSET ranking O(log N), persist ELO PostgreSQL"
    note for UserService "Profile, friend request, friendship status cache"
    note for WatchService "Spectator counter Redis INCR/DECR, live game discovery SCAN"
```

| Loại quan hệ | Mũi tên | Ý nghĩa | Áp dụng trong hệ thống |
|-------------|---------|---------|----------------------|
| **Association** | `-->` (liền →) | 🔵 Giữ reference trực tiếp, quan hệ mạnh | Gateway→Service, Service→Service |
| **Dependency** | `..>` (đứt →) | 🟠 Dùng tạm thời, không giữ reference | Gateway→Gateway (event-based) |
| **Implementation** | `..\|>` (đứt ▷) | 🟢 Implements interface | Gateway→OnGatewayInit/Connection/Disconnect |

| Ký hiệu thành viên | Ý nghĩa |
|-------------------|---------|
| `+method()` | Public method |
| `-method()` | Private method |
| `-field` | Private attribute (dependency injection) |

> 🔗 **Đọc thêm**: [UML Relationship Arrows — Toàn Tập](uml-relationship-arrows.md) — giải thích chi tiết 6 loại mũi tên, kèm cây quyết định chọn đúng loại quan hệ.

---

### 1.2 Database Entities — Quan hệ ERD (với Multiplicity)

Sơ đồ này thể hiện **quan hệ giữa các bảng database** với multiplicity đầy đủ.

```mermaid
erDiagram
    USERS ||--o{ GAMES : "1 user — 0..* games (white)"
    USERS ||--o{ GAMES : "1 user — 0..* games (black)"
    USERS ||--o{ GAMES : "1 user — 0..* games (winner)"
    USERS ||--o{ TOURNAMENT_PARTICIPANTS : "1 user — 0..* tournaments"
    USERS ||--o{ TOURNAMENTS : "1 user — 0..* tournaments (creator)"
    USERS ||--o{ FRIENDS : "1 user — 0..* friends (user1)"
    USERS ||--o{ FRIENDS : "1 user — 0..* friends (user2)"
    USERS ||--o{ MESSAGES : "1 user — 0..* messages"
    USERS ||--o{ CHAT_ROOM_MEMBERS : "1 user — 0..* rooms"
    USERS ||--|| PROFILE_INFO : "1 user — 1 profile"

    TOURNAMENTS ||--o{ TOURNAMENT_PARTICIPANTS : "1 tournament — 2..* participants"
    TOURNAMENTS ||--o{ GAMES : "1 tournament — 0..* games"

    CHAT_ROOMS ||--o{ CHAT_ROOM_MEMBERS : "1 room — 2 members"
    CHAT_ROOMS ||--o{ MESSAGES : "1 room — 0..* messages"

    USERS {
        uuid id PK
        varchar username UK
        varchar email UK
        text passwordHash
        integer blitzRating
        integer rapidRating
        integer bulletRating
        varchar role
        timestamp createdAt
    }

    PROFILE_INFO {
        serial id PK
        uuid userId FK_UK
        jsonb metadata
    }

    FRIENDS {
        uuid user1Id PK_FK
        uuid user2Id PK_FK
        varchar status
    }

    GAMES {
        uuid id PK
        uuid whiteId FK_nullable
        uuid blackId FK_nullable
        uuid winnerId FK_nullable
        varchar whiteUsername
        varchar blackUsername
        varchar status
        varchar timeControl
        text pgn
        text finalFen
        jsonb moves
        uuid tournamentId FK_nullable
        timestamp createdAt
    }

    TOURNAMENTS {
        uuid id PK
        varchar name
        varchar format
        varchar status
        varchar timeControl
        timestamp startTime
        timestamp endTime
        uuid creatorId FK
    }

    TOURNAMENT_PARTICIPANTS {
        uuid tournamentId PK_FK
        uuid userId PK_FK
        real points
        real tieBreak
        integer rank
    }

    CHAT_ROOMS {
        uuid id PK
        varchar type
        uuid referenceId_nullable
        timestamp createdAt
    }

    CHAT_ROOM_MEMBERS {
        uuid roomId PK_FK
        uuid userId PK_FK
    }

    MESSAGES {
        uuid id PK
        uuid roomId FK
        uuid senderId FK
        varchar senderUsername
        text content
        timestamp createdAt
    }
```

**Bảng multiplicity tổng hợp:**

| Entity A | Quan hệ | Entity B | Multiplicity | Giải thích |
|----------|---------|----------|-------------|------------|
| User | ← chơi trắng → | Game | 1 : 0..* | Một user chơi nhiều game làm trắng |
| User | ← chơi đen → | Game | 1 : 0..* | Một user chơi nhiều game làm đen |
| User | ← thắng → | Game | 1 : 0..* | Một user thắng nhiều game |
| User | ← có → | ProfileInfo | 1 : 1 | Mỗi user có đúng 1 profile |
| User | ← gửi → | Message | 1 : 0..* | Một user gửi nhiều tin nhắn |
| User | ← tham gia → | Tournament | n : m | Qua bảng `tournament_participants` |
| User | ← tạo → | Tournament | 1 : 0..* | Một user tạo nhiều giải |
| User | ← kết bạn → | User | n : m | Qua bảng `friends` |
| Tournament | ← có → | Game | 1 : 0..* | Một giải chứa nhiều game |
| Tournament | ← có → | Participant | 1 : 2..* | Một giải có ít nhất 2 người |
| ChatRoom | ← có → | Message | 1 : 0..* | Một room có nhiều tin nhắn |
| ChatRoom | ← có → | Member | 1 : 2 | Một room có đúng 2 thành viên (DM) |

---

### 1.3 Drizzle ORM Layer — Schema Definitions & Phát Sinh (Derived Types)

> 🔑 **Giải thích**: Khi định nghĩa schema bằng `pgTable()`, Drizzle ORM **tự động sinh** (infer) ra các TypeScript type từ chính schema đó. Các Service không import trực tiếp type mà dùng `NodePgDatabase<typeof schema>` — toàn bộ type được Drizzle nội suy từ cấu trúc bảng. Sơ đồ này thể hiện **class/type phát sinh** ở tầng code (không phải tầng DB).

```mermaid
classDiagram
    direction TB

    %% ═══════════════════════════════════════════════════════
    %% DRIZZLE MODULE (NestJS Provider)
    %% ═══════════════════════════════════════════════════════
    class DrizzleModule {
        <<NestJS Dynamic Module>>
        +Symbol DRIZZLE
        +useFactory(config) DrizzleDB
    }

    %% ═══════════════════════════════════════════════════════
    %% DRIZZLE DATABASE TYPE (phát sinh từ schema)
    %% ═══════════════════════════════════════════════════════
    class DrizzleDB {
        <<Type Alias: NodePgDatabase~typeof schema~>>
        +query: PostgresJsDatabase
        +select: Function
        +insert: Function
        +update: Function
        +delete: Function
        +execute: Function
    }

    %% ═══════════════════════════════════════════════════════
    %% SCHEMA TABLE DEFINITIONS (PgTable objects)
    %% ═══════════════════════════════════════════════════════
    class usersTable {
        <<PgTable~"users"~>>
        +PgColumn id: uuid PK
        +PgColumn username: varchar UK
        +PgColumn email: varchar UK
        +PgColumn passwordHash: text
        +PgColumn blitzRating: integer
        +PgColumn rapidRating: integer
        +PgColumn bulletRating: integer
        +PgColumn role: varchar
        +PgColumn createdAt: timestamp
    }

    class gamesTable {
        <<PgTable~"games"~>>
        +PgColumn id: uuid PK
        +PgColumn whiteId: uuid FK
        +PgColumn blackId: uuid FK
        +PgColumn whiteUsername: varchar
        +PgColumn blackUsername: varchar
        +PgColumn winnerId: uuid FK
        +PgColumn status: varchar
        +PgColumn timeControl: varchar
        +PgColumn pgn: text
        +PgColumn finalFen: text
        +PgColumn moves: jsonb
        +PgColumn tournamentId: uuid FK
        +PgColumn createdAt: timestamp
    }

    class tournamentsTable {
        <<PgTable~"tournaments"~>>
        +PgColumn id: uuid PK
        +PgColumn name: varchar
        +PgColumn format: varchar
        +PgColumn status: varchar
        +PgColumn timeControl: varchar
        +PgColumn startTime: timestamp
        +PgColumn endTime: timestamp
        +PgColumn creatorId: uuid FK
    }

    class tournamentParticipantsTable {
        <<PgTable~"tournament_participants"~>>
        +PgColumn tournamentId: uuid PK_FK
        +PgColumn userId: uuid PK_FK
        +PgColumn points: real
        +PgColumn tieBreak: real
        +PgColumn rank: integer
    }

    class chatRoomsTable {
        <<PgTable~"chat_rooms"~>>
        +PgColumn id: uuid PK
        +PgColumn type: varchar
        +PgColumn referenceId: uuid
        +PgColumn createdAt: timestamp
    }

    class chatRoomMembersTable {
        <<PgTable~"chat_room_members"~>>
        +PgColumn roomId: uuid PK_FK
        +PgColumn userId: uuid PK_FK
    }

    class messagesTable {
        <<PgTable~"messages"~>>
        +PgColumn id: uuid PK
        +PgColumn roomId: uuid FK
        +PgColumn senderId: uuid FK
        +PgColumn senderUsername: varchar
        +PgColumn content: text
        +PgColumn createdAt: timestamp
    }

    class friendsTable {
        <<PgTable~"friends"~>>
        +PgColumn user1Id: uuid PK_FK
        +PgColumn user2Id: uuid PK_FK
        +PgColumn status: varchar
    }

    class profileInfoTable {
        <<PgTable~"profileInfo"~>>
        +PgColumn id: serial PK
        +PgColumn metadata: jsonb
        +PgColumn userId: uuid FK_UK
    }

    %% ═══════════════════════════════════════════════════════
    %% INFERRED TYPES (do Drizzle tự động sinh từ schema)
    %% ═══════════════════════════════════════════════════════
    class InferredTypes~T~ {
        <<TypeScript Utility Types — Auto-generated>>
        +$inferSelect: RowType~T~
        +$inferInsert: InsertType~T~
        +$inferUpdate: UpdateType~T~
    }

    %% ═══════════════════════════════════════════════════════
    %% RELATIONS (Drizzle Relations API)
    %% ═══════════════════════════════════════════════════════
    class usersRelations {
        <<relations()>>
        +gamesAsWhite: many~games~
        +gamesAsBlack: many~games~
    }

    class gamesRelations {
        <<relations()>>
        +whitePlayer: one~users~
        +blackPlayer: one~users~
    }

    class profileInfoRelations {
        <<relations()>>
        +user: one~users~
    }

    %% ═══════════════════════════════════════════════════════
    %% SCHEMA BUNDLE (import * as schema)
    %% ═══════════════════════════════════════════════════════
    class SchemaBundle {
        <<import * as schema from './schema/schema'>>
        +users: usersTable
        +games: gamesTable
        +tournaments: tournamentsTable
        +tournamentParticipants: tournamentParticipantsTable
        +chatRooms: chatRoomsTable
        +chatRoomMembers: chatRoomMembersTable
        +messages: messagesTable
        +friends: friendsTable
        +profileInfo: profileInfoTable
        +usersRelations: usersRelations
        +gamesRelations: gamesRelations
        +profileInfoRelations: profileInfoRelations
    }

    %% ═══════════════════════════════════════════════════════
    %% RELATIONSHIPS
    %% ═══════════════════════════════════════════════════════

    %% ─── DrizzleModule creates DrizzleDB via factory ───
    DrizzleModule "1" --> "1" DrizzleDB : useFactory(pool, {schema})

    %% ─── DrizzleDB được typed bởi SchemaBundle ───
    DrizzleDB "1" --> "1" SchemaBundle : typed by ~typeof schema~

    %% ─── SchemaBundle aggregates all table definitions ───
    SchemaBundle "1" --> "1" usersTable : exports
    SchemaBundle "1" --> "1" gamesTable : exports
    SchemaBundle "1" --> "1" tournamentsTable : exports
    SchemaBundle "1" --> "1" tournamentParticipantsTable : exports
    SchemaBundle "1" --> "1" chatRoomsTable : exports
    SchemaBundle "1" --> "1" chatRoomMembersTable : exports
    SchemaBundle "1" --> "1" messagesTable : exports
    SchemaBundle "1" --> "1" friendsTable : exports
    SchemaBundle "1" --> "1" profileInfoTable : exports

    %% ─── Relations link tables ───
    usersRelations "1" --> "1" gamesTable : many(games)
    gamesRelations "1" --> "1" usersTable : one(users)
    profileInfoRelations "1" --> "1" usersTable : one(users)

    %% ─── Each table .$inferSelect/.$inferInsert → InferredTypes ───
    usersTable "1" ..> "1" InferredTypes~User~ : .$inferSelect
    gamesTable "1" ..> "1" InferredTypes~Game~ : .$inferSelect
    tournamentsTable "1" ..> "1" InferredTypes~Tournament~ : .$inferSelect
    messagesTable "1" ..> "1" InferredTypes~ChatMessage~ : .$inferSelect
    friendsTable "1" ..> "1" InferredTypes~Friend~ : .$inferSelect
    profileInfoTable "1" ..> "1" InferredTypes~ProfileInfo~ : .$inferSelect

    %% ─── Chú thích ───
    note for DrizzleModule "File: backend/src/drizzle/drizzle.module.ts
    Provider token: Symbol('drizzle-connection')
    Auto-run migrations on startup"

    note for DrizzleDB "Type: NodePgDatabase<typeof schema>
    Inject: @Inject(DRIZZLE) private db: DrizzleDB
    Mọi Service dùng type này để có type-safe queries"

    note for SchemaBundle "File: backend/src/drizzle/schema/schema.ts
    Re-export tất cả table + relations
    DrizzleDB = drizzle(pool, { schema })"

    note for InferredTypes~T~ "Drizzle tự động sinh từ pgTable():
    • $inferSelect = type của 1 row khi SELECT
    • $inferInsert = type khi INSERT (auto-generated fields optional)
    • $inferUpdate = type khi UPDATE (all fields optional)
    → Không cần định nghĩa thủ công!"

    note for usersRelations "Dùng trong nested queries:
    db.query.users.findMany({ with: { gamesAsWhite: true } })"
```

**Cách Service kết nối tới Drizzle:**

```
┌──────────────────────────────────────────────────────────────┐
│  Mọi Service (GameService, AuthService, ChatService, ...)    │
│  constructor(                                                │
│    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>│
│  ) {}                                                        │
│                                                              │
│  // Type-safe query:                                         │
│  const users = await this.db.select()                        │
│    .from(users)     // ← PgTable object                      │
│    .where(eq(users.id, userId));                             │
│  // users tự động có type: User[] (từ $inferSelect)          │
└──────────────────────────────────────────────────────────────┘
```

**Bảng tổng hợp các type phát sinh từ Drizzle:**

| Schema File | Table Object | Export | Inferred Row Type | Dùng trong Service |
|------------|-------------|--------|-------------------|-------------------|
| `users.schema.ts` | `users` | ✅ | `typeof users.$inferSelect` | AuthService, UserService, LeaderboardService |
| `users.schema.ts` | `friends` | ✅ | `typeof friends.$inferSelect` | UserService |
| `game.schema.ts` | `games` | ✅ | `typeof games.$inferSelect` | GameService, WatchService |
| `tournament.schema.ts` | `tournaments` | ✅ | `typeof tournaments.$inferSelect` | TournamentService |
| `tournament.schema.ts` | `tournamentParticipants` | ✅ | `typeof tournamentParticipants.$inferSelect` | TournamentService |
| `chat.schema.ts` | `chatRooms` | ✅ | `typeof chatRooms.$inferSelect` | ChatService |
| `chat.schema.ts` | `chatRoomMembers` | ✅ | `typeof chatRoomMembers.$inferSelect` | ChatService |
| `chat.schema.ts` | `messages` | ✅ | `typeof messages.$inferSelect` | ChatService |
| `profileInfo.schema.ts` | `profileInfo` | ✅ | `typeof profileInfo.$inferSelect` | UserService |
| `schema.ts` | `usersRelations` | ✅ | (relation definition) | (nested queries) |
| `schema.ts` | `gamesRelations` | ✅ | (relation definition) | (nested queries) |
| `schema.ts` | `profileInfoRelations` | ✅ | (relation definition) | (nested queries) |
| `types/drizzle.d.ts` | `DrizzleDB` | ✅ | `NodePgDatabase<typeof schema>` | **TẤT CẢ Service** |

> 💡 **Điểm khác biệt giữa ERD (1.2) và Drizzle ORM Layer (1.3)**:
> - **ERD (1.2)** thể hiện quan hệ giữa các **bảng database** (tầng vật lý — PostgreSQL).
> - **Drizzle ORM Layer (1.3)** thể hiện các **object/type trong code TypeScript** (tầng logic — `pgTable`, `NodePgDatabase`, `$inferSelect`).
> - `pgTable` object chính là "class phát sinh" — nó vừa là schema definition, vừa tự động sinh ra TypeScript type cho row, insert, update.

---

## 2. Module Game — Chi tiết

```mermaid
classDiagram
    direction TB

    class GameGateway {
        -Server server
        -Logger logger
        -Map connectedClients
        -Map reMatchIntervals
        -GameService gameService
        -AiService aiService
        +afterInit(server)
        +handleConnection(client)
        +handleDisconnect(client)
        +handleReconnectCheck(data)
        +handleFindGame(data)
        +handleCancelSearch(data)
        +handleMakeMove(data)
        +handleResign(data)
        +handleOfferDraw(data)
        +handleAcceptDraw(data)
        +handleDeclineDraw(data)
        +handleStartBotGame(data)
        +handleJoinGame(data)
        +handleClaimTimeout(data)
        +handleSendMessage(data)
        -startReMatchIntervals()
        -emitSearchProgress(timeControl)
        -createGameFromMatch(p1, p2, tc)
        -handleGameOver(gameId, game)
        -triggerBotMove(gameId)
        -triggerLeaderboardUpdate(game)
    }

    class GameService {
        -Logger logger
        -Redis redisClient
        -NodePgDatabase db
        -string matchmakeSha
        -string leaveQueueSha
        +onModuleInit()
        +joinQueue(entry, maxEloDiff) MatchmakingEntry|null
        +leaveQueue(userId, timeControl) void
        +getQueueSize(timeControl) number
        +getQueueEntries(timeControl) MatchmakingEntry[]
        +reMatchWaitingPlayers(tc) Match[]
        +getExpandedEloRange(joinedAt) number
        +generateGameId() string
        +createGameState(gameId, white, black, tc) GameState
        +processMove(gameId, userId, move) MoveResult|null
        +resign(gameId, userId) GameState
        +offerDraw(gameId, userId) boolean
        +acceptDraw(gameId) GameState
        +getGame(gameId) GameState|null
        +saveGame(game, ttl) void
        +deleteGame(gameId) void
        +getUserCurrentGame(userId) string|null
        +setUserCurrentGame(userId, gameId) void
        +clearUserCurrentGame(userId) void
        +saveGameToDb(gameId) void
        +getGameHistory(userId) Game[]
        +getPublicGameHistory(userId) Game[]
        +getGameById(gameId) Game|null
        +getGameMoveHistory(gameId) VerboseMove[]
        -gameKey(gameId) string
        -matchmakingKey(timeControl) string
        -userGameKey(userId) string
    }

    class AiService {
        -Logger logger
        +getBestMove(fen, difficulty, botColor) Move|null
        +evaluatePosition(fen) number
        -minimax(chess, depth, alpha, beta, maximizing) number
        -quiescence(chess, alpha, beta, maximizing) number
        -evaluate(chess) number
        -evaluateMaterial(chess) number
        -evaluatePst(chess) number
        -evaluateMobility(chess) number
        -orderMoves(moves, chess) Move[]
        -getRandomMove(chess) Move|null
    }

    class WatchGateway {
        -Server server
        -Logger logger
        -Map spectators
        -WatchService watchService
        -GameService gameService
        +afterInit(server)
        +handleConnection(client)
        +handleDisconnect(client)
        +handleWatchGame(data)
        +handleLeaveWatch(data)
        +handleListLiveGames(client)
        +broadcastGameUpdate(gameId, data)
        +broadcastGameOver(gameId, data)
        -handleLeaveInternal(client, gameId)
    }

    class LeaderboardGateway {
        -Server server
        -Logger logger
        -Map subscribedClients
        -LeaderboardService leaderboardService
        +afterInit()
        +handleConnection(client)
        +handleDisconnect(client)
        +handleSubscribe(data)
        +handleUnsubscribe(data)
        +handleRequest(data)
        +triggerEloUpdate(params)
        +broadcastLeaderboard(category, limit)
    }

    class TournamentGateway {
        -Server server
        -Logger logger
        -Map userSockets
        -Map clients
        -Map nextRoundTimers
        -TournamentService tournamentService
        +afterInit()
        +handleConnection(client)
        +handleDisconnect(client)
        +handleIdentify(data)
        +handleJoinRoom(data)
        +handleLeaveRoom(data)
        +broadcastTournamentUpdate(tournamentId, data)
        +notifyPlayer(userId, event, data)
        +setNextRoundTimer(tournamentId, ts)
        +clearNextRoundTimer(tournamentId)
    }

    class GameState {
        +string id
        +string fen
        +string pgn
        +string whiteId
        +string blackId
        +string whiteUsername
        +string blackUsername
        +string status
        +string timeControl
        +number whiteTimeMs
        +number blackTimeMs
        +string turn
        +number lastMoveAt
        +string winner
        +string[] moveHistory
        +VerboseMove[] verboseMoves
        +number createdAt
        +boolean isBot
        +string botDifficulty
        +string botColor
    }

    class MatchmakingEntry {
        +string userId
        +string username
        +number rating
        +string timeControl
        +string socketId
        +number joinedAt
    }

    class VerboseMove {
        +string color
        +string from
        +string to
        +string piece
        +string captured
        +string promotion
        +string flags
        +string san
        +string lan
        +string before
        +string after
    }

    class JoinGameDto {
        +string gameId
        +string userId
        +string username
        +string timeControl
    }

    class MakeMoveDto {
        +string gameId
        +string userId
        +Move move
    }

    class CreateGameDto {
        +string userId
        +string username
        +string timeControl
        +string side
    }

    class StartBotGameDto {
        +string userId
        +string username
        +string difficulty
        +string side
        +string timeControl
    }

    class GameController {
        +GET /game/history
        +GET /game/history/:userId
        +GET /game/:id
        +GET /game/:id/history
    }

    class LiveGameSummary {
        +string gameId
        +string whiteUsername
        +string blackUsername
        +string timeControl
        +number spectatorCount
        +number startedAt
        +string fen
        +number moveCount
    }

    GameGateway "1" --> "1" GameService : delegates
    GameGateway "1" --> "1" AiService : botMoves
    GameGateway "1" ..> "0..1" WatchGateway : broadcast
    GameGateway "1" ..> "0..1" LeaderboardGateway : ELO
    GameGateway "1" ..> "0..1" TournamentGateway : notify
    GameController "1" --> "1" GameService : REST

    GameService "1" --> "0..*" GameState : creates~& manages
    GameService "1" --> "0..*" MatchmakingEntry : queue entries
    GameService "1" ..> "0..*" VerboseMove : produces
    WatchService "1" ..> "0..*" LiveGameSummary : generates

    GameService "1" --> "1" Redis : MATCHMAKE_LUA + state
    GameService "1" --> "1" PostgreSQL : persist

    note for GameGateway "namespace: /chess — Matchmaking, nước đi, đầu hàng, hòa, bot game"
    note for GameService "Lua script atomic matchmaking ZSET, game state Redis, persist DB"
    note for AiService "Minimax Alpha-Beta + Quiescence Search + PST + Mobility evaluation"
    note for WatchGateway "namespace: /watch — Spectator mode: buffer updates, replay on join"
    note for LeaderboardGateway "namespace: /leaderboard — Real-time ELO + flash animation"
    note for TournamentGateway "namespace: /tournament — Tournament round countdown + notify"
    note for GameController "REST: GET /game/history, /game/history/:userId, /game/:id, /game/:id/history"
    note for GameState "DTO: Trạng thái game lưu trong Redis (TTL 3600s) — đầy đủ verboseMoves, isBot, winner…"
    note for MatchmakingEntry "DTO: Entry trong ZSET queue (score = rating)"
    note for VerboseMove "DTO: Chi tiết từng nước đi từ chess.js history({verbose:true})"
    note for JoinGameDto "DTO: Join game payload (gameId, userId, username, timeControl)"
    note for MakeMoveDto "DTO: Gửi nước đi (gameId, userId, from, to, promotion)"
    note for CreateGameDto "DTO: Tạo game mới (userId, timeControl, side)"
    note for StartBotGameDto "DTO: Bắt đầu game với bot (difficulty, side, timeControl)"
    note for LiveGameSummary "DTO: Tổng hợp game đang live cho WatchService.listActiveGames()"
```

---

## 3. Module Tournament — Chi tiết

```mermaid
classDiagram
    direction TB

    class TournamentGateway {
        -Server server
        -Logger logger
        -Map userSockets
        -Map clients
        -Map nextRoundTimers
        -TournamentService tournamentService
        +afterInit()
        +handleConnection(client)
        +handleDisconnect(client)
        +handleIdentify(data)
        +handleJoinRoom(data)
        +handleLeaveRoom(data)
        +broadcastTournamentUpdate(tournamentId, data)
        +notifyPlayer(userId, event, data)
        +setNextRoundTimer(tournamentId, ts)
        +clearNextRoundTimer(tournamentId)
    }

    class TournamentService {
        -NodePgDatabase db
        -Redis redis
        -TournamentSwissService swissService
        -GameService gameService
        +listTournaments()
        +getTournament(id)
        +getTournamentRounds(tournamentId)
        +getCurrentRound(tournamentId)
        +createTournament(creatorId, dto)
        +joinTournament(tournamentId, userId)
        +leaveTournament(tournamentId, userId)
        +startTournament(tournamentId, userId)
        +nextRound(tournamentId, userId?)
        +finishTournament(tournamentId, userId)
        +deleteTournament(tournamentId, userId, isAdmin)
        +recordTournamentResult(tournamentId, gameId, result)
        +getTournamentGameInfo(gameId)
        +getMyTournaments(userId)
    }

    class TournamentSwissService {
        -NodePgDatabase db
        +generateNextRoundPairs(tournamentId, nextRound)
        -resolveResult(whiteId, blackId, winnerId, status)
        -buildPlayerStats(tournamentId)
        -runSwissPairing(players, pastMatches, tournamentId, round)
        -buildScoreGroups(players)
        -pairGroup(players, pastMatches, round)
        -assignColor(p1, p2)
        -pairKey(id1, id2)
    }

    class TournamentController {
        +GET /tournament
        +GET /tournament/my
        +POST /tournament
        +GET /tournament/:id
        +GET /tournament/:id/rounds
        +POST /tournament/:id/join
        +DELETE /tournament/:id/leave
        +PATCH /tournament/:id/start
        +PATCH /tournament/:id/next-round
        +PATCH /tournament/:id/finish
        +DELETE /tournament/:id
    }

    class TournamentRound {
        +string tournamentId
        +number round
        +TournamentGame[] games
        +string status
    }

    class TournamentGame {
        +string gameId
        +string whiteId
        +string blackId
        +number round
        +string status
        +string result
    }

    class SwissPairing {
        +string gameId
        +string tournamentId
        +number round
        +string whiteId
        +string whiteUsername
        +string blackId
        +string blackUsername
        +string type
    }

    class SwissPlayer {
        +string userId
        +string username
        +number tournamentPoints
        +number rating
        +number whitesPlayed
        +number blacksPlayed
        +string[] colorHistory
        +boolean hadBye
    }

    class SwissPastMatch {
        +string whiteId
        +string blackId
        +string result
    }

    class SwissRoundResult {
        +string tournamentId
        +number round
        +SwissPairing[] pairings
    }

    class CreateTournamentDto {
        +string name
        +string format
        +string timeControl
        +string startTime
        +number maxPlayers
    }

    TournamentGateway "1" --> "1" TournamentService : delegates
    TournamentService "1" --> "1" TournamentSwissService : pairing
    TournamentService "1" --> "1" GameService : createGames
    TournamentController "1" --> "1" TournamentService : REST

    TournamentService "1" --> "0..*" TournamentRound : manages
    TournamentRound "1" --> "1..*" TournamentGame : contains
    TournamentSwissService "1" ..> "0..*" SwissPairing : generates
    TournamentSwissService "1" ..> "0..*" SwissPlayer : evaluates
    TournamentSwissService "1" ..> "0..*" SwissPastMatch : references
    TournamentSwissService "1" ..> "1" SwissRoundResult : produces

    TournamentGateway "1" --> "1" Redis : roundData
    TournamentService "1" --> "1" PostgreSQL : CRUD

    note for TournamentGateway "namespace: /tournament — Real-time update + countdown timer, tournament_identify, tournament_connected"
    note for TournamentService "Swiss pairings, round state Redis (TTL 7 ngày), game creation"
    note for TournamentSwissService "Score groups, color balancing, floater management, byes"
    note for TournamentController "REST API: CRUD tournament, join/leave, start/next/finish, my tournaments, rounds"
    note for TournamentRound "Redis-stored round data với array TournamentGame"
    note for TournamentGame "Kết quả từng game trong round (status: pending|active|finished)"
    note for SwissPairing "Pairing output: gameId, white, black, type (regular|bye)"
    note for SwissPlayer "Player stats: rating, điểm, color history, whites/blacks played"
    note for SwissPastMatch "Lịch sử cặp đấu đã diễn ra (whiteId, blackId, result)"
    note for SwissRoundResult "Output của generateNextRoundPairs (tournamentId, round, pairings[])"
    note for CreateTournamentDto "DTO tạo giải đấu (name, format, timeControl, startTime, maxPlayers)"
```

---

## 4. Module Chat — Chi tiết

```mermaid
classDiagram
    direction TB

    class ChatGateway {
        -Server server
        -Logger logger
        -Map clients
        -Map userSockets
        -Redis redis
        -ChatService chatService
        +afterInit(server)
        +handleConnection(client)
        +handleDisconnect(client)
        +handleIdentify(data)
        +handleJoinDm(data)
        +handleSendDm(data)
        +handleSendDirectMessage(data)
        +handleGetHistory(data)
        +handleTyping(data)
        +emitToUser(userId, event, data)
        -broadcastUserStatus(userId, username, isOnline)
    }

    class ChatService {
        -Logger logger
        -Redis redis
        -NodePgDatabase db
        +getOrCreatePrivateRoom(user1Id, user2Id)
        +saveMessage(roomId, senderId, senderUsername, content)
        +getMessages(roomId, limit)
        +getUserRooms(userId)
        -roomCacheKey(roomId)
    }

    class ChatRoom {
        +string id
        +string type
        +string friendId
        +string friendUsername
        +string lastMessage
        +number lastMessageAt
        +number unreadCount
    }

    class ChatMessage {
        +string id
        +string roomId
        +string senderId
        +string senderUsername
        +string content
        +number createdAt
    }

    class JoinRoomDto {
        +string userId
        +string username
        +string friendId
        +string friendUsername
    }

    class SendDmDto {
        +string roomId
        +string senderId
        +string senderUsername
        +string content
    }

    class GetHistoryDto {
        +string roomId
        +number limit
    }

    class SendDirectMessageDto {
        +string toUserId
        +string message
    }

    class DirectMessagePayload {
        +string fromUserId
        +string fromUsername
        +string toUserId
        +string message
        +string roomId
        +string messageId
        +number createdAt
    }

    ChatGateway "1" --> "1" ChatService : delegates
    ChatGateway "1" --> "1" Redis : online_users Hash
    ChatService "1" --> "0..*" ChatRoom : manages
    ChatService "1" --> "0..*" ChatMessage : persists
    ChatService "1" --> "1" PostgreSQL : chat_rooms + messages
    ChatGateway "1" --> "1" Redis : message cache List

    note for ChatGateway "namespace: /chat — Room-based DM + Redis direct routing, multi-tab, emitToUser"
    note for ChatService "Room CRUD, Redis cache 50 msg (LRU), TTL 1 giờ, persist DB"
    note for ChatRoom "Room type: private (DM) | game | tournament — friendId, unreadCount"
    note for ChatMessage "Tin nhắn: id, roomId, senderId, content, createdAt (timestamp ms)"
    note for JoinRoomDto "DTO: join_dm event (userId, username, friendId, friendUsername)"
    note for SendDmDto "DTO: send_dm event (roomId, senderId, senderUsername, content)"
    note for GetHistoryDto "DTO: get_dm_history event (roomId, limit)"
    note for SendDirectMessageDto "DTO: send_direct_message event (toUserId, message) — Redis routing"
    note for DirectMessagePayload "DTO: receive_direct_message payload — gửi cho cả sender + receiver"
```

---

## 5. Module Auth & User — Chi tiết

```mermaid
classDiagram
    direction TB

    class AuthController {
        +POST /auth/register
        +POST /auth/login
        +POST /auth/refresh
    }

    class AuthService {
        -NodePgDatabase db
        -JwtService jwtService
        -ConfigService configService
        +register(dto)
        +login(dto)
        +refreshTokens(refreshToken)
        -generateTokens(userId, username, email)
    }

    class LoginDto {
        +string identifier
        +string password
    }

    class RegisterDto {
        +string username
        +string email
        +string password
    }

    class UserController {
        +GET /user/me
        +PATCH /user/me
        +GET /user/:id
        +GET /user/:id/friendship
        +GET /user/friend-requests
        +POST /user/:id/friend-request
        +POST /user/:id/accept-friend
        +DELETE /user/:id/friend
    }

    class UserService {
        -NodePgDatabase db
        +getMe(userId)
        +updateMe(userId, dto)
        +getPublicProfile(userId)
        +getFriendshipStatus(myId, targetId)
        +getPendingRequests(userId)
        +sendFriendRequest(myId, targetId)
        +acceptFriendRequest(myId, requesterId)
        +removeFriend(myId, targetId)
    }

    class UpdateProfileDto {
        +string username
        +string bio
        +string country
        +string avatarUrl
    }

    class JwtAuthGuard {
        +canActivate(context)
    }

    class User {
        +string id
        +string username
        +string email
        +string passwordHash
        +number blitzRating
        +number rapidRating
        +number bulletRating
        +string role
    }

    class AuthTokens {
        +string accessToken
        +string refreshToken
    }

    AuthController "1" --> "1" AuthService : delegates
    AuthController "1" ..> "1" LoginDto : consumes
    AuthController "1" ..> "1" RegisterDto : consumes
    UserController "1" --> "1" UserService : delegates
    UserController "1" ..> "1" UpdateProfileDto : consumes

    AuthService "1" --> "1" User : manages
    AuthService "1" --> "1" AuthTokens : generates
    AuthService "1" --> "1" PostgreSQL : users table
    AuthService "1" --> "1" Redis : token store

    UserService "1" --> "1" PostgreSQL : users + profile_info + friends

    JwtAuthGuard "1" --> "1" AuthService : validate

    note for AuthController "REST: POST /auth/register, /login, /refresh"
    note for AuthService "JWT access (15m) + refresh (7d), bcrypt hash, token Redis store"
    note for LoginDto "DTO: identifier (email/username) + password"
    note for RegisterDto "DTO: username + email + password"
    note for UserController "REST: GET/PATCH /user/me, friends CRUD, public profile, friendship check"
    note for UserService "Profile CRUD, friend request (auto-accept nếu mutual), friendship cache"
    note for UpdateProfileDto "DTO: username?, bio?, country?, avatarUrl? (class-validator)"
    note for JwtAuthGuard "CanActivate: Bearer token extract + verify, attach user to request"
    note for User "DB Entity: users table (Drizzle ORM)"
    note for AuthTokens "DTO: accessToken + refreshToken"
```

---

## 6. Module Leaderboard — Chi tiết

```mermaid
classDiagram
    direction TB

    class LeaderboardGateway {
        -Server server
        -Logger logger
        -Map subscribedClients
        -LeaderboardService leaderboardService
        +afterInit()
        +handleConnection(client)
        +handleDisconnect(client)
        +handleSubscribe(data)
        +handleUnsubscribe(data)
        +handleRequest(data)
        +triggerEloUpdate(params)
        +broadcastLeaderboard(category, limit)
    }

    class LeaderboardService {
        -Logger logger
        -Redis redis
        -NodePgDatabase db
        +updateElo(dto)
        +getTopPlayers(category, limit, offset)
        +getPlayerRank(userId, category)
        +seedDemoData()
        -leaderboardKey(category)
        -playerDataKey(userId, category)
    }

    class LeaderboardEntry {
        +number rank
        +string userId
        +string username
        +number elo
        +number wins
        +number losses
        +number draws
        +number gamesPlayed
        +number winRate
        +string trend
        +number eloChange
    }

    class LeaderboardUpdate {
        +LeaderboardCategory category
        +LeaderboardEntry[] entries
        +number updatedAt
        +number totalPlayers
    }

    class UpdateEloDto {
        +string userId
        +string username
        +string category
        +number newElo
        +number eloDelta
        +number wins
        +number losses
        +number draws
    }

    class LeaderboardCategory {
        <<type>>
        "blitz" | "bullet" | "rapid"
    }

    class RankResult {
        +number rank
        +number totalPlayers
        +LeaderboardEntry player
    }

    LeaderboardGateway "1" --> "1" LeaderboardService : delegates
    LeaderboardService "1" ..> "0..*" LeaderboardEntry : produces
    LeaderboardService "1" ..> "1" LeaderboardUpdate : returns
    LeaderboardService "1" ..> "1" UpdateEloDto : consumes
    LeaderboardService "1" ..> "1" RankResult : returns
    LeaderboardService "1" --> "1" Redis : SortedSet~+ Hash
    LeaderboardService "1" --> "1" PostgreSQL : persist ELO

    note for LeaderboardGateway "namespace: /leaderboard — Subscribe category, flash animation rows"
    note for LeaderboardService "Redis ZSET O(log N) rank query, persist ELO + stats PostgreSQL"
    note for LeaderboardEntry "DTO: rank, elo, wins/losses/draws, winRate, trend, eloChange"
    note for LeaderboardUpdate "DTO response: category, entries[], updatedAt, totalPlayers"
    note for UpdateEloDto "DTO input: userId, category, newElo, eloDelta, wins, losses, draws"
    note for LeaderboardCategory "Union type: 'blitz' | 'bullet' | 'rapid'"
    note for RankResult "DTO: rank + totalPlayers + player data cho getPlayerRank()"
```

---

## 7. Frontend Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── ZUSTAND STORES ──
    class UserStore {
        -User user
        -boolean isAuthenticated
        -boolean isLoading
        +login(email, password) void
        +register(username, email, password) void
        +logout() void
        +fetchProfile() void
        +updateLocalElo(newElo) void
        +loadFromStorage() void
    }

    class GameStore {
        -GameState currentGame
        -boolean isSearching
        -number searchTime
        -GameOverResult gameOver
        -string errorMessage
        -SearchProgress searchProgress
        +setGame(game) void
        +updateMove(move) void
        +setGameOver(result) void
        +setSearching(bool) void
        +setSearchProgress(progress) void
        +setError(msg) void
        +reset() void
    }

    class TournamentStore {
        -Tournament[] tournaments
        -Tournament currentTournament
        -SwissPairing[] myPairings
        -number currentRound
        -number countdownSeconds
        -boolean isLoading
        +fetchTournaments() void
        +setCurrentTournament(t) void
        +setPairings(pairings) void
        +setCurrentRound(round) void
        +startCountdown(ms) void
        +clearCountdown() void
    }

    class ChatStore {
        -Map rooms
        -number totalUnread
        -string activeRoomId
        -Set onlineUsers
        -boolean isOpen
        +registerSendFns(send, sendTyping, sendDirect) void
        +openChat(friendId, friendUsername) void
        +closeChat() void
        +setActiveRoom(roomId) void
        +addRoom(room) void
        +addMessage(roomId, msg) void
        +setHistory(roomId, messages) void
        +markRead(roomId) void
        +setTyping(roomId, userId, bool) void
        +setUserOnline(userId, bool) void
        +upsertRoomForDirect(params) void
    }

    class WatchStore {
        -LiveGameSummary[] liveGames
        -WatchGameState watchingGame
        -boolean isLoadingGames
        -number spectatorCount
        -pendingUpdates
        +setLiveGames(games) void
        +setWatchingGame(game) void
        +updateGameState(update) void
        +setLoading(bool) void
        +clearWatch() void
    }

    class FriendStore {
        -Friend[] friends
        -PendingRequest[] pendingRequests
        -boolean isLoadingFriends
        -boolean isLoadingRequests
        -Map actionLoading
        -Map friendshipCache
        +loadFriends() void
        +loadPendingRequests() void
        +sendFriendRequest(targetId) void
        +acceptRequest(requesterId) void
        +declineRequest(requesterId) void
        +removeFriend(friendId) void
        +checkFriendship(targetId) void
        +invalidateFriendship(targetId) void
        +setFriendOnline(userId, isOnline) void
    }

    class ProfileStore {
        -UserProfile profile
        -PublicProfile viewingProfile
        -boolean isLoading
        -boolean isUpdating
        +fetchProfile() void
        +updateProfile(dto) void
        +fetchPublicProfile(userId) void
        +clearViewingProfile() void
    }

    %% ── LIBRARY HELPERS ──
    class ApiFetch {
        +apiFetch~T~(path, options) Promise~T~
        -BASE_URL string
    }

    class AuthLib {
        +AuthUser interface
        +AuthTokens interface
        +AuthResponse interface
        +RegisterPayload interface
        +LoginPayload interface
        +registerUser(payload) AuthResponse
        +loginUser(payload) AuthResponse
        +refreshAccessToken(refreshToken) AuthTokens
        +saveTokens(tokens) void
        +persistCookies(tokens) void
        +getUser() AuthUser|null
        +saveUser(user) void
    }

    %% ── CUSTOM HOOKS ──
    class UseChessSocket {
        -Socket socket
        -boolean connected
        -GameState game
        -string gameStatus
        -ChatMessage[] chatMessages
        -boolean drawOffered
        -string errorMessage
        -string searchingTimeControl
        -PositionAnalysis analysis
        -SearchProgress searchProgress
        +connect() void
        +findGame(timeControl, rating?) void
        +cancelSearch(timeControl) void
        +joinGame(gameId) void
        +makeMove(gameId, from, to, promotion?) void
        +resign(gameId) void
        +offerDraw(gameId) void
        +acceptDraw(gameId) void
        +declineDraw(gameId) void
        +sendChatMessage(gameId, message) void
        +startBotGame(difficulty) void
        +requestAnalysis(fen) void
    }

    class UseFriendChat {
        -Socket socket
        -boolean connected
        +connect(userId, username) void
        +openDm(friendId, friendUsername) void
        +sendMessage(roomId, content) void
        +sendDirectMessage(toUserId, content) void
        +sendTyping(roomId, isTyping) void
        +disconnect() void
    }

    class UseWatchSocket {
        -Socket socket
        -WatchGameState watchingGame
        -LiveGameSummary[] liveGames
        -boolean isLoadingGames
        -number spectatorCount
        -pendingUpdates
        +connect() void
        +fetchLiveGames() void
        +watchGame(gameId) void
        +leaveWatch(gameId) void
        +disconnect() void
    }

    class UseLeaderboard {
        -Socket socket
        -boolean connected
        -string category
        -LeaderboardData data
        -boolean loading
        -Set flashedRows
        +connect() void
        +switchCategory(newCategory) void
        +refresh() void
        +disconnect() void
    }

    class UseStockfish {
        -Worker stockfish
        -boolean isLoaded
        -string currentFen
        +load() void
        +getBestMove(fen, difficulty) Move|null
        +evaluatePosition(fen) StockfishEval
        +terminate() void
        -parseInfoLine(line, turn) Eval|null
        -sendAnalysis(worker, fen) void
    }

    %% ── UI COMPONENTS ──
    class ChessBoard {
        -string position
        -string[] legalMoves
        -boolean isFlipped
        -boolean isMyTurn
        +onPieceDrop(source, target) void
        +highlightLegalMoves(square) void
        +flipBoard() void
        +resetBoard() void
        -isDraggable() boolean
    }

    class ChatDrawer {
        -boolean isOpen
        -string selectedRoomId
        -Friend[] friendList
        +open() void
        +close() void
        +selectRoom(roomId) void
        +sendMessage(content) void
        +showUnreadBadge(count) void
    }

    class GameOverModal {
        -string winner
        -number eloChange
        -number oldElo
        -number newElo
        +showWinner(winner) void
        +showEloChange(delta, oldElo, newElo) void
        +close() void
    }

    class TournamentBracket {
        -SwissPlayer[] players
        -SwissPairing[] pairings
        -number countdownSeconds
        +showStandings(players) void
        +showPairings(pairings) void
        +showCountdown(seconds) void
    }

    class MatchmakingPanel {
        -string selectedTimeControl
        -boolean isSearching
        -number eloRange
        +selectTimeControl(tc) void
        +startSearch() void
        +cancelSearch() void
        -updateSearchProgress(progress) void
    }

    class LeaderboardTable {
        -string selectedCategory
        -LeaderboardEntry[] entries
        -Set flashedRows
        +sortByCategory(category) void
        +highlightChangedRows(rows) void
    }

    %% ── RELATIONSHIPS ──
    UseChessSocket "1" --> "1" GameStore : updates
    UseChessSocket "1" --> "1" UserStore : reads
    UseFriendChat "1" --> "1" ChatStore : updates
    UseWatchSocket "1" --> "1" WatchStore : syncs
    UseLeaderboard "1" --> "1" LeaderboardTable : feeds

    ChessBoard "1" --> "1" UseChessSocket : emits moves
    ChatDrawer "1" --> "1" UseFriendChat : emits messages
    ChatDrawer "1" --> "1" FriendStore : reads friends
    GameOverModal "1" --> "1" GameStore : reads result
    TournamentBracket "1" --> "1" TournamentStore : reads standings
    MatchmakingPanel "1" --> "1" UseChessSocket : emits queue
    LeaderboardTable "1" --> "1" UseLeaderboard : subscribes
    UseStockfish "1" ..> "1" ChessBoard : AI moves (dependency)

    UseChessSocket "1" ..> "1" ApiFetch : REST
    UseFriendChat "1" ..> "1" ApiFetch : REST
    FriendStore "1" ..> "1" ApiFetch : REST
    ProfileStore "1" ..> "1" ApiFetch : REST
    ProfileStore "1" ..> "1" AuthLib : tokens

    %% ── Chú thích ──
    note for UserStore "Zustand: Auth state, profile, ELO sync localStorage"
    note for GameStore "Zustand: Game state, search progress, game-over result"
    note for TournamentStore "Zustand: Tournament list, pairings, countdown timer"
    note for ChatStore "Zustand: Chat rooms, unread badges, online users, typing indicator"
    note for WatchStore "Zustand: Live game list, watching state, spectator count, pending updates buffer"
    note for FriendStore "Zustand: Friends list, pending requests, friendship cache, online status"
    note for ProfileStore "Zustand: Current user profile, public profile viewing, update flow"
    note for ApiFetch "Lib: apiFetch<T>() — base URL auto, auto Bearer token, error handling"
    note for AuthLib "Lib: Auth types (AuthUser, AuthTokens, AuthResponse) + register/login/refresh/token helpers"
    note for UseChessSocket "Hook: Socket.IO /chess - reconnect check, sessionStorage persistence"
    note for UseFriendChat "Hook: Socket.IO /chat - identify user, room + direct DM fallback"
    note for UseWatchSocket "Hook: Socket.IO /watch - buffer updates until watch_state received"
    note for UseLeaderboard "Hook: Socket.IO /leaderboard - category switch, flash animation"
    note for UseStockfish "Hook: Web Worker Stockfish WASM - UCI parse, debounce analysis"
    note for ChessBoard "UI: react-chessboard - drag & drop, legal move highlights"
    note for ChatDrawer "UI: Friend list, DM dialog, typing indicator, connection status"
    note for GameOverModal "UI: Winner display, ELO change +/- with glow effect"
    note for TournamentBracket "UI: Standings table, pairing display, countdown timer"
    note for MatchmakingPanel "UI: Time control selector, search animation, ELO range display"
    note for LeaderboardTable "UI: Sortable table, flash animation for changed rows"
```

---

## 8. Package/Subsystem Diagram

### 8.1 Kiến trúc phân tầng hệ thống

```mermaid
graph TB
    subgraph "🎨 FRONTEND — Next.js 16"
        direction TB
        PAGES["📄 Pages (App Router)"]
        COMPONENTS["🧩 Components"]
        STORES["🏪 Zustand Stores"]
        HOOKS["🪝 Custom Hooks"]
        LIB["📚 Lib (apiFetch, authUtils, chessUtils)"]

        PAGES --> COMPONENTS
        COMPONENTS --> HOOKS
        COMPONENTS --> STORES
        HOOKS --> STORES
        HOOKS --> LIB
    end

    subgraph "🔌 SOCKET.IO"
        SOCKET_IO["5 Namespaces:<br/> /chess · /chat · /watch<br/> /tournament · /leaderboard"]
    end

    subgraph "⚙️ BACKEND — NestJS"
        direction TB

        subgraph "Gateway Layer"
            GAME_GW["🎮 GameGateway"]
            WATCH_GW["👁️ WatchGateway"]
            CHAT_GW["💬 ChatGateway"]
            TOURN_GW["🏆 TournamentGateway"]
            LB_GW["📊 LeaderboardGateway"]
        end

        subgraph "Controller Layer"
            AUTH_CTRL["🔐 AuthController"]
            GAME_CTRL["🎮 GameController"]
            TOURN_CTRL["🏆 TournamentController"]
            USER_CTRL["👤 UserController"]
        end

        subgraph "Service Layer"
            GAME_SVC["🎮 GameService"]
            AI_SVC["🤖 AiService"]
            AUTH_SVC["🔐 AuthService"]
            CHAT_SVC["💬 ChatService"]
            TOURN_SVC["🏆 TournamentService"]
            SWISS_SVC["📐 TournamentSwissService"]
            LB_SVC["📊 LeaderboardService"]
            USER_SVC["👤 UserService"]
        end

        GAME_GW --> GAME_SVC
        WATCH_GW --> GAME_SVC
        CHAT_GW --> CHAT_SVC
        TOURN_GW --> TOURN_SVC
        LB_GW --> LB_SVC

        AUTH_CTRL --> AUTH_SVC
        GAME_CTRL --> GAME_SVC
        TOURN_CTRL --> TOURN_SVC
        USER_CTRL --> USER_SVC

        GAME_SVC --> AI_SVC
        GAME_SVC --> LB_SVC
        TOURN_SVC --> SWISS_SVC
        TOURN_SVC --> GAME_SVC
    end

    subgraph "💾 DATA LAYER"
        REDIS[( "🧠 Redis<br/>Game State · Queue · Leaderboard<br/>Online Users · Message Cache" )]
        POSTGRES[( "🐘 PostgreSQL<br/>users · games · tournaments<br/>chat · friends · profile" )]
    end

    FRONTEND <==>|"WebSocket"| SOCKET_IO
    FRONTEND -->|"REST API"| BACKEND
    SOCKET_IO <==> BACKEND
    BACKEND --> REDIS
    BACKEND --> POSTGRES

    style FRONTEND fill:#e3f2fd,stroke:#1565c0
    style BACKEND fill:#fff3e0,stroke:#ef6c00
    style REDIS fill:#ffebee,stroke:#c62828
    style POSTGRES fill:#e8f5e9,stroke:#2e7d32
    style SOCKET_IO fill:#f3e5f5,stroke:#7b1fa2
```

### 8.2 Subsystem Dependencies

```mermaid
graph LR
    subgraph "Frontend"
        FE["Next.js App"]
        FE_SOCKET["Socket.IO Client"]
        FE_API["REST Client"]
    end

    subgraph "Backend Modules"
        APP["AppModule (Root)"]
        AUTH["AuthModule"]
        USER["UserModule"]
        GAME["GameModule"]
        AI["AiModule"]
        WATCH["WatchModule"]
        CHAT["ChatModule"]
        TOURNAMENT["TournamentModule"]
        LEADERBOARD["LeaderboardModule"]
        REDIS_MOD["RedisModule"]
        DRIZZLE_MOD["DrizzleModule"]
    end

    subgraph "Infrastructure"
        REDIS_SRV["Redis Server"]
        PG_SRV["PostgreSQL"]
    end

    APP --> AUTH
    APP --> USER
    APP --> GAME
    APP --> AI
    APP --> WATCH
    APP --> CHAT
    APP --> TOURNAMENT
    APP --> LEADERBOARD
    APP --> REDIS_MOD
    APP --> DRIZZLE_MOD

    GAME --> AI
    GAME --> LEADERBOARD
    GAME --> REDIS_MOD
    GAME --> DRIZZLE_MOD

    TOURNAMENT --> GAME
    TOURNAMENT --> REDIS_MOD
    TOURNAMENT --> DRIZZLE_MOD

    CHAT --> REDIS_MOD
    CHAT --> DRIZZLE_MOD

    AUTH --> REDIS_MOD
    AUTH --> DRIZZLE_MOD

    USER --> DRIZZLE_MOD
    LEADERBOARD --> REDIS_MOD
    LEADERBOARD --> DRIZZLE_MOD
    WATCH --> GAME

    REDIS_MOD --> REDIS_SRV
    DRIZZLE_MOD --> PG_SRV

    FE_SOCKET -->|"/chess"| GAME
    FE_SOCKET -->|"/chat"| CHAT
    FE_SOCKET -->|"/watch"| WATCH
    FE_SOCKET -->|"/tournament"| TOURNAMENT
    FE_SOCKET -->|"/leaderboard"| LEADERBOARD
    FE_API -->|"REST"| AUTH
    FE_API -->|"REST"| GAME
    FE_API -->|"REST"| TOURNAMENT
    FE_API -->|"REST"| USER
```

---

## 9. Mối liên hệ với Sequence Diagram

| Class | Vai trò | Sequence Diagram |
|-------|---------|-------------------|
| **GameGateway** | WebSocket `/chess` | Matchmaking, Đi cờ, Đầu hàng, Hòa, Timeout, Play Bot |
| **GameService** | Business logic game | Tất cả game flows |
| **GameController** | REST API game | Lịch sử trận, Chi tiết game, Move history |
| **AiService** | AI engine (Minimax + Alpha-Beta) | Play Bot |
| **WatchGateway** | WebSocket `/watch` | Spectator mode |
| **WatchService** | Spectator counter + live game discovery | List active games |
| **ChatGateway** | WebSocket `/chat` | Room-based DM, Direct/Redis-based DM, In-game chat |
| **ChatService** | Chat business logic | DM flows |
| **TournamentGateway** | WebSocket `/tournament` | Join, Start, Play, Countdown, Finish |
| **TournamentService** | Tournament logic | Tất cả tournament flows |
| **TournamentSwissService** | Swiss pairing algorithm | Create, Start, Next round |
| **TournamentController** | REST API tournament | CRUD tournament, Join/Leave, My tournaments, Rounds |
| **LeaderboardGateway** | WebSocket `/leaderboard` | Xem BXH, ELO update |
| **LeaderboardService** | ELO ranking & stats | BXH, Tính ELO, Get player rank |
| **AuthController** | REST API auth | Register, Login, Refresh |
| **AuthService** | JWT, bcrypt | Auth flows |
| **UserController** | REST API user | Profile, Friends (request/accept/remove/status) |
| **UserService** | Profile & friends | Profile CRUD, Friend request, Friendship status |

### DTO / Interface bổ sung

| DTO / Interface | Module | Vai trò |
|-----------------|--------|---------|
| **VerboseMove** | Game | Chi tiết từng nước đi (chess.js verbose history) |
| **JoinGameDto** | Game | Join game payload |
| **MakeMoveDto** | Game | Gửi nước đi |
| **CreateGameDto** | Game | Tạo game mới |
| **StartBotGameDto** | Game | Bắt đầu game với bot |
| **LoginDto** | Auth | Đăng nhập (identifier + password) |
| **RegisterDto** | Auth | Đăng ký (username + email + password) |
| **UpdateProfileDto** | User | Cập nhật profile (username, bio, country, avatarUrl) |
| **JoinRoomDto** | Chat | Join DM room |
| **SendDmDto** | Chat | Gửi tin nhắn room-based |
| **GetHistoryDto** | Chat | Lấy lịch sử chat |
| **SendDirectMessageDto** | Chat | Gửi tin nhắn Redis-based |
| **DirectMessagePayload** | Chat | Payload receive_direct_message |
| **LeaderboardUpdate** | Leaderboard | Response: category, entries[], updatedAt, totalPlayers |
| **LeaderboardCategory** | Leaderboard | Union type: 'blitz' \| 'bullet' \| 'rapid' |
| **RankResult** | Leaderboard | Rank + totalPlayers + player data |
| **SwissPastMatch** | Tournament | Lịch sử cặp đấu (whiteId, blackId, result) |
| **SwissRoundResult** | Tournament | Output generateNextRoundPairs |
| **CreateTournamentDto** | Tournament | DTO tạo giải đấu |
| **LiveGameSummary** | Watch | Tổng hợp game đang live cho spectator list |
| **WatchStore** | Frontend | Zustand: live games, watching state, spectator count |
| **FriendStore** | Frontend | Zustand: friends, pending requests, friendship cache |
| **ProfileStore** | Frontend | Zustand: user profile, public profile viewing |
| **apiFetch** | Frontend | Lib: REST API helper với auto Bearer token |
| **auth.ts types** | Frontend | Lib: AuthUser, AuthTokens, AuthResponse, RegisterPayload, LoginPayload |

---

## Phụ lục: Ký hiệu UML trong Class Diagram

> 📘 **Xem đầy đủ**: [UML Relationship Arrows — Toàn Tập](uml-relationship-arrows.md) — bao gồm cây quyết định chọn đúng loại quan hệ, ví dụ chi tiết, và Mermaid cheat sheet.

### Tóm tắt 6 loại quan hệ

| # | Loại | Mermaid | Mũi tên | Ý nghĩa | Dùng trong dự án |
|---|------|---------|---------|---------|-----------------|
| 1 | Kế thừa | `--|>` | ────▷ | IS-A | Ít dùng (NestJS dùng DI) |
| 2 | Implementation | `..|>` | - - -▷ | CAN-DO (implements interface) | Gateway → NestJS lifecycle |
| 3 | Composition | `*--` | ◆─── | IS-PART-OF mạnh | Round → Game |
| 4 | Aggregation | `o--` | ◇─── | HAS-A yếu | Tournament → Participant |
| 5 | Association | `-->` | ────→ | KNOWS-A (giữ reference) | Gateway → Service |
| 6 | Dependency | `..>` | - - -→ | USES tạm thời | Gateway → Gateway (event) |

### Multiplicity

| Ký hiệu | Ý nghĩa |
|---------|---------|
| `"1"` | Đúng 1 |
| `"0..1"` | 0 hoặc 1 |
| `"0..*"` | 0 hoặc nhiều |
| `"1..*"` | Ít nhất 1 |

### Members

| Ký hiệu | Ý nghĩa |
|---------|---------|
| `+method()` | Public |
| `-method()` | Private |
| `#method()` | Protected |
