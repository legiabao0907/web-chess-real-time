# Hệ Thống Ghép Trận (Matchmaking)

## Redis Lua Scripts

Sử dụng Redis Lua scripts cho các thao tác hàng đợi atomic để tránh race conditions.

### Vị Trí
- **Scripts**: [backend/src/redis/lua/](backend/src/redis/lua/)
- **Lua script**: `JOIN_QUEUE_LUA`

### Cách Hoạt Động

1. **Người chơi vào hàng đợi**:
   - Client emit `join_queue` với `timeControl` (blitz/rapid/bullet)
   - Server gọi Lua script với thông tin người chơi

2. **Lua Script Xử Lý Atomic**:
   - Quét hàng đợi tìm đối thủ phù hợp (cùng time control)
   - **Nếu tìm thấy**: Lấy đối thủ ra khỏi hàng đợi, return thông tin đối thủ
   - **Nếu không tìm thấy**: Thêm người chơi vào hàng đợi, return "QUEUED"

3. **Server Xử Lý Kết Quả**:
   - **Nếu matched**: Tạo game state, emit `game_started` cho cả 2 players
   - **Nếu queued**: Emit `queue_joined`, đợi đối thủ

## Đảm Bảo Tính Nhất Quán

- **Atomic operations**: Lua script chạy atomic, không có race condition
- **Exactly-once matching**: Mỗi cặp chỉ được ghép đúng một lần
- **No duplicate games**: Không có trận trùng lặp

## Time Control Matching

Người chơi chỉ được ghép với đối thủ có cùng time control:
- **Bullet**: < 3 phút
- **Blitz**: 3-10 phút  
- **Rapid**: > 10 phút
