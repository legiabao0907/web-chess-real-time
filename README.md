# ♟️ Chess Real-time System - Project Documentation

Dự án này là một ứng dụng cờ vua trực tuyến thời gian thực, được xây dựng với kiến trúc hiện đại sử dụng NestJS, Socket.io, và Redis. Dưới đây là tài liệu chi tiết về luồng logic của hệ thống.

## 🏗️ Kiến trúc Công nghệ
- **Frontend**: Next.js, Socket.io-client, react-chessboard, chess.js.
- **Backend**: NestJS, Socket.io Gateway, Redis (lưu trữ GameState và Matchmaking Queue).
- **Trạng thái**: Đồng bộ hóa thời gian thực qua WebSocket.

---

## 🛰️ Luồng Luồng Logic Hệ thống

### 1. Luồng Tìm trận (Matchmaking)
Sử dụng Redis List làm hàng đợi (Queue) để ghép cặp người chơi có cùng chế độ thời gian (Time Control).

```mermaid
sequenceDiagram
    participant P1 as Player 1 (Frontend)
    participant P2 as Player 2 (Frontend)
    participant GW as Game Gateway (Backend)
    participant GS as Game Service
    participant R as Redis

    Note over P1, R: Player 1 tìm trận
    P1->>GW: emit("find_game", {timeControl: "blitz_5"})
    GW->>GS: joinQueue(entryP1)
    GS->>R: LPOP chess:queue:blitz_5 (Trống)
    GS->>R: RPUSH chess:queue:blitz_5 (entryP1)
    GW-->>P1: emit("searching")

    Note over P2, R: Player 2 tìm trận (sau đó)
    P2->>GW: emit("find_game", {timeControl: "blitz_5"})
    GW->>GS: joinQueue(entryP2)
    GS->>R: LPOP chess:queue:blitz_5 -> trả về entryP1
    GS-->>GW: Trả về đối thủ (Player 1)
    
    Note over GW, GS: Khởi tạo trận đấu
    GW->>GS: createGameState(P1, P2)
    GS-->>GW: Trạng thái bàn cờ ban đầu
    GW->>GS: saveGame(gameState)
    GS->>R: SETEX chess:game:{id}
    GW->>R: SET chess:user:P1:game {id}
    GW->>R: SET chess:user:P2:game {id}

    Note over GW, P2: Thông báo bắt đầu
    GW->>P1: join Room(gameId)
    GW->>P2: join Room(gameId)
    GW->>P1: emit("game_start", data)
    GW->>P2: emit("game_start", data)
```

### 2. Luồng Nước đi (Make Move)
Xử lý logic cờ vua, tính toán thời gian (Time Management) và đồng bộ hóa trạng thái bàn cờ.

```mermaid
sequenceDiagram
    participant P1 as Player 1 (Trắng)
    participant GW as Game Gateway
    participant GS as Game Service
    participant R as Redis
    participant P2 as Player 2 (Đen)

    P1->>GW: emit("make_move", {gameId, move})
    GW->>GS: processMove(gameId, userId, move)
    
    GS->>R: GET chess:game:{id}
    R-->>GS: Trả về GameState hiện tại

    Note over GS: 1. Kiểm tra lượt đi (Trắng?)
    Note over GS: 2. Trừ thời gian Player 1 (Elapsed time)
    Note over GS: 3. Chess.js validate nước đi
    Note over GS: 4. Cập nhật FEN, PGN, Turn (sang Đen)
    
    GS->>R: SETEX chess:game:{id} (Lưu trạng thái mới)
    GS-->>GW: Trả về {success: true, game}

    GW->>P1: emit("move_made", updateData) (Room broadcast)
    GW->>P2: emit("move_made", updateData) (Room broadcast)

    alt Nếu Game Over (Chiếu bí/hết giờ/Hòa)
        GW->>R: DEL chess:user:P1:game
        GW->>R: DEL chess:user:P2:game
        GW->>P1: emit("game_over", result)
        GW->>P2: emit("game_over", result)
    end
```

### 3. Luồng Kết nối lại (Reconnection)
Đảm bảo người chơi không bị mất ván đấu khi F5 hoặc mạng chập chờn.

```mermaid
sequenceDiagram
    participant P as Player (Frontend)
    participant GW as Game Gateway
    participant GS as Game Service
    participant R as Redis

    P->>GW: Kết nối Socket (Connect)
    P->>GW: emit("reconnect_check", {userId})
    
    GW->>GS: getUserCurrentGame(userId)
    GS->>R: GET chess:user:{userId}:game
    R-->>GS: Trả về gameId (nếu có)
    GS-->>GW: Trả về gameId

    alt Nếu có gameId
        GW->>GS: getGame(gameId)
        GS->>R: GET chess:game:{gameId}
        R-->>GS: Trả về GameState
        GW->>P: join Room(gameId)
        GW->>P: emit("game_state", gameState)
        Note right of P: UI khôi phục bàn cờ từ FEN/PGN
    else Không có gameId
        Note right of P: UI ở trạng thái Home/Idle
    end
```

---

## 🛠️ Quản lý Trạng thái (Redis)
- `chess:game:{gameId}`: Lưu trữ `GameState` (JSON) bao gồm FEN, PGN, thời gian còn lại, lượt đi.
- `chess:queue:{timeControl}`: Redis List lưu các người chơi đang đợi.
- `chess:user:{userId}:game`: Lưu `gameId` hiện tại của User để phục vụ tính năng kết nối lại.

---

## 🕹️ Các Tính năng bổ trợ
- **Resign**: Kết thúc trận đấu lập tức, người bỏ cuộc bị xử thua.
- **Draw Offer**: Đề nghị hòa có thời hạn 60 giây, được lưu trong Redis.
- **Chat**: Gửi tin nhắn thời gian thực trong phòng đấu.
- **Time Controls**: Hỗ trợ nhiều chế độ: Bullet (1+0, 1+1), Blitz (3+0, 3+2, 5+0), Rapid (10+0, 15+10).
