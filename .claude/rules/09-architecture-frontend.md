# Kiến Trúc Frontend

## Next.js 16 với App Router

### Route Groups

#### (auth) - Unauthenticated Routes
- `/login`: Trang đăng nhập
- `/register`: Trang đăng ký

#### (dashboard) - Authenticated Routes
- `/home`: Trang chủ
- `/play`: Chơi cờ (matchmaking)
- `/play-bot`: Chơi với AI
- `/tournaments`: Danh sách giải đấu
- `/tournaments/[id]`: Chi tiết giải đấu
- `/tournament-game/[id]`: Trận đấu trong giải
- `/watch`: Xem trận đấu trực tiếp
- `/archives`: Lịch sử trận đấu
- `/ranks`: Bảng xếp hạng
- `/live`: Các trận đang diễn ra

### State Management

**Zustand Stores**:
- User store: Thông tin người dùng, authentication
- Game store: Trạng thái game hiện tại
- Tournament store: Thông tin giải đấu

### Real-time Communication

**Socket.IO Client**:
- Kết nối tới backend gateways
- Listen events: `game_started`, `move_made`, `game_over`, etc.
- Emit events: `join_queue`, `make_move`, `resign`, etc.

### Chess UI

**react-chessboard**:
- Component hiển thị bàn cờ
- Drag & drop pieces
- Highlight legal moves

**chess.js**:
- Client-side validation (UX only)
- Generate legal moves
- Check game status (check, checkmate, stalemate)

### AI Integration

**Stockfish WASM**:
- Chạy Stockfish engine trong browser
- Generate AI moves cho bot games
- Không cần backend call cho AI moves
