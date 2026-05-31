# Chiến Lược Quản Lý Trạng Thái

## Phân Tầng Lưu Trữ

### Redis (Trạng Thái Tạm Thời)
- **Trận đấu đang diễn ra**: Lưu trong Redis để truy cập nhanh và cập nhật thời gian thực
- **Phiên người dùng**: Redis với JWT tokens (access: 15 phút, refresh: 7 ngày)
- **Hàng đợi matchmaking**: Queue được quản lý bằng Redis với Lua scripts

### PostgreSQL (Lưu Trữ Lâu Dài)
- **Trận đấu đã kết thúc**: Lưu vào PostgreSQL với đầy đủ PGN, nước đi và metadata
- **Thông tin người dùng**: Profile, ratings, lịch sử
- **Giải đấu**: Metadata, participants, standings
- **Chat history**: Messages và chat rooms

## Luồng Dữ Liệu

1. **Khi game bắt đầu**: Tạo state trong Redis
2. **Trong khi chơi**: Mọi cập nhật đều ghi vào Redis
3. **Khi game kết thúc**: 
   - Persist toàn bộ game vào PostgreSQL
   - Xóa state khỏi Redis (sau TTL)
   - Cập nhật ratings của người chơi

## Lợi Ích

- **Performance**: Redis cung cấp latency thấp cho real-time updates
- **Scalability**: Tách biệt hot data (Redis) và cold data (PostgreSQL)
- **Reliability**: PostgreSQL đảm bảo dữ liệu không bị mất
