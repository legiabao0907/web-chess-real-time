# Luồng Game

## Các Bước Trong Một Trận Đấu

### 1. Matchmaking
- Người chơi vào hàng đợi
- Redis Lua script ghép trận hoặc xếp hàng
- Khi tìm thấy đối thủ, tạo game state

### 2. Game Started
- Tạo trạng thái game trong Redis với:
  - `gameId`: UUID duy nhất
  - `whiteId`, `blackId`: IDs của 2 người chơi
  - `fen`: Trạng thái bàn cờ (FEN notation)
  - `pgn`: Portable Game Notation
  - `moves`: Mảng các nước đi
  - `timeControl`: Loại thời gian (blitz/rapid/bullet)
  - `whiteTime`, `blackTime`: Thời gian còn lại
  - `status`: 'active'
- Emit `game_started` cho cả 2 người chơi
- Cả 2 players join Socket.IO room (gameId)

### 3. Making Moves
- Client emit `make_move` với `{from, to, promotion}`
- Server validate:
  - Có phải lượt của người chơi không?
  - Game có đang active không?
  - Nước đi có hợp lệ không? (dùng chess.js)
- Nếu hợp lệ:
  - Tính toán và trừ thời gian
  - Cập nhật game state trong Redis
  - Broadcast `move_made` tới room
  - Broadcast `game_update` tới spectators (WatchGateway)

### 4. Game Over
Các trường hợp kết thúc:
- **Checkmate**: Chiếu hết
- **Stalemate**: Hòa do bí
- **Draw**: Hòa do thỏa thuận hoặc luật 50 nước
- **Timeout**: Hết giờ
- **Resign**: Đầu hàng

Khi game kết thúc:
1. Emit `game_over` tới room với kết quả
2. Lưu game vào PostgreSQL (persist)
3. Cập nhật ratings của người chơi
4. Xóa trạng thái khỏi Redis (sau TTL)
5. Clear `currentGameId` của cả 2 người chơi
