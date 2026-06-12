# Sơ Đồ Hệ Thống (Subsystem / Package Diagram)

## ✅ Kết Quả Kiểm Tra Khớp Code (2026-06-12)

| Module trong Sơ Đồ | File code tương ứng | Trạng thái |
|---|---|---|
| `Auth_Module` | `backend/src/auth/auth.module.ts` | ✅ Khớp |
| `User_Module` | `backend/src/user/user.module.ts` | ✅ Khớp |
| `Matchmaking_Module` | `backend/src/game/game.service.ts` (Lua scripts + queue) | ✅ Khớp (nằm trong GameModule) |
| `Gameplay_Module` | `backend/src/game/game.service.ts` (processMove, resign, draw) | ✅ Khớp (nằm trong GameModule) |
| `Tournament_Module` | `backend/src/tournament/tournament.module.ts` | ✅ Khớp |
| `Chat_Module` | `backend/src/chat/chat.module.ts` | ✅ Khớp |
| `Watch_Module` | `backend/src/watch/watch.module.ts` | ✅ Khớp |
| `AI_Module` | `backend/src/ai/ai.module.ts` | ✅ Khớp (import bởi GameModule) |
| `Leaderboard_Module` | `backend/src/leaderboard/leaderboard.module.ts` | ✅ Khớp |
| `Redis_Module` | `backend/src/redis/redis.module.ts` | ✅ Khớp (`@Global()`) |
| `Database_Access_Layer` | `backend/src/drizzle/drizzle.module.ts` | ✅ Khớp |

> **Kết luận**: Sơ đồ subsystem **đã được hiệu chỉnh** (2026-06-12): sửa chiều phụ thuộc, bổ sung Gateway namespaces, trình bày lại theo chuẩn UML Package Diagram với `«stereotype»`.

---

## 1. Subsystem / Package Diagram (Tổng Quan Hệ Thống)

```mermaid
flowchart TB
    %% ── Style Definitions ──────────────────────────────
    classDef client fill:#1e3a5f,stroke:#4fc3f7,color:#e0f0ff
    classDef business fill:#1b3a1b,stroke:#66bb6a,color:#d4f5d4
    classDef infra fill:#2d1f3d,stroke:#ce93d8,color:#f3e5f5
    classDef data fill:#3e2723,stroke:#ff8a65,color:#ffe0d0

    %% ═══════════════════════════════════════════════
    %% CLIENT TIER
    %% ═══════════════════════════════════════════════
    subgraph CLIENT["🌐 Client Tier"]
        direction LR
        NEXT["Next.js Client<br/><i>React 19 · Zustand · Socket.IO Client</i>"]
    end

    %% ═══════════════════════════════════════════════
    %% BACKEND TIER
    %% ═══════════════════════════════════════════════
    subgraph BACKEND["⚙️ Backend Tier — NestJS"]
        direction TB

        subgraph BUSINESS["📦 Business Modules"]
            direction LR
            AUTH["AuthModule<br/><i>JWT · Guards</i><br/>📡 REST"]
            USER["UserModule<br/><i>Profile · Friends</i><br/>📡 REST"]
            GAME["GameModule<br/><i>Matchmaking · Gameplay</i><br/>🔌 WS /chess · 📡 REST"]
            AI["AIModule<br/><i>Stockfish WASM</i>"]
            TOUR["TournamentModule<br/><i>Swiss Pairing</i><br/>🔌 WS /tournament · 📡 REST"]
            CHAT["ChatModule<br/><i>Direct Message 1-1</i><br/>🔌 WS /chat"]
            WATCH["WatchModule<br/><i>Spectator Mode</i><br/>🔌 WS /watch"]
            LB["LeaderboardModule<br/><i>ELO FIDE · Rankings</i><br/>🔌 WS /leaderboard · 📡 REST"]
        end

        subgraph INFRA["🔧 Infrastructure"]
            direction LR
            REDIS_M["RedisModule<br/><i>ioredis client</i><br/>🌐 @Global()"]
            DRIZZLE["DrizzleModule<br/><i>Drizzle ORM · Migrations</i>"]
        end
    end

    %% ═══════════════════════════════════════════════
    %% DATA TIER
    %% ═══════════════════════════════════════════════
    subgraph DATA["🗄️ Data Tier"]
        direction LR
        PG[("PostgreSQL<br/><i>users · games · tournaments<br/>messages · chat_rooms</i>")]
        REDIS_D[("Redis<br/><i>Game State · Online Users<br/>Matchmaking Queue · Cache</i>")]
    end

    %% ═══════════════════════════════════════════════
    %% 1. Client → Backend («REST» / «WebSocket»)
    %% ═══════════════════════════════════════════════
    NEXT -.->|"«REST»"| AUTH
    NEXT -.->|"«REST»"| USER
    NEXT -.->|"«WebSocket» /chess"| GAME
    NEXT -.->|"«REST+WS» /tournament"| TOUR
    NEXT -.->|"«WebSocket» /chat"| CHAT
    NEXT -.->|"«WebSocket» /watch"| WATCH
    NEXT -.->|"«REST+WS» /leaderboard"| LB

    %% ═══════════════════════════════════════════════
    %% 2. Inter-module «import»
    %% ═══════════════════════════════════════════════
    AUTH -.->|"«import»"| USER
    GAME -.->|"«import»"| AI
    GAME -.->|"«import»"| USER
    GAME -.->|"«import»"| LB
    GAME -.->|"«import»"| WATCH
    GAME -.->|"«import»"| TOUR
    TOUR -.->|"«import»"| USER
    TOUR -.->|"«import»"| GAME

    %% ═══════════════════════════════════════════════
    %% 3. Business → Infrastructure «access»
    %% ═══════════════════════════════════════════════
    AUTH -.->|"«access»"| DRIZZLE
    USER -.->|"«access»"| DRIZZLE
    GAME -.->|"«access»"| REDIS_M
    GAME -.->|"«access»"| DRIZZLE
    TOUR -.->|"«access»"| REDIS_M
    TOUR -.->|"«access»"| DRIZZLE
    CHAT -.->|"«access»"| REDIS_M
    CHAT -.->|"«access»"| DRIZZLE
    WATCH -.->|"«access»"| REDIS_M
    LB -.->|"«access»"| REDIS_M
    LB -.->|"«access»"| DRIZZLE

    %% ═══════════════════════════════════════════════
    %% 4. Infra → Data Stores («commands» / «SQL»)
    %% ═══════════════════════════════════════════════
    REDIS_M -.->|"«commands»"| REDIS_D
    DRIZZLE -.->|"«SQL»"| PG

    %% ═══════════════════════════════════════════════
    %% Apply Styles
    %% ═══════════════════════════════════════════════
    class NEXT client
    class AUTH,USER,GAME,AI,TOUR,CHAT,WATCH,LB business
    class REDIS_M,DRIZZLE infra
    class PG,REDIS_D data
```

---

> **Ghi chú:**
> - **`«stereotype»`** trên mũi tên thể hiện **kiểu quan hệ** trong UML Package Diagram.
> - **`«REST»`** = HTTP REST API (Controller); **`«WebSocket» /ns`** = Real-time Gateway với namespace.
> - **`«import»`** = Module A import Module B (A phụ thuộc vào B). VD: `GameModule` import `AiModule`.
> - **`«access»`** = Module truy cập vào tầng Infrastructure (Database / Cache).
> - **`«commands»`** / **`«SQL»`** = Giao tiếp ở mức protocol tới Data Store.
> - `📡 REST` / `🔌 WS` / `🌐 @Global()` trong label là icon chỉ **kênh giao tiếp** của từng module.
> - `Matchmaking` + `Gameplay` được gộp trong `GameModule` để giản lược; trong code chúng nằm trong `game.service.ts` + `game.gateway.ts`.
> - `AiModule` được import **duy nhất** bởi `GameModule` (không có trong `app.module.ts`), nên có mũi tên `«import»` từ `GameModule` → `AiModule`.
> - Gateway namespaces: `/chess` (GameGateway), `/watch` (WatchGateway), `/chat` (ChatGateway), `/tournament` (TournamentGateway), `/leaderboard` (LeaderboardGateway).
> - `RedisModule` được đánh dấu `@Global()` → tự động khả dụng trong mọi module, nhưng sơ đồ vẫn thể hiện `«access»` để làm rõ module nào **thực sự sử dụng** Redis.

---

## 2. Class Diagram Tổng Quan (Backend Core)

```mermaid
classDiagram
    direction TB

    %% ── Styles ──
    classDef gateway fill:#1b5e20,stroke:#66bb6a,color:#e8f5e9
    classDef service fill:#0d47a1,stroke:#42a5f5,color:#e3f2fd
    classDef controller fill:#e65100,stroke:#ff9800,color:#fff3e0
    classDef dto fill:#4a148c,stroke:#ce93d8,color:#f3e5f5
    classDef schema fill:#3e2723,stroke:#ff8a65,color:#ffe0d0

    %% ═══════════════════════════════════════════════════════
    %% Game Module
    %% ═══════════════════════════════════════════════════════
    class GameGateway {
        -connectedClients: Map
        -reMatchIntervals: Map
        +handleFindGame(data) void
        +handleMakeMove(data) void
        +handleResign(data) void
        +handleOfferDraw(data) void
        +handleAcceptDraw(data) void
        +handleStartBotGame(data) void
        +handleReconnectCheck(data) void
        -createGameFromMatch(p1,p2,tc) void
        -triggerBotMove(gameId, client) void
        -handleGameOver(gameId, game) void
        -triggerLeaderboardUpdate(game) object
        -startReMatchIntervals() void
        -emitSearchProgress(tc) void
    }

    class GameService {
        -matchmakeSha: string
        -leaveQueueSha: string
        +joinQueue(entry, maxDiff) MatchmakingEntry
        +leaveQueue(userId, tc) void
        +reMatchWaitingPlayers(tc) array
        +createGameState(id,w,b,tc) GameState
        +processMove(gameId,userId,move) result
        +resign(gameId, userId) GameState
        +offerDraw(gameId, userId) boolean
        +acceptDraw(gameId) GameState
        +saveGameToDb(gameId) void
        +getGame(gameId) GameState
        +saveGame(game, ttl) void
        +getGameHistory(userId) array
        +getExpandedEloRange(joinedAt)$ number
    }

    class GameController {
        +getHistory(req) array
        +getPublicHistory(userId) array
        +getGameById(id) game
        +getGameMoveHistory(id) moves
    }

    class GameState {
        +id: string
        +fen: string
        +pgn: string
        +whiteId: string
        +blackId: string
        +status: string
        +timeControl: string
        +whiteTimeMs: number
        +blackTimeMs: number
        +turn: 'w'|'b'
        +moveHistory: string[]
        +verboseMoves: VerboseMove[]
        +isBot: boolean
        +botDifficulty: string
        +botColor: 'w'|'b'
    }

    class MatchmakingEntry {
        +userId: string
        +username: string
        +socketId: string
        +timeControl: string
        +rating: number
        +joinedAt: number
    }

    %% ═══════════════════════════════════════════════════════
    %% Tournament Module
    %% ═══════════════════════════════════════════════════════
    class TournamentGateway {
        -userSockets: Map
        -clients: Map
        -nextRoundTimers: Map
        +handleJoinRoom(data) void
        +handleLeaveRoom(data) void
        +broadcastTournamentUpdate(tId, data) void
        +notifyPlayer(userId, event, data) void
        +setNextRoundTimer(tId, ts) void
    }

    class TournamentService {
        +listTournaments() array
        +getTournament(id) tournament
        +createTournament(creatorId, dto) tournament
        +joinTournament(tId, userId) void
        +startTournament(tId, userId) void
        +finishTournament(tId, userId) void
        +getTournamentRounds(tId) array
        +recordTournamentResult(tId,gId,result) round
        +getTournamentGameInfo(gameId) info
    }

    class TournamentSwissService {
        +generatePairings(tournamentId, round) SwissPairing[]
        -buildPlayers(tId) SwissPlayer[]
        -pairRound(players, pastMatches) SwissPairing[]
        -computeBuchholz(player, allPlayers, pastMatches) number
        -computeSonnebornBerger(player, pastMatches) number
        +getStandings(tId) SwissPlayer[]
    }

    class TournamentController {
        +listTournaments() array
        +getTournament(id) tournament
        +createTournament(dto, req) tournament
        +joinTournament(id, req) void
        +startTournament(id, req) void
        +deleteTournament(id, req) void
        +getStandings(id) array
    }

    %% ═══════════════════════════════════════════════════════
    %% Chat Module
    %% ═══════════════════════════════════════════════════════
    class ChatGateway {
        -clients: Map
        -userSockets: Map
        +handleIdentify(data) void
        +handleJoinDm(data) void
        +handleSendDm(data) void
        +handleSendDirectMessage(data) void
        +handleTyping(data) void
        -broadcastUserStatus(uid,un,online) void
    }

    class ChatService {
        +getOrCreatePrivateRoom(u1,u2) string
        +saveMessage(roomId,senderId,username,content) ChatMessage
        +getMessages(roomId, limit) ChatMessage[]
        +getUserRooms(userId) string[]
    }

    %% ═══════════════════════════════════════════════════════
    %% Auth + User Module
    %% ═══════════════════════════════════════════════════════
    class AuthService {
        +register(dto) AuthResult
        +login(dto) AuthResult
        +refreshToken(token) Tokens
        -generateTokens(id,un,email) Tokens
        -hashPassword(pw) string
        -comparePassword(pw, hash) boolean
    }

    class AuthController {
        +register(dto) AuthResult
        +login(dto) AuthResult
        +refreshToken(req) Tokens
    }

    class UserService {
        +getProfile(userId) UserProfile
        +updateProfile(userId, dto) UserProfile
        +getUserById(id) User
        +searchUsers(query) User[]
        +sendFriendRequest(from,to) void
        +acceptFriendRequest(from,to) void
        +getFriends(userId) Friend[]
    }

    class UserController {
        +getMe(req) UserProfile
        +updateMe(req, dto) UserProfile
        +getUserById(id) User
        +searchUsers(query) User[]
        +getFriends(req) Friend[]
        +sendFriendRequest(req, toId) void
        +acceptFriendRequest(req, fromId) void
    }

    class JwtAuthGuard {
        +canActivate(context) boolean
        -validateToken(token) payload
    }

    %% ═══════════════════════════════════════════════════════
    %% Leaderboard Module
    %% ═══════════════════════════════════════════════════════
    class LeaderboardGateway {
        -subscribedClients: Map
        +handleSubscribe(data) void
        +handleUnsubscribe() void
        +broadcastUpdate(category, data) void
    }

    class LeaderboardService {
        +updateElo(dto) void
        +getTopPlayers(category, limit, offset) LeaderboardUpdate
        +getPlayerRank(userId, category) rank
        +seedDemoData() void
    }

    %% ═══════════════════════════════════════════════════════
    %% Watch Module
    %% ═══════════════════════════════════════════════════════
    class WatchGateway {
        -spectators: Map
        +handleWatchGame(data) void
        +handleLeaveWatch(data) void
        +broadcastGameUpdate(gameId, data) void
        +broadcastGameOver(gameId, data) void
        -handleLeaveInternal(client, gameId) void
    }

    class WatchService {
        +getLiveGames() array
        +getGameInfo(gameId) info
    }

    %% ═══════════════════════════════════════════════════════
    %% AI Module
    %% ═══════════════════════════════════════════════════════
    class AiService {
        +getBestMove(fen, difficulty, color) Move
        +evaluatePosition(fen) number
        +isReady() boolean
        -initEngine() void
    }

    %% ═══════════════════════════════════════════════════════
    %% Infrastructure
    %% ═══════════════════════════════════════════════════════
    class DrizzleModule {
        +provide: DRIZZLE
        +useFactory(config) NodePgDatabase
    }

    class RedisModule {
        +provide: REDIS_CLIENT
        +useFactory(config) Redis
    }

    %% ═══════════════════════════════════════════════════════
    %% Relationships
    %% ═══════════════════════════════════════════════════════
    GameGateway ..> GameService : uses
    GameGateway ..> AiService : bot moves
    GameGateway ..> LeaderboardGateway : elo update
    GameGateway ..> WatchGateway : broadcast
    GameGateway ..> TournamentService : record result
    GameGateway ..> TournamentGateway : broadcast update
    GameController ..> GameService : uses
    GameService ..> DrizzleModule : persist
    GameService ..> RedisModule : state/queue
    GameService ..> GameState : creates
    GameService ..> MatchmakingEntry : queue entries

    TournamentGateway ..> TournamentService : uses
    TournamentController ..> TournamentService : uses
    TournamentService ..> TournamentSwissService : pairing
    TournamentService ..> GameService : create game
    TournamentService ..> DrizzleModule : persist
    TournamentService ..> RedisModule : rounds cache

    ChatGateway ..> ChatService : uses
    ChatGateway ..> RedisModule : online users
    ChatService ..> DrizzleModule : persist
    ChatService ..> RedisModule : cache messages

    AuthController ..> AuthService : uses
    AuthService ..> DrizzleModule : users table
    UserController ..> UserService : uses
    UserService ..> DrizzleModule : users/profile
    JwtAuthGuard ..> UserService : validate

    LeaderboardGateway ..> LeaderboardService : uses
    LeaderboardService ..> RedisModule : sorted sets
    LeaderboardService ..> DrizzleModule : persist elo

    WatchGateway ..> WatchService : uses
    WatchGateway ..> GameService : game state

    %% Apply styles
    class GameGateway gateway
    class TournamentGateway gateway
    class ChatGateway gateway
    class LeaderboardGateway gateway
    class WatchGateway gateway
    
    class GameService service
    class TournamentService service
    class TournamentSwissService service
    class ChatService service
    class AuthService service
    class UserService service
    class LeaderboardService service
    class WatchService service
    class AiService service

    class GameController controller
    class TournamentController controller
    class AuthController controller
    class UserController controller

    class GameState dto
    class MatchmakingEntry dto

    class DrizzleModule schema
    class RedisModule schema
```

---

## 3. Class Diagram Chi Tiết — Game Module (Matchmaking + Gameplay)

```mermaid
classDiagram
    direction TB

    class GameGateway {
        <<WebSocketGateway /chess>>
        -connectedClients: Map~socketId, ClientInfo~
        -reMatchIntervals: Map~timeControl, Interval~
        +afterInit(server) void
        +handleConnection(client) void
        +handleDisconnect(client) void
        +handleFindGame(data) void
        +handleCancelSearch(data) void
        +handleMakeMove(data) void
        +handleResign(data) void
        +handleOfferDraw(data) void
        +handleAcceptDraw(data) void
        +handleDeclineDraw(data) void
        +handleStartBotGame(data) void
        +handleJoinGame(data) void
        +handleReconnectCheck(data) void
        +handleAnalyzePosition(data) void
        +handleSendMessage(data) void
        -createGameFromMatch(p1, p2, tc) void
        -triggerBotMove(gameId, client) void
        -handleGameOver(gameId, game, client) void
        -triggerLeaderboardUpdate(game) EloResult
        -startReMatchIntervals() void
        -emitSearchProgress(tc) void
        -getBotDelay(difficulty) number
        -recordTournamentGameResult(gId, game) void
    }

    class GameService {
        <<Injectable>>
        -matchmakeSha: string
        -leaveQueueSha: string
        +onModuleInit() void
        +joinQueue(entry, maxEloDiff) MatchmakingEntry|null
        +leaveQueue(userId, timeControl) void
        +reMatchWaitingPlayers(tc) Match[]
        +getQueueSize(tc) number
        +getQueueEntries(tc) MatchmakingEntry[]
        +createGameState(id,w,b,tc) GameState
        +processMove(gId,uid,move) MoveResult
        +resign(gId, uid) GameState|null
        +offerDraw(gId, uid) boolean
        +acceptDraw(gId) GameState|null
        +saveGameToDb(gId) void
        +getGame(gId) GameState|null
        +saveGame(game, ttl) void
        +deleteGame(gId) void
        +getUserCurrentGame(uid) string|null
        +setUserCurrentGame(uid, gId) void
        +clearUserCurrentGame(uid) void
        +getGameHistory(uid) Game[]
        +getPublicGameHistory(uid) Game[]
        +getGameById(id) Game
        +getGameMoveHistory(id) VerboseMove[]
        +generateGameId() string
        +getExpandedEloRange(joinedAt)$ number
        -gameKey(gId) string
        -matchmakingKey(tc) string
        -userGameKey(uid) string
    }

    class GameController {
        <<Controller /game>>
        +getHistory(req) Game[]
        +getPublicHistory(userId) Game[]
        +getGameById(id) Game
        +getGameMoveHistory(id) MoveHistory
    }

    class GameState {
        <<interface>>
        +id: string
        +fen: string
        +pgn: string
        +whiteId: string
        +blackId: string
        +whiteUsername: string
        +blackUsername: string
        +status: GameStatus
        +timeControl: string
        +whiteTimeMs: number
        +blackTimeMs: number
        +turn: 'w'|'b'
        +lastMoveAt: number
        +winner: 'white'|'black'|'draw'
        +moveHistory: string[]
        +verboseMoves: VerboseMove[]
        +createdAt: number
        +isBot: boolean
        +botDifficulty: Difficulty
        +botColor: 'w'|'b'
    }

    class MatchmakingEntry {
        <<interface>>
        +userId: string
        +username: string
        +socketId: string
        +timeControl: string
        +rating: number
        +joinedAt: number
    }

    class VerboseMove {
        <<interface>>
        +color: 'w'|'b'
        +from: string
        +to: string
        +piece: string
        +captured: string
        +promotion: string
        +flags: string
        +san: string
        +lan: string
        +before: string
        +after: string
    }

    class AiService {
        <<Injectable>>
        +getBestMove(fen, diff, color) Move
        +evaluatePosition(fen) number
        +isReady() boolean
    }

    class LeaderboardGateway {
        <<WebSocketGateway /leaderboard>>
    }

    class WatchGateway {
        <<WebSocketGateway /watch>>
        +broadcastGameUpdate(gId, data) void
        +broadcastGameOver(gId, data) void
    }

    class TournamentService {
        <<Injectable>>
        +getTournamentGameInfo(gId) info
        +recordTournamentResult(tId,gId,r) round
        +getTournament(id) tournament
        +getTournamentRounds(tId) rounds
        +finishTournament(tId, uid) void
    }

    class TournamentGateway {
        <<WebSocketGateway /tournament>>
        +broadcastTournamentUpdate(tId,data) void
        +setNextRoundTimer(tId, ts) void
    }

    GameGateway --> GameService : gameService
    GameGateway --> AiService : aiService
    GameGateway --> LeaderboardGateway : leaderboardGateway
    GameGateway --> WatchGateway : watchGateway
    GameGateway --> TournamentService : tournamentService
    GameGateway --> TournamentGateway : tournamentGateway
    GameController --> GameService : gameService
    GameService ..> GameState : creates
    GameService ..> MatchmakingEntry : queue entries
    GameService ..> VerboseMove : move history
```

---

## 4. Class Diagram Chi Tiết — Tournament Module

```mermaid
classDiagram
    direction TB

    class TournamentGateway {
        <<WebSocketGateway /tournament>>
        -userSockets: Map~userId, Set~socketId~~
        -clients: Map~socketId, ClientInfo~
        -nextRoundTimers: Map~tournamentId, timestamp~
        +afterInit() void
        +handleConnection(client) void
        +handleDisconnect(client) void
        +handleIdentify(data) void
        +handleJoinRoom(data) void
        +handleLeaveRoom(data) void
        +broadcastTournamentUpdate(tId, data) void
        +notifyPlayer(userId, event, data) void
        +setNextRoundTimer(tId, ts) void
        +clearNextRoundTimer(tId) void
    }

    class TournamentService {
        <<Injectable>>
        +listTournaments() Tournament[]
        +getTournament(id) TournamentDetail
        +createTournament(creatorId, dto) Tournament
        +joinTournament(tId, userId) void
        +startTournament(tId, userId) void
        +finishTournament(tId, userId) void
        +deleteTournament(tId, userId) void
        +getTournamentRounds(tId) TournamentRound[]
        +getCurrentRound(tId) number
        +recordTournamentResult(tId,gId,result) TournamentRound
        +getTournamentGameInfo(gameId) TournamentGameInfo
        -roundsKey(tId) string
        -roundKey(tId, round) string
        -currentRoundKey(tId) string
    }

    class TournamentSwissService {
        <<Injectable>>
        +generatePairings(tournamentId, round) SwissPairing[]
        +getStandings(tId) SwissPlayer[]
        -buildPlayers(tId) SwissPlayer[]
        -pairRound(players, pastMatches) SwissPairing[]
        -computeBuchholz(player, all, pastMatches) number
        -computeSonnebornBerger(player, pastMatches) number
        -assignColors(pairings, players) void
        -colorBalance(players) boolean
    }

    class TournamentController {
        <<Controller /tournament>>
        +listTournaments() Tournament[]
        +getTournament(id) TournamentDetail
        +createTournament(dto, req) Tournament
        +joinTournament(id, req) void
        +startTournament(id, req) void
        +deleteTournament(id, req) void
        +getStandings(id) Standing[]
    }

    class SwissPlayer {
        <<interface>>
        +userId: string
        +username: string
        +tournamentPoints: number
        +rating: number
        +whitesPlayed: number
        +blacksPlayed: number
        +colorHistory: Array~'w'|'b'|'bye'~
        +hadBye: boolean
    }

    class SwissPairing {
        <<interface>>
        +gameId: string
        +tournamentId: string
        +round: number
        +whiteId: string
        +blackId: string
        +whiteUsername: string
        +blackUsername: string
    }

    class TournamentRound {
        <<interface>>
        +tournamentId: string
        +round: number
        +games: TournamentGame[]
        +status: 'active'|'finished'
    }

    class TournamentGame {
        <<interface>>
        +gameId: string
        +tournamentId: string
        +round: number
        +whiteId: string
        +blackId: string
        +whiteUsername: string
        +blackUsername: string
        +status: 'pending'|'active'|'finished'
        +result: 'white'|'black'|'draw'|null
    }

    class GameService {
        <<from GameModule>>
        +createGameState(...)  GameState
        +saveGame(...)  void
        +setUserCurrentGame(...)  void
    }

    TournamentGateway --> TournamentService : tournamentService
    TournamentController --> TournamentService : tournamentService
    TournamentService --> TournamentSwissService : swissService
    TournamentService --> GameService : gameService
    TournamentSwissService ..> SwissPlayer : builds
    TournamentSwissService ..> SwissPairing : returns
    TournamentService ..> TournamentRound : manages
    TournamentService ..> TournamentGame : manages
```

---

## 5. Class Diagram Chi Tiết — Chat Module (Direct Message 1-1)

```mermaid
classDiagram
    direction TB

    class ChatGateway {
        <<WebSocketGateway /chat>>
        -clients: Map~socketId, UserInfo~
        -userSockets: Map~userId, Set~socketId~~
        +afterInit(server) void
        +handleConnection(client) void
        +handleDisconnect(client) void
        +handleIdentify(data) void
        +handleJoinDm(data) void
        +handleSendDm(data) void
        +handleSendDirectMessage(data) void
        +handleTyping(data) void
        +handleGetHistory(data) void
        -broadcastUserStatus(uid, un, online) void
    }

    class ChatService {
        <<Injectable>>
        +getOrCreatePrivateRoom(u1, u2) string
        +saveMessage(roomId, senderId, username, content) ChatMessage
        +getMessages(roomId, limit) ChatMessage[]
        +getUserRooms(userId) string[]
        -roomCacheKey(roomId) string
    }

    class ChatMessage {
        <<interface>>
        +id: string
        +roomId: string
        +senderId: string
        +senderUsername: string
        +content: string
        +createdAt: number
    }

    class JoinRoomDto {
        <<interface>>
        +userId: string
        +username: string
        +friendId: string
        +friendUsername: string
    }

    class SendDmDto {
        <<interface>>
        +roomId: string
        +senderId: string
        +senderUsername: string
        +content: string
    }

    class SendDirectMessageDto {
        <<interface>>
        +toUserId: string
        +message: string
    }

    class DirectMessagePayload {
        <<interface>>
        +fromUserId: string
        +fromUsername: string
        +toUserId: string
        +message: string
        +timestamp: number
        +roomId: string
    }

    ChatGateway --> ChatService : chatService
    ChatService ..> ChatMessage : returns
    ChatGateway ..> JoinRoomDto : handles
    ChatGateway ..> SendDmDto : handles
    ChatGateway ..> SendDirectMessageDto : handles
    ChatGateway ..> DirectMessagePayload : emits
```

---

## 6. Class Diagram — Auth & User Module

```mermaid
classDiagram
    direction TB

    class AuthController {
        <<Controller /auth>>
        +register(dto) AuthResult
        +login(dto) AuthResult
        +refreshToken(req) Tokens
    }

    class AuthService {
        <<Injectable>>
        +register(dto) AuthResult
        +login(dto) AuthResult
        +refreshToken(token) Tokens
        -generateTokens(id, username, email) Tokens
    }

    class AuthResult {
        <<interface>>
        +user: UserProfile
        +accessToken: string
        +refreshToken: string
    }

    class RegisterDto {
        <<interface>>
        +username: string
        +email: string
        +password: string
    }

    class LoginDto {
        <<interface>>
        +identifier: string
        +password: string
    }

    class UserController {
        <<Controller /user>>
        +getMe(req) UserProfile
        +updateMe(req, dto) UserProfile
        +getUserById(id) User
        +searchUsers(query) User[]
    }

    class UserService {
        <<Injectable>>
        +getProfile(userId) UserProfile
        +updateProfile(userId, dto) UserProfile
        +getUserById(id) User
        +searchUsers(query) User[]
    }

    class JwtAuthGuard {
        <<Guard>>
        +canActivate(context) boolean
        -extractToken(req) string
        -validateToken(token) payload
    }

    class UserProfile {
        <<interface>>
        +id: string
        +username: string
        +email: string
        +blitzRating: number
        +bulletRating: number
        +rapidRating: number
        +role: string
        +createdAt: Date
        +metadata: jsonb
    }

    AuthController --> AuthService : authService
    AuthController ..> RegisterDto : input
    AuthController ..> LoginDto : input
    AuthController ..> AuthResult : output
    AuthService ..> AuthResult : returns
    UserController --> UserService : userService
    UserController ..> UserProfile : output
    AuthService ..> UserProfile : creates
    JwtAuthGuard ..> UserService : validate
```

---

## 7. Class Diagram — Frontend (Zustand Stores + Hooks)

```mermaid
classDiagram
    direction TB

    class useChessSocket {
        <<hook>>
        +socket: Socket
        +gameState: GameState
        +status: GameStatus
        +searchProgress: SearchProgress
        +findGame(tc, rating) void
        +makeMove(from, to, promo) void
        +resign() void
        +offerDraw() void
        +acceptDraw() void
        +startBotGame(diff, side) void
        +cancelSearch() void
    }

    class useFriendChat {
        <<hook>>
        +socket: Socket
        +identify(userId, username) void
        +joinDm(friendId, friendUsername) void
        +sendMessage(roomId, content) void
        +sendDirectMessage(toUserId, message) void
        +sendTyping(roomId, isTyping) void
    }

    class useWatchSocket {
        <<hook>>
        +socket: Socket
        +liveGames: GameInfo[]
        +watchGame(gameId) void
        +leaveWatch() void
    }

    class useLeaderboard {
        <<hook>>
        +socket: Socket
        +leaderboard: LeaderboardUpdate
        +subscribe(category) void
    }

    class useStockfish {
        <<hook>>
        +engine: StockfishEngine
        +bestMove: Move
        +evaluation: number
        +getBestMove(fen, difficulty) void
        +evaluatePosition(fen) void
        +stop() void
    }

    class useChatStore {
        <<zustand store>>
        +isOpen: boolean
        +rooms: Record~roomId, ChatRoom~
        +activeRoomId: string|null
        +onlineUsers: Set~userId~
        +openChat(friendId, friendUsername) void
        +closeChat() void
        +setActiveRoom(roomId) void
        +addRoom(room) void
        +addMessage(roomId, msg) void
        +setHistory(roomId, msgs) void
        +markRead(roomId) void
        +upsertRoomForDirect(params) void
        +registerSendFns(sendMsg, sendTyping, sendDirect) void
    }

    class useFriendStore {
        <<zustand store>>
        +friends: Friend[]
        +requests: FriendRequest[]
        +fetchFriends() void
        +sendRequest(toUserId) void
        +acceptRequest(fromUserId) void
        +declineRequest(fromUserId) void
    }

    class useProfileStore {
        <<zustand store>>
        +profile: UserProfile|null
        +fetchProfile() void
        +updateProfile(dto) void
    }

    class useWatchStore {
        <<zustand store>>
        +liveGames: GameInfo[]
        +watchingGame: GameState|null
        +setLiveGames(games) void
        +setWatchingGame(game) void
    }

    useChessSocket --> useChatStore : game over → notify
    useFriendChat --> useChatStore : registerSendFns
    useFriendChat --> useChatStore : upsert messages
    useWatchSocket --> useWatchStore : setWatchingGame
    useLeaderboard --> useProfileStore : elo update
```

---

## 8. Class Diagram — Database Schema (Drizzle ORM)

```mermaid
classDiagram
    direction TB

    class users {
        <<PostgreSQL Table>>
        +id: uuid PK
        +username: varchar UNIQUE
        +email: varchar UNIQUE
        +passwordHash: text
        +blitzRating: integer
        +bulletRating: integer
        +rapidRating: integer
        +role: varchar
        +createdAt: timestamp
    }

    class games {
        <<PostgreSQL Table>>
        +id: uuid PK
        +whiteId: uuid FK → users
        +blackId: uuid FK → users (nullable)
        +whiteUsername: varchar
        +blackUsername: varchar
        +winnerId: uuid FK → users (nullable)
        +status: varchar
        +timeControl: varchar
        +pgn: text
        +finalFen: text
        +moves: jsonb
        +tournamentId: uuid FK → tournaments (nullable)
        +createdAt: timestamp
    }

    class tournaments {
        <<PostgreSQL Table>>
        +id: uuid PK
        +name: varchar
        +format: varchar
        +status: varchar
        +timeControl: varchar
        +startTime: timestamp
        +endTime: timestamp
        +creatorId: uuid FK → users
    }

    class tournamentParticipants {
        <<PostgreSQL Table>>
        +tournamentId: uuid PK FK → tournaments
        +userId: uuid PK FK → users
        +points: real
        +tieBreak: real
        +rank: integer
    }

    class chatRooms {
        <<PostgreSQL Table>>
        +id: uuid PK
        +type: varchar
        +referenceId: uuid (nullable)
        +createdAt: timestamp
    }

    class chatRoomMembers {
        <<PostgreSQL Table>>
        +roomId: uuid FK → chatRooms
        +userId: uuid FK → users
    }

    class messages {
        <<PostgreSQL Table>>
        +id: uuid PK
        +roomId: uuid FK → chatRooms
        +senderId: uuid FK → users
        +senderUsername: varchar
        +content: text
        +createdAt: timestamp
    }

    class friends {
        <<PostgreSQL Table>>
        +user1Id: uuid PK FK → users
        +user2Id: uuid PK FK → users
        +status: varchar
    }

    class profileInfo {
        <<PostgreSQL Table>>
        +id: serial PK
        +userId: uuid FK → users UNIQUE
        +metadata: jsonb
    }

    users "1" --> "many" games : whiteId / blackId
    users "1" --> "many" tournaments : creatorId
    tournaments "1" --> "many" tournamentParticipants : tournamentId
    users "1" --> "many" tournamentParticipants : userId
    tournaments "1" --> "many" games : tournamentId
    chatRooms "1" --> "many" messages : roomId
    chatRooms "1" --> "many" chatRoomMembers : roomId
    users "1" --> "many" chatRoomMembers : userId
    users "1" --> "many" messages : senderId
    users "1" --> "1" profileInfo : userId
    users "1" --> "many" friends : user1Id
    users "1" --> "many" friends : user2Id
```

---

## Tóm Tắt Kiểm Tra & Class Diagram

| # | Sơ đồ | Nội dung | Trạng thái |
|---|-------|---------|------------|
| 1 | **Subsystem Diagram** | 11 modules backend + Client + Data tier | ✅ Khớp code |
| 2 | **Class Diagram Tổng Quan** | 18 classes: Gateways, Services, Controllers, DTOs | ✅ Khớp code |
| 3 | **Game Module** | GameGateway + GameService + GameController + DTOs | ✅ Khớp code |
| 4 | **Tournament Module** | TournamentGateway + Service + SwissService + Controller | ✅ Khớp code |
| 5 | **Chat Module** | ChatGateway + ChatService + DTOs (Room-based & Direct) | ✅ Khớp code |
| 6 | **Auth & User** | AuthController/Service + UserController/Service + Guard | ✅ Khớp code |
| 7 | **Frontend** | 4 hooks + 4 Zustand stores | ✅ Khớp code |
| 8 | **Database Schema** | 9 tables với relationships | ✅ Khớp Drizzle schema |

> **Ghi chú kiểm tra**:
> - `AiModule` **không** được import trực tiếp trong `app.module.ts` mà được import bởi `GameModule`. Trong sơ đồ subsystem vẫn thể hiện là module độc lập — đúng với kiến trúc thực tế.
> - `RedisModule` được đánh dấu `@Global()` → mọi module đều có thể inject `REDIS_CLIENT` mà không cần import explicit. Sơ đồ vẫn vẽ dependency để rõ ràng.
> - `Matchmaking_Module` và `Gameplay_Module` được tách làm 2 subgraph trong subsystem diagram nhưng thực tế nằm chung `GameModule` — đã ghi chú rõ trong sơ đồ.
> - Tất cả class diagram đều phản ánh đúng các method/field có trong code hiện tại (checked ngày 2026-06-12).
