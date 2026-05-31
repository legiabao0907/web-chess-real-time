# Giao Tiếp Thời Gian Thực

## Socket.IO Gateways

Tất cả tính năng thời gian thực sử dụng Socket.IO với các gateway chuyên biệt:

### GameGateway
- **File**: [backend/src/game/game.gateway.ts](backend/src/game/game.gateway.ts)
- **Chức năng**: 
  - Ghép trận (matchmaking)
  - Xử lý nước đi
  - Quản lý trạng thái game
  - Broadcast updates tới players
- **Events**:
  - `join_queue`: Người chơi vào hàng đợi
  - `make_move`: Người chơi đi cờ
  - `resign`: Người chơi đầu hàng
  - `game_started`: Server thông báo game bắt đầu
  - `move_made`: Server broadcast nước đi mới
  - `game_over`: Server thông báo game kết thúc

### WatchGateway
- **File**: [backend/src/watch/watch.gateway.ts](backend/src/watch/watch.gateway.ts)
- **Chức năng**: Chế độ xem trận (spectator mode)
- **Events**:
  - `watch_game`: Khán giả xem một trận đấu
  - `game_state`: Server gửi trạng thái game hiện tại
  - `game_update`: Server broadcast cập nhật cho khán giả

### ChatGateway
- **File**: [backend/src/chat/chat.gateway.ts](backend/src/chat/chat.gateway.ts)
- **Chức năng**: Chat trong game
- **Events**:
  - `send_message`: Gửi tin nhắn
  - `new_message`: Server broadcast tin nhắn mới

### TournamentGateway
- **File**: [backend/src/tournament/tournament.gateway.ts](backend/src/tournament/tournament.gateway.ts)
- **Chức năng**: Cập nhật giải đấu thời gian thực
- **Events**:
  - `join_tournament`: Tham gia giải đấu
  - `tournament_update`: Cập nhật standings, pairings

## Room Management

- Mỗi game có một room riêng (gameId)
- Players tự động join room khi game bắt đầu
- Spectators có thể join room để xem
- Broadcast chỉ gửi tới members trong room
