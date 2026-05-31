# Kiểm Tra Thay Đổi

## Testing Game Logic Changes

### Setup
1. Khởi động services:
   ```bash
   docker-compose up
   ```

2. Seed database với dữ liệu test:
   ```bash
   cd backend && npm run db:seed
   ```

### Test Matchmaking
1. Mở **hai cửa sổ trình duyệt** (hoặc hai tab incognito)
2. Đăng nhập với 2 tài khoản khác nhau
3. Cả 2 vào hàng đợi với **cùng time control** (blitz/rapid/bullet)
4. Verify:
   - Cả 2 được ghép với nhau
   - Game state được tạo đúng
   - Cả 2 nhận event `game_started`

### Test Moves
1. Trong game đã ghép, đi cờ ở cả 2 cửa sổ
2. Verify:
   - Nước đi được đồng bộ giữa 2 clients
   - Đồng hồ được cập nhật đúng
   - Không thể đi khi không phải lượt
   - Không thể đi nước không hợp lệ

### Test Game Persistence
1. Kết thúc game (checkmate/resign/timeout)
2. Verify:
   - Game xuất hiện trong `/archives`
   - PGN được lưu đúng
   - Ratings được cập nhật
   - Game state bị xóa khỏi Redis

## Testing Tournament Changes

### Setup
1. Tạo giải đấu qua API hoặc UI:
   ```bash
   POST /api/tournaments
   {
     "name": "Test Tournament",
     "format": "swiss",
     "timeControl": "blitz"
   }
   ```

2. Thêm người tham gia (ít nhất 4 người để test pairing)

### Test Pairing Logic
1. Bắt đầu giải đấu
2. Verify vòng 1:
   - Pairings được tạo đúng
   - Mỗi người chơi được ghép với 1 đối thủ
   - Games được tạo với `tournamentId`

### Test Standings Update
1. Hoàn thành các trận đấu trong vòng
2. Verify:
   - Điểm số được cập nhật đúng (win: 1, draw: 0.5, loss: 0)
   - Tiebreaks được tính
   - Rankings được sắp xếp đúng
3. Bắt đầu vòng tiếp theo
4. Verify pairings dựa trên standings hiện tại

## Testing Real-time Features

### Test Spectator Mode
1. Có 2 người chơi đang trong game
2. Người thứ 3 vào `/watch` và chọn game
3. Verify:
   - Spectator nhận được game state hiện tại
   - Spectator nhận updates khi có nước đi mới
   - Spectator không thể đi cờ

### Test Chat
1. Trong game, gửi tin nhắn
2. Verify:
   - Tin nhắn được broadcast tới cả 2 players
   - Tin nhắn được lưu vào database
   - Chat history được load đúng

## Unit & E2E Tests

### Backend Tests
```bash
cd backend
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run test:cov       # Coverage report
```

### Frontend Tests
```bash
cd frontend
npm run test           # Component tests
```
