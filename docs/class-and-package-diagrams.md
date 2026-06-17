# Class Diagram & Package/Subsystem Diagram — Hệ Thống Cờ Vua Trực Tuyến

> Tài liệu này bổ sung Class Diagram và Package/Subsystem Diagram dựa trên các [Sequence Diagram](sequence-diagrams.md) đã có.  
> **Đã cập nhật (15/06/2026)**: Tên method chính xác theo source code + quan hệ multiplicity (1-1, 1-n, n-m).  
> Dùng [Mermaid Live Editor](https://mermaid.live/) hoặc Markdown Preview trên IDE để xem trực quan.

---

## Mục Lục

1. [Backend Class Diagram — Tổng quan](#1-backend-class-diagram--tổng-quan)
   - [1.1 Toàn bộ class backend (với Multiplicity)](#11-toàn-bộ-class-backend-với-multiplicity)
   - [1.2 Database Entities — Quan hệ ERD (với Multiplicity)](#12-database-entities--quan-hệ-erd-với-multiplicity)
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

### 1.1 Backend Class Diagram — Gateways & Services

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
    }

    class WatchGateway {
        +handleWatchGame(data)
        +handleLeaveWatch(data)
        +broadcastGameUpdate(gameId, move)
        +broadcastGameOver(gameId, result)
    }

    class ChatGateway {
        +handleIdentify(data)
        +handleJoinDm(data)
        +handleSendDm(data)
        +handleSendDirectMessage(data)
        +handleGetHistory(data)
        +handleTyping(data)
    }

    class TournamentGateway {
        +handleIdentify(data)
        +handleJoinRoom(data)
        +handleLeaveRoom(data)
        +broadcastTournamentUpdate(tournamentId, data)
        +notifyPlayer(userId, event, data)
    }

    class LeaderboardGateway {
        +handleSubscribe(data)
        +handleUnsubscribe(data)
        +handleRequest(data)
        +triggerEloUpdate(params)
        +broadcastLeaderboard(category)
    }

    %% ═══════════════════════════════════════════════════════
    %% SERVICES (Business Logic)
    %% ═══════════════════════════════════════════════════════
    class GameService {
        +joinQueue(entry, maxEloDiff) MatchmakingEntry
        +leaveQueue(userId, timeControl) void
        +createGameState(gameId, white, black, tc) GameState
        +processMove(gameId, userId, move) MoveResult
        +resign(gameId, userId) GameState
        +offerDraw(gameId, userId) boolean
        +acceptDraw(gameId) GameState
        +getGame(gameId) GameState
        +saveGameToDb(gameId) void
        +getGameHistory(userId) Game[]
    }

    class AiService {
        +getBestMove(fen, difficulty, botColor) Move
        +evaluatePosition(fen) number
        -minimax(chess, depth, alpha, beta, maximizing) number
    }

    class AuthService {
        +register(dto) AuthResult
        +login(dto) AuthResult
        +refreshTokens(refreshToken) AuthTokens
    }

    class ChatService {
        +getOrCreatePrivateRoom(user1Id, user2Id) string
        +saveMessage(roomId, senderId, senderUsername, content) ChatMessage
        +getMessages(roomId, limit) ChatMessage[]
        +getUserRooms(userId) string[]
    }

    class TournamentService {
        +listTournaments() Tournament[]
        +getTournament(id) Tournament
        +createTournament(creatorId, dto) Tournament
        +joinTournament(tournamentId, userId) void
        +leaveTournament(tournamentId, userId) void
        +startTournament(tournamentId, userId) RoundResult
        +nextRound(tournamentId, userId?) RoundResult
        +finishTournament(tournamentId, userId) void
        +deleteTournament(tournamentId, userId, isAdmin) void
    }

    class TournamentSwissService {
        +generateNextRoundPairs(tournamentId, nextRound) SwissRoundResult
        -buildPlayerList(tournamentId) SwissPlayer[]
        -pairPlayers(players, pastMatches) SwissPairing[]
        -calculateTiebreaks(player) number
    }

    class LeaderboardService {
        +updateElo(dto) void
        +getTopPlayers(category, limit, offset) LeaderboardUpdate
        +getPlayerRank(userId, category) RankResult
    }

    class UserService {
        +getMe(userId) UserProfile
        +updateMe(userId, dto) void
        +getPublicProfile(userId) PublicProfile
        +sendFriendRequest(fromId, toUsername) void
        +respondFriendRequest(requestId, accept) void
        +getFriendList(userId) Friend[]
    }

    class WatchService {
        +addSpectator(gameId) number
        +removeSpectator(gameId) number
        +getSpectatorCount(gameId) number
        +listActiveGames() LiveGameSummary[]
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

    %% ─── Namespace annotations ───
    note for GameGateway "namespace: /chess"
    note for WatchGateway "namespace: /watch"
    note for ChatGateway "namespace: /chat"
    note for TournamentGateway "namespace: /tournament"
    note for LeaderboardGateway "namespace: /leaderboard"
```

| Loại quan hệ | Mũi tên | Màu sắc ý nghĩa | Áp dụng |
|-------------|---------|-----------------|---------|
| **Association** | `-->` (liền →) | 🔵 Gateway→Service, Service→Service | Giữ reference trực tiếp |
| **Dependency** | `..>` (đứt →) | 🟠 Gateway→Gateway | Giao tiếp gián tiếp qua event |
| **Implementation** | `..\|>` (đứt ▷) | 🟢 Gateway→Interface | Implements NestJS lifecycle |

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

## 2. Module Game — Chi tiết

```mermaid
classDiagram
    direction TB

    class GameGateway {
        -Map connectedClients
        -Map reMatchIntervals
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
        -createGameFromMatch(p1, p2, tc)
        -handleGameOver(gameId, game)
        -triggerBotMove(gameId)
        -triggerLeaderboardUpdate(game)
    }

    class GameService {
        -Redis redisClient
        -NodePgDatabase db
        +joinQueue(entry, maxEloDiff)
        +leaveQueue(userId, timeControl)
        +reMatchWaitingPlayers(tc)
        +createGameState(gameId, white, black, tc)
        +processMove(gameId, userId, move)
        +resign(gameId, userId)
        +offerDraw(gameId, userId)
        +acceptDraw(gameId)
        +getGame(gameId)
        +saveGame(game, ttl)
        +saveGameToDb(gameId)
        +getGameHistory(userId)
        +clearUserCurrentGame(userId)
    }

    class AiService {
        +getBestMove(fen, difficulty, botColor)
        +evaluatePosition(fen)
        -minimax(chess, depth, alpha, beta, maximizing)
        -quiescence(chess, alpha, beta, maximizing)
        -evaluate(chess)
        -orderMoves(moves, chess)
    }

    class WatchGateway {
        +handleWatchGame(data)
        +broadcastGameUpdate(gameId, move)
        +broadcastGameOver(gameId, result)
    }

    class LeaderboardGateway {
        +triggerEloUpdate(params)
    }

    class TournamentGateway {
        +broadcastTournamentUpdate(tId, data)
        +notifyPlayer(userId, event, data)
    }

    class GameState {
        +string id
        +string fen
        +string pgn
        +string whiteId
        +string blackId
        +string status
        +number whiteTimeMs
        +number blackTimeMs
        +string turn
        +string[] moveHistory
    }

    class MatchmakingEntry {
        +string userId
        +string username
        +number rating
        +string timeControl
        +string socketId
        +number joinedAt
    }

    GameGateway "1" --> "1" GameService : delegates
    GameGateway "1" --> "1" AiService : botMoves
    GameGateway "1" ..> "0..1" WatchGateway : broadcast
    GameGateway "1" ..> "0..1" LeaderboardGateway : ELO
    GameGateway "1" ..> "0..1" TournamentGateway : notify

    GameService "1" --> "0..*" GameState : creates~& manages
    GameService "1" --> "0..*" MatchmakingEntry : queue entries

    GameService "1" --> "1" Redis : MATCHMAKE_LUA + state
    GameService "1" --> "1" PostgreSQL : persist

    note for GameGateway "namespace: /chess"
    note for WatchGateway "namespace: /watch"
    note for LeaderboardGateway "namespace: /leaderboard"
    note for TournamentGateway "namespace: /tournament"
```

---

## 3. Module Tournament — Chi tiết

```mermaid
classDiagram
    direction TB

    class TournamentGateway {
        -Map userSockets
        -Map clients
        -Map nextRoundTimers
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
        +createTournament(creatorId, dto)
        +joinTournament(tournamentId, userId)
        +leaveTournament(tournamentId, userId)
        +startTournament(tournamentId, userId)
        +nextRound(tournamentId, userId?)
        +finishTournament(tournamentId, userId)
        +deleteTournament(tournamentId, userId, isAdmin)
        +recordTournamentResult(tournamentId, gameId, result)
        +getTournamentGameInfo(gameId)
    }

    class TournamentSwissService {
        -NodePgDatabase db
        +generateNextRoundPairs(tournamentId, nextRound)
        -buildPlayerList(tournamentId)
        -pairPlayers(players, pastMatches)
        -calculateTiebreaks(player)
    }

    class TournamentController {
        +GET /tournament
        +POST /tournament
        +GET /tournament/:id
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
        +string whiteId
        +string blackId
        +number round
        +string type
    }

    class SwissPlayer {
        +string userId
        +number tournamentPoints
        +number rating
        +number whitesPlayed
        +number blacksPlayed
        +string[] colorHistory
        +boolean hadBye
    }

    TournamentGateway "1" --> "1" TournamentService : delegates
    TournamentService "1" --> "1" TournamentSwissService : pairing
    TournamentService "1" --> "1" GameService : createGames
    TournamentController "1" --> "1" TournamentService : REST

    TournamentService "1" --> "0..*" TournamentRound : manages
    TournamentRound "1" --> "1..*" TournamentGame : contains
    TournamentSwissService "1" ..> "0..*" SwissPairing : generates
    TournamentSwissService "1" ..> "0..*" SwissPlayer : evaluates

    TournamentGateway "1" --> "1" Redis : roundData
    TournamentService "1" --> "1" PostgreSQL : CRUD
```

---

## 4. Module Chat — Chi tiết

```mermaid
classDiagram
    direction TB

    class ChatGateway {
        -Map clients
        -Map userSockets
        -Redis redis
        -ChatService chatService
        +handleIdentify(data)
        +handleJoinDm(data)
        +handleSendDm(data)
        +handleSendDirectMessage(data)
        +handleGetHistory(data)
        +handleTyping(data)
        -broadcastUserStatus(userId, username, isOnline)
    }

    class ChatService {
        -NodePgDatabase db
        -Redis redis
        +getOrCreatePrivateRoom(user1Id, user2Id)
        +saveMessage(roomId, senderId, senderUsername, content)
        +getMessages(roomId, limit)
        +getUserRooms(userId)
    }

    class ChatRoom {
        +string id
        +string type
        +string referenceId
    }

    class Message {
        +string id
        +string roomId
        +string senderId
        +string senderUsername
        +string content
        +Date createdAt
    }

    ChatGateway "1" --> "1" ChatService : delegates
    ChatGateway "1" --> "1" Redis : online_users Hash
    ChatService "1" --> "0..*" ChatRoom : manages
    ChatService "1" --> "0..*" Message : persists
    ChatService "1" --> "1" PostgreSQL : chat_rooms + messages
    ChatGateway "1" --> "1" Redis : message cache List
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
        +register(dto)
        +login(dto)
        +refreshTokens(refreshToken)
        -generateTokens(userId, username, email)
    }

    class UserController {
        +GET /user/me
        +PATCH /user/me
        +GET /user/:id
        +GET /user/friend-requests
        +POST /user/friends/request
        +PUT /user/friends/respond
        +GET /user/friends
    }

    class UserService {
        -NodePgDatabase db
        +getMe(userId)
        +updateMe(userId, dto)
        +getPublicProfile(userId)
        +getPendingRequests(userId)
        +sendFriendRequest(fromId, toUsername)
        +respondFriendRequest(requestId, accept)
        +getFriendList(userId)
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
    UserController "1" --> "1" UserService : delegates

    AuthService "1" --> "1" User : manages
    AuthService "1" --> "1" AuthTokens : generates
    AuthService "1" --> "1" PostgreSQL : users table
    AuthService "1" --> "1" Redis : token store

    UserService "1" --> "1" PostgreSQL : users + profile_info + friends

    JwtAuthGuard "1" --> "1" AuthService : validate
```

---

## 6. Module Leaderboard — Chi tiết

```mermaid
classDiagram
    direction TB

    class LeaderboardGateway {
        -Map subscribedClients
        +handleSubscribe(data)
        +handleUnsubscribe(data)
        +handleRequest(data)
        +triggerEloUpdate(params)
        +broadcastLeaderboard(category)
    }

    class LeaderboardService {
        -Redis redis
        -NodePgDatabase db
        +updateElo(dto)
        +getTopPlayers(category, limit, offset)
        +getPlayerRank(userId, category)
        +seedDemoData()
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

    LeaderboardGateway "1" --> "1" LeaderboardService : delegates
    LeaderboardService "1" ..> "0..*" LeaderboardEntry : produces
    LeaderboardService "1" ..> "1" UpdateEloDto : consumes
    LeaderboardService "1" --> "1" Redis : SortedSet~+ Hash
    LeaderboardService "1" --> "1" PostgreSQL : persist ELO
```

---

## 7. Frontend Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── ZUSTAND STORES ──
    class UserStore {
        +User user
        +boolean isAuthenticated
        +login(email, password)
        +register(data)
        +logout()
        +fetchProfile()
        +updateLocalElo(newElo)
    }

    class GameStore {
        +GameState currentGame
        +boolean isSearching
        +number searchTime
        +GameOverResult gameOver
        +setGame(game)
        +updateMove(move)
        +setGameOver(result)
        +setSearching(bool)
        +reset()
    }

    class TournamentStore {
        +Tournament[] tournaments
        +Tournament currentTournament
        +SwissPairing[] myPairings
        +number currentRound
        +number countdownSeconds
        +fetchTournaments()
        +setCurrentTournament(t)
        +setPairings(pairings)
        +startCountdown(ms)
        +clearCountdown()
    }

    class ChatStore {
        +Map rooms
        +number totalUnread
        +string activeRoomId
        +upsertRoomForDirect(msg)
        +addMessage(roomId, msg)
        +setActiveRoom(roomId)
        +markRead(roomId)
        +setTyping(roomId, userId, bool)
    }

    %% ── CUSTOM HOOKS ──
    class UseChessSocket {
        -Socket socket
        +connect()
        +joinQueue(timeControl)
        +makeMove(from, to, promotion)
        +resign()
        +offerDraw()
        +startBotGame(difficulty, color)
    }

    class UseFriendChat {
        -Socket socket
        +connect(userId)
        +sendMessage(roomId, content)
        +sendDirectMessage(toUserId, content)
        +joinDm(friendId)
    }

    class UseWatchSocket {
        -Socket socket
        +connect()
        +watchGame(gameId)
        +leaveWatch()
    }

    class UseLeaderboard {
        -Socket socket
        +subscribe(category)
        +unsubscribe()
    }

    class UseStockfish {
        -Worker stockfish
        +load()
        +getBestMove(fen, difficulty)
        +terminate()
    }

    %% ── UI COMPONENTS ──
    class ChessBoard {
        +onPieceDrop(source, target)
        +highlightLegalMoves(square)
        +flipBoard()
    }

    class ChatDrawer {
        +selectRoom(roomId)
        +sendMessage(content)
        +showUnreadBadge(count)
    }

    class GameOverModal {
        +showWinner(winner)
        +showEloChange(delta, oldElo, newElo)
    }

    class TournamentBracket {
        +showStandings(players)
        +showCountdown(seconds)
    }

    class MatchmakingPanel {
        +selectTimeControl(tc)
        +cancelSearch()
    }

    class LeaderboardTable {
        +sortByCategory(category)
    }

    %% ── RELATIONSHIPS ──
    UseChessSocket "1" --> "1" GameStore : updates
    UseChessSocket "1" --> "1" UserStore : reads
    UseFriendChat "1" --> "1" ChatStore : updates

    ChessBoard "1" --> "1" UseChessSocket : emits
    ChatDrawer "1" --> "1" UseFriendChat : emits
    GameOverModal "1" --> "1" GameStore : reads
    TournamentBracket "1" --> "1" TournamentStore : reads
    MatchmakingPanel "1" --> "1" UseChessSocket : emits
    LeaderboardTable "1" --> "1" UseLeaderboard : subscribes
    UseStockfish "1" --> "1" ChessBoard : AI moves

    note for UseChessSocket "namespace: /chess"
    note for UseFriendChat "namespace: /chat"
    note for UseWatchSocket "namespace: /watch"
    note for UseLeaderboard "namespace: /leaderboard"
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
| **AiService** | AI engine (Minimax + Alpha-Beta) | Play Bot |
| **WatchGateway** | WebSocket `/watch` | Spectator mode |
| **ChatGateway** | WebSocket `/chat` | Room-based DM, Direct/Redis-based DM, In-game chat |
| **ChatService** | Chat business logic | DM flows |
| **TournamentGateway** | WebSocket `/tournament` | Join, Start, Play, Countdown, Finish |
| **TournamentService** | Tournament logic | Tất cả tournament flows |
| **TournamentSwissService** | Swiss pairing algorithm | Create, Start, Next round |
| **LeaderboardGateway** | WebSocket `/leaderboard` | Xem BXH, ELO update |
| **LeaderboardService** | ELO ranking & stats | BXH, Tính ELO |
| **AuthController** | REST API auth | Register, Login, Refresh |
| **AuthService** | JWT, bcrypt | Auth flows |
| **UserController** | REST API user | Profile, Friends |
| **UserService** | Profile & friends | Profile, Friends |
| **GameController** | REST API game | Lịch sử trận, Chi tiết game |
| **TournamentController** | REST API tournament | CRUD tournament, Join/Leave |

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
