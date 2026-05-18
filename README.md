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
