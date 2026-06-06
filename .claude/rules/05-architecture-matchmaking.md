# Hệ Thống Ghép Trận (Matchmaking) — ELO-Based

## Redis Lua Scripts

Sử dụng Redis Lua scripts cho các thao tác hàng đợi atomic để tránh race conditions. Queue dùng **ZSET** (sorted set) thay vì List để query theo ELO rating hiệu quả.

### Vị Trí
- **Scripts**: Embed trong [`backend/src/game/game.service.ts`](../backend/src/game/game.service.ts)
- **Lua script**: `MATCHMAKE_LUA` (ELO-based atomic matchmaking)
- **Leave script**: `LEAVE_QUEUE_LUA` (atomic queue removal via ZSCAN + ZREM)

### Cách Hoạt Động

1. **Người chơi vào hàng đợi**:
   - Client emit `find_game` với `timeControl` và `rating` (ELO)
   - Server gọi `MATCHMAKE_LUA` với `maxEloDiff = 30` (phạm vi ban đầu)

2. **Lua Script Xử Lý Atomic** (ZSET-based):
   - ZSCAN kiểm tra người chơi đã có trong queue chưa → nếu có thì update entry
   - ZRANGEBYSCORE tìm đối thủ trong khoảng `[rating - maxDiff, rating + maxDiff]`
   - Chọn đối thủ có **rating gần nhất** (min |opponent.rating - myRating|)
   - **Nếu tìm thấy**: ZREM đối thủ khỏi queue, return `MATCHED:{opponentJson}`
   - **Nếu không**: ZADD người chơi vào queue (score = rating), return `QUEUED:{maxDiff}`

3. **Server Xử Lý Kết Quả**:
   - **Nếu matched**: Tạo game state, emit `game_start` cho cả 2 players
   - **Nếu queued**: Emit `searching` với `{eloRange, startedAt}`, bắt đầu hiển thị UI

## ELO Range Expansion (Mở Rộng Phạm Vi)

Cứ mỗi **5 giây** chờ đợi, phạm vi ELO được mở rộng thêm **±30**, tối đa **±200**:

| Thời gian chờ | Phạm vi ELO |
|---------------|-------------|
| 0-5s | ±30 |
| 5-10s | ±60 |
| 10-15s | ±90 |
| 15-20s | ±120 |
| 20-25s | ±150 |
| 25-30s | ±180 |
| 30s+ | ±200 (cap) |

**Server-driven re-match**: Backend có `setInterval` mỗi 5 giây, tự động thử ghép lại tất cả người đang chờ với phạm vi ELO đã mở rộng. Client nhận event `search_progress` để cập nhật UI.

## Đảm Bảo Tính Nhất Quán

- **Atomic operations**: Lua script chạy atomic trong Redis, không có race condition
- **Exactly-once matching**: ZRANGEBYSCORE + ZREM là atomic — mỗi cặp chỉ được ghép đúng một lần
- **No duplicate games**: Không có trận trùng lặp
- **Closest rating first**: Luôn ưu tiên ghép người có ELO gần nhất trong phạm vi cho phép

## Time Control Matching

Người chơi chỉ được ghép với đối thủ có cùng time control:
- **Bullet**: 1 phút
- **Blitz**: 5 phút
- **Rapid**: 10 phút

Mỗi time control có queue ZSET riêng: `chess:queue:bullet_1`, `chess:queue:blitz_5`, `chess:queue:rapid_10`
