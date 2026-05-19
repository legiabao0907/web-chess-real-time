# Game Module - Sequence Diagrams

File này chứa các sơ đồ tuần tự (Sequence Diagram) mô tả các luồng nghiệp vụ cốt lõi của module Game, bao gồm tìm trận (Matchmaking), đánh cờ (Make Move), và lưu trữ lịch sử (Archiving). Bạn có thể dùng các tool như [Mermaid Live Editor](https://mermaid.live/) hoặc plugin Markdown Preview trên IDE để xem.

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
