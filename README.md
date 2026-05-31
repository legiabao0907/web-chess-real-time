# Chess App — Sequence Diagrams & Architecture

Tài liệu này chứa các sơ đồ tuần tự (Sequence Diagram) và ERD mô tả toàn bộ luồng nghiệp vụ cốt lõi của hệ thống: Game, Tournament, Chat, ELO, và Authentication. Bạn có thể dùng [Mermaid Live Editor](https://mermaid.live/) hoặc plugin Markdown Preview trên IDE để xem.

## 1. Luồng Tìm Trận (Matchmaking) - Sử dụng Lua Script Atomic

```mermaid
sequenceDiagram
    autonumber
    participant C1 as Client 1 (User A)
    participant C2 as Client 2 (User B)
    participant GW as GameGateway
    participant Svc as GameService
    participant Redis as Redis (Lua Script)

    Note over C1,Redis: User A bắt đầu tìm trận
    C1->>GW: emit('join_queue', { timeControl })
    GW->>Svc: joinQueue(entry)
    Svc->>Redis: evalsha(JOIN_QUEUE_LUA)
    Note over Redis: Lua chạy atomic: Quét hàng đợi → Không có ai → Thêm User A vào
    Redis-->>Svc: Return "QUEUED"
    Svc-->>GW: return null
    GW-->>C1: emit('queue_joined')
    
    Note over C2,Redis: User B bắt đầu tìm trận (cùng timeControl)
    C2->>GW: emit('join_queue', { timeControl })
    GW->>Svc: joinQueue(entry)
    Svc->>Redis: evalsha(JOIN_QUEUE_LUA)
    Note over Redis: Lua chạy atomic: Quét hàng đợi → Lấy User A ra khỏi hàng đợi
    Redis-->>Svc: Return "MATCHED: {User A data}"
    Svc-->>GW: return opponentEntry (User A)
    
    Note over GW,Redis: Tạo phòng chơi
    GW->>Svc: createGameState(User A, User B, timeControl)
    Svc->>Redis: set(gameKey, gameState)
    GW->>GW: Socket Join Room (gameId) cho cả 2
    GW->>C1: emit('game_started', gameState)
    GW->>C2: emit('game_started', gameState)
```

---

## 2. Luồng Đi Cờ (Make Move)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Player)
    participant GW as GameGateway
    participant Svc as GameService
    participant Redis as Redis (State)
    participant W as WatchGateway
    
    C->>GW: emit('make_move', {from, to, promotion})
    GW->>Svc: processMove(gameId, userId, move)
    Svc->>Redis: getGame(gameId)
    Redis-->>Svc: return gameState
    
    alt Không phải lượt / Game không active
        Svc-->>GW: return {success: false, error}
        GW-->>C: emit('error', errorMessage)
    else Hợp lệ
        Svc->>Svc: Tính toán và trừ thời gian (Clock Timer)
        Svc->>Svc: Validate nước đi bằng chess.js
        
        alt Nước đi phạm luật (Illegal)
            Svc-->>GW: return {success: false, error: "Illegal move"}
            GW-->>C: emit('error', "Illegal move")
        else Nước đi hợp lệ (Legal)
            Svc->>Redis: saveGame(updatedGameState)
            Svc-->>GW: return {success: true, game: updatedGameState}
            GW->>GW: Server emit tới Room: 'move_made'
            GW->>W: broadcastGameUpdate() (Cập nhật cho khán giả)
            
            alt Hết cờ (Checkmate/Draw/Hết giờ)
                GW->>Svc: saveGameToDb(gameId) (Lưu lịch sử)
                GW->>GW: Server emit tới Room: 'game_over'
                GW->>W: broadcastGameOver()
            end
        end
    end
```

---

## 3. Luồng Lưu Trữ Lịch Sử Trận Đấu (Persistence)

```mermaid
sequenceDiagram
    autonumber
    participant GW as GameGateway
    participant Svc as GameService
    participant Redis as Redis (State)
    participant DB as Postgres (Drizzle)
    
    Note over GW,DB: Trận đấu kết thúc (Checkmate/Draw/Resign/Hết giờ)
    GW->>Svc: saveGameToDb(gameId)
    Svc->>Redis: getGame(gameId)
    Redis-->>Svc: return finalGameState
    
    Svc->>Svc: Format data (Nullify BOT IDs, tính winnerId...)
    Svc->>DB: INSERT INTO games (whiteId, blackId, pgn, status, ...)
    
    alt Insert thành công
        DB-->>Svc: Success
        Svc->>Svc: logger.log("Game persisted")
    else Insert thất bại / Conflict
        DB-->>Svc: Error / Conflict
        Svc->>Svc: logger.error(...)
    end
    
    Note over GW,Redis: Dọn dẹp trạng thái
    GW->>Svc: clearUserCurrentGame(whiteId)
    GW->>Svc: clearUserCurrentGame(blackId)
    GW->>Redis: Xoá game khỏi Redis (Sau 1 khoảng TTL)
```

---

## 4. Luồng Đăng Nhập (Login)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant AuthCtrl as AuthController
    participant AuthSvc as AuthService
    participant DB as Postgres (Drizzle)

    C->>AuthCtrl: POST /auth/login {email, password}
    AuthCtrl->>AuthSvc: validateUser(email, password)
    AuthSvc->>DB: SELECT * FROM users WHERE email = ?
    DB-->>AuthSvc: return user record
    
    alt User không tồn tại hoặc sai mật khẩu
        AuthSvc-->>AuthCtrl: throw UnauthorizedException
        AuthCtrl-->>C: return 401 Unauthorized
    else Hợp lệ
        AuthSvc->>AuthSvc: verify password (bcrypt)
        AuthSvc->>AuthSvc: generate JWT Token
        AuthSvc-->>AuthCtrl: return { access_token, user }
        AuthCtrl-->>C: return 200 OK + Token
    end
```

---

## 5. Luồng Đăng Kí (Register)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant AuthCtrl as AuthController
    participant AuthSvc as AuthService
    participant DB as Postgres (Drizzle)

    C->>AuthCtrl: POST /auth/register {email, username, password}
    AuthCtrl->>AuthSvc: register(data)
    AuthSvc->>DB: Kiểm tra email/username đã tồn tại chưa
    DB-->>AuthSvc: return result
    
    alt Đã tồn tại
        AuthSvc-->>AuthCtrl: throw ConflictException
        AuthCtrl-->>C: return 409 Conflict
    else Hợp lệ
        AuthSvc->>AuthSvc: hash password (bcrypt)
        AuthSvc->>DB: INSERT INTO users
        DB-->>AuthSvc: return new user
        AuthSvc-->>AuthCtrl: return success
        AuthCtrl-->>C: return 201 Created
    end
```

---

## 6. Luồng Xem Trận Đấu (Spectator / Watch)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Spectator)
    participant W as WatchGateway
    participant Redis as Redis
    
    C->>W: emit('watch_game', { gameId })
    W->>Redis: Kiểm tra gameId có đang active không
    Redis-->>W: return gameState
    
    alt Game không tồn tại / đã kết thúc
        W-->>C: emit('error', 'Game not found')
    else Game đang active
        W->>W: Socket Join Room (gameId)
        W-->>C: emit('game_state', gameState)
    end
    
    Note over C,W: Khi có người chơi đánh cờ, GameGateway sẽ gọi broadcastGameUpdate()
```

---

## 7. Luồng Chat Trong Trận Đấu

```mermaid
sequenceDiagram
    autonumber
    participant C1 as Client 1
    participant C2 as Client 2 (Cùng Room)
    participant ChatGW as ChatGateway
    participant ChatSvc as ChatService
    participant DB as Postgres (Drizzle)
    
    C1->>ChatGW: emit('send_message', { roomId, content })
    ChatGW->>ChatSvc: saveMessage(roomId, senderId, content)
    ChatSvc->>DB: INSERT INTO messages
    DB-->>ChatSvc: Success
    ChatSvc-->>ChatGW: return savedMessage
    
    ChatGW->>ChatGW: broadcast to Room(roomId)
    ChatGW-->>C1: emit('new_message', savedMessage)
    ChatGW-->>C2: emit('new_message', savedMessage)
```

---

## 8. Sơ đồ Thực Thể Kết Hợp (ERD)

```mermaid
erDiagram
    USERS ||--o{ GAMES : "plays (white)"
    USERS ||--o{ GAMES : "plays (black)"
    USERS ||--o{ GAMES : "wins"
    USERS ||--o{ TOURNAMENT_PARTICIPANTS : "participates"
    USERS ||--o{ TOURNAMENTS : "creates"
    USERS ||--o{ FRIENDS : "adds"
    USERS ||--o{ MESSAGES : "sends"
    USERS ||--o{ CHAT_ROOM_MEMBERS : "joins"
    USERS ||--|| PROFILE_INFO : "has"

    TOURNAMENTS ||--o{ TOURNAMENT_PARTICIPANTS : "has participants"
    TOURNAMENTS ||--o{ GAMES : "contains"
    
    CHAT_ROOMS ||--o{ CHAT_ROOM_MEMBERS : "contains"
    CHAT_ROOMS ||--o{ MESSAGES : "has"

    USERS {
        uuid id PK
        varchar username
        varchar email
        text passwordHash
        integer blitzRating
        integer rapidRating
        integer bulletRating
        varchar role
        timestamp createdAt
    }

    PROFILE_INFO {
        serial id PK
        jsonb metadata
        uuid userId FK
    }

    FRIENDS {
        uuid user1Id PK, FK
        uuid user2Id PK, FK
        varchar status
    }

    GAMES {
        uuid id PK
        uuid whiteId FK
        uuid blackId FK
        uuid winnerId FK
        varchar status
        varchar timeControl
        text pgn
        text finalFen
        jsonb moves
        uuid tournamentId FK
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
        uuid tournamentId PK, FK
        uuid userId PK, FK
        real points
        real tieBreak
        integer rank
    }

    CHAT_ROOMS {
        uuid id PK
        varchar type
        uuid referenceId
        timestamp createdAt
    }

    CHAT_ROOM_MEMBERS {
        uuid roomId PK, FK
        uuid userId PK, FK
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

---

## 9. Luồng Tính & Hiển Thị ELO Sau Trận Đấu (NEW)

```mermaid
sequenceDiagram
    autonumber
    participant GW as GameGateway
    participant LB as LeaderboardGateway
    participant LBSvc as LeaderboardService
    participant Redis as Redis (Leaderboard)
    participant DB as Postgres (Drizzle)
    participant FE as Frontend (Play Page)

    Note over GW,FE: Game kết thúc (checkmate/resign/draw)
    GW->>GW: triggerLeaderboardUpdate(game)
    GW->>LBSvc: getPlayerRank(whiteId, category)
    LBSvc->>Redis: ZREVRANK + ZSCORE
    Redis-->>LBSvc: { rank, elo }
    GW->>LB: triggerEloUpdate({winnerId, loserId, ...})

    Note over LB: Tính ELO chuẩn FIDE, K=32
    LB->>LB: winnerChange = round(K * (score - expected))
    LB->>LB: loserChange = round(K * (score - expected))
    LB->>LB: winnerNewElo = max(100, winnerElo + winnerChange)

    LB->>LBSvc: updateElo(winner, category, newElo, delta)
    LBSvc->>Redis: ZADD sorted set + SETEX player data hash
    LBSvc->>DB: UPDATE users SET blitzRating = newElo
    DB-->>LBSvc: ✓

    LB->>LBSvc: updateElo(loser, category, newElo, delta)
    LBSvc->>Redis: ZADD sorted set + SETEX player data hash
    LBSvc->>DB: UPDATE users SET blitzRating = newElo
    DB-->>LBSvc: ✓

    LB->>LB: broadcastLeaderboard(category) → all subscribers
    LB-->>GW: return { winnerChange, loserChange, winnerNewElo, loserNewElo }
    
    GW->>GW: Map winner/loser → white/black changes
    GW->>FE: emit('game_over', { ..., whiteEloChange, blackEloChange, whiteNewElo, blackNewElo })
    
    Note over FE: Hiển thị Game Over Modal
    FE->>FE: Parse eloChange = myColor===white ? whiteChange : blackChange
    FE->>FE: Hiển thị icon (🏆/💔/🤝) + old→new ELO + glow effect
    FE->>FE: Cập nhật localStorage authUser.eloBlitz = newElo
```

---

## 10. Luồng Tự Động Chuyển Vòng Trong Giải Đấu (NEW)

```mermaid
sequenceDiagram
    autonumber
    participant GW as GameGateway
    participant TSvc as TournamentService
    participant TGW as TournamentGateway
    participant Redis as Redis (Tournament Rounds)
    participant FE as Frontend (Tournament Detail)

    Note over GW,FE: Game cuối cùng trong vòng kết thúc
    GW->>TSvc: recordTournamentResult(tournamentId, gameId, result)
    TSvc->>Redis: Cập nhật round data (game.status = 'finished')
    TSvc-->>GW: return updated round

    GW->>TSvc: getTournament(tournamentId) → status = 'ongoing'
    GW->>TSvc: getTournamentRounds(tournamentId)
    GW->>TGW: broadcastTournamentUpdate({ type: 'game_result', rounds })

    Note over GW: Kiểm tra allFinished
    GW->>GW: round.games.every(g => g.status === 'finished') → true

    alt round >= 7 (max rounds)
        GW->>TSvc: finishTournament(tournamentId)
        GW->>TGW: broadcastTournamentUpdate({ type: 'tournament_finished' })
    else round < 7
        GW->>TGW: setNextRoundTimer(tournamentId, now + 30s)
        GW->>TGW: broadcastTournamentUpdate({ type: 'round_countdown', countdownMs: 30000 })
        TGW-->>FE: tournament_update → round_countdown
        FE->>FE: startCountdown(30000) → hiển thị "⏳ Next round in 30s..."
        FE->>FE: setInterval → đếm ngược 30→29→...→0

        Note over GW: Sau 30 giây
        GW->>TGW: clearNextRoundTimer(tournamentId)
        GW->>TSvc: nextRound(tournamentId)
        TSvc->>TSvc: Swiss pairing (generateNextRoundPairs)
        TSvc->>Redis: Lưu round mới, tạo game states
        GW->>TGW: broadcastTournamentUpdate({ type: 'next_round', rounds })
        TGW-->>FE: tournament_update → next_round
        FE->>FE: clearCountdown() → xóa dòng countdown
        FE->>FE: Hiển thị pairings vòng mới
    end
```

---

## 11. Luồng Xóa Giải Đấu (NEW)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend (Tournament Detail)
    participant Ctrl as TournamentController
    participant TSvc as TournamentService
    participant TGW as TournamentGateway
    participant DB as Postgres (Drizzle)
    participant Redis as Redis

    Note over FE: Creator/admin click "Delete Tournament"
    FE->>FE: confirm("Delete permanently?")
    FE->>Ctrl: DELETE /tournament/:id (JWT Auth)
    Ctrl->>TSvc: isAdmin(userId) → check role
    TSvc->>DB: SELECT role FROM users WHERE id = userId
    DB-->>TSvc: role = 'user'|'admin'

    Ctrl->>TSvc: deleteTournament(id, userId, isAdmin)
    TSvc->>DB: SELECT * FROM tournaments WHERE id = ?
    DB-->>TSvc: tournament record

    alt status = 'ongoing'
        TSvc-->>Ctrl: ForbiddenException("Finish it first")
    else creator/admin & status != 'ongoing'
        TSvc->>DB: DELETE FROM tournament_participants WHERE tournamentId = ?
        TSvc->>DB: UPDATE games SET tournamentId = NULL WHERE tournamentId = ?
        TSvc->>DB: DELETE FROM tournaments WHERE id = ?
        DB-->>TSvc: ✓

        Note over TSvc,Redis: Clean up Redis keys
        loop round 1→7
            TSvc->>Redis: DEL tournament:{id}:round:{r}
        end
        TSvc->>Redis: DEL tournament:{id}:currentRound
        TSvc->>Redis: SCAN tournament:game:* → DEL matching keys
        Redis-->>TSvc: ✓

        TSvc-->>Ctrl: { message: 'Tournament deleted successfully' }
    end

    Ctrl->>TGW: clearNextRoundTimer(id)
    Ctrl-->>FE: 200 OK
    FE->>FE: router.push('/tournaments')
```

---

## 12. ERD Cập Nhật — Redis Data Structures (NEW)

```mermaid
erDiagram
    USERS ||--o{ GAMES : "plays (white)"
    USERS ||--o{ GAMES : "plays (black)"
    USERS ||--o{ GAMES : "wins"
    USERS ||--o{ TOURNAMENT_PARTICIPANTS : "participates"
    USERS ||--o{ TOURNAMENTS : "creates"
    USERS ||--o{ FRIENDS : "adds"
    USERS ||--o{ MESSAGES : "sends"
    USERS ||--o{ CHAT_ROOM_MEMBERS : "joins"
    USERS ||--|| PROFILE_INFO : "has"

    TOURNAMENTS ||--o{ TOURNAMENT_PARTICIPANTS : "has participants"
    TOURNAMENTS ||--o{ GAMES : "contains"
    
    CHAT_ROOMS ||--o{ CHAT_ROOM_MEMBERS : "contains"
    CHAT_ROOMS ||--o{ MESSAGES : "has"

    USERS {
        uuid id PK
        varchar username
        varchar email
        text passwordHash
        integer blitzRating "ELO Blitz ← updated sau game"
        integer rapidRating "ELO Rapid ← updated sau game"
        integer bulletRating "ELO Bullet ← updated sau game"
        varchar role
        timestamp createdAt
    }

    PROFILE_INFO {
        serial id PK
        jsonb metadata
        uuid userId FK
    }

    FRIENDS {
        uuid user1Id PK_FK
        uuid user2Id PK_FK
        varchar status
    }

    GAMES {
        uuid id PK
        uuid whiteId FK
        uuid blackId FK
        uuid winnerId FK
        varchar status
        varchar timeControl
        text pgn
        text finalFen
        jsonb moves
        uuid tournamentId FK
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
        uuid referenceId
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

### Redis Data Structures (In-Memory / Cache)

| Key Pattern | Type | Purpose |
|---|---|---|
| `chess:leaderboard:{blitz\|bullet\|rapid}` | Sorted Set | ELO ranking (score=ELO, member=userId) |
| `chess:player:{userId}:{blitz\|bullet\|rapid}` | Hash | Player stats: `{elo, wins, losses, draws, gamesPlayed, eloChange, trend}` |
| `chess:online_users` | Hash | userId → socketId mapping |
| `tournament:{id}:round:{1-7}` | String (JSON) | Tournament round data (pairings, results) |
| `tournament:{id}:currentRound` | String | Current round number |
| `tournament:game:{gameId}` | String (JSON) | Reverse lookup: { tournamentId, round } |
| `chat:room:{roomId}:messages` | List | Last 50 messages (cache) |
| `game:{gameId}` | Hash | Active game state (FEN, PGN, clocks, etc.) |
