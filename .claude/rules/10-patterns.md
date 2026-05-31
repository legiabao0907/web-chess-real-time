# Các Pattern Chính

## Validate Nước Đi

### Server-side Validation (Bắt buộc)
- **Tất cả nước đi** phải được validate ở server-side bằng chess.js
- Ngăn chặn gian lận - client không thể gửi nước đi không hợp lệ
- Kiểm tra:
  - Có phải lượt của người chơi không?
  - Nước đi có hợp lệ theo luật cờ vua không?
  - Game có đang active không?

### Client-side Validation (UX only)
- Chỉ để cải thiện trải nghiệm người dùng
- Highlight legal moves
- Prevent illegal moves trước khi gửi lên server
- **Không tin tưởng** client-side validation

## Quản Lý Đồng Hồ

### Server-side Time Control
- Time control được thực thi hoàn toàn ở server-side
- Mỗi nước đi:
  1. Tính thời gian đã trôi qua từ nước đi trước
  2. Trừ thời gian của người chơi
  3. Kiểm tra timeout
- Game tự động kết thúc khi hết giờ

### Không Tin Tưởng Client
- Client không thể cheat bằng cách gửi thời gian sai
- Server là nguồn chân lý duy nhất về thời gian

## Trận Đấu Với Bot

### Xử Lý Đặc Biệt
- **Bot IDs được nullify** khi lưu vào database
  - `blackId = null` nếu bot chơi quân đen
  - Tránh tạo user records cho bots
- **AI moves** được tạo qua Stockfish integration
  - File: [backend/src/ai/](backend/src/ai/)
  - Stockfish WASM chạy trong backend hoặc frontend

### Bot Games Flow
1. User chọn chơi với bot
2. Tạo game với `blackId = BOT_ID`
3. Khi đến lượt bot, gọi Stockfish để generate move
4. Khi persist vào DB, nullify bot ID

## Xác Thực (Authentication)

### JWT-based Auth
- **Access Token**: 15 phút, dùng cho API requests
- **Refresh Token**: 7 ngày, dùng để renew access token
- Tokens được lưu trong Redis

### Guards
- **File**: [backend/src/user/guards/](backend/src/user/guards/)
- Bảo vệ routes và WebSocket events
- Kiểm tra JWT token validity
- Extract user info từ token

### WebSocket Authentication
- Client gửi token khi connect
- Server validate token trước khi cho phép join rooms
- Mỗi socket event đều được guard bảo vệ
