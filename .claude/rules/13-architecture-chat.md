# Kiến Trúc Hệ Thống Chat (Direct Message 1-1)

Hệ thống Chat cung cấp tính năng nhắn tin trực tiếp (Direct Message) 1-1 theo thời gian thực giữa các user.

## Tổng Quan Kiến Trúc

Hệ thống kết hợp 2 phương thức định tuyến tin nhắn bổ trợ cho nhau:

1. **Room-based Routing (Socket.IO Rooms)**:
   - Dùng khi 2 user đã mở hộp thoại chat (cùng join vào một `roomId`).
   - Server nhận event `send_dm` và broadcast sự kiện `dm_message` vào room đó bằng `this.server.to(roomId).emit(...)`.
2. **Direct/Redis-based Routing (Redis Hash)**:
   - Dùng khi gửi tin nhắn cho một user (có thể họ đang online nhưng chưa mở cửa sổ chat).
   - Redis duy trì một Hash map `chess:online_users` (Key là `userId`, Value là `socketId`).
   - Server nhận sự kiện `send_direct_message`, tra cứu `socketId` của người nhận từ Redis Hash và emit sự kiện `receive_direct_message` trực tiếp tới socket đó.
   - Hỗ trợ Multi-tab: tin nhắn cũng được gửi ngược lại tất cả các socket của chính người gửi để đồng bộ giao diện trên các tab khác nhau.

## Dữ liệu và Trạng Thái

- **PostgreSQL**: Lưu trữ toàn bộ lịch sử tin nhắn và phòng chat (qua Drizzle ORM).
  - Bảng `chat_rooms`: Lưu ID phòng, loại phòng (`private`).
  - Bảng `chat_room_members`: Liên kết User ID và Room ID.
  - Bảng `messages`: Lưu nội dung tin nhắn, người gửi, thời gian gửi, và Room ID.
- **Redis Cache**: 
  - `chess:online_users` (Hash): Quản lý mapping `userId` -> `socketId`. Cập nhật khi kết nối (`identify`) và ngắt kết nối.
  - `chat:room:<roomId>:messages` (List): Cache 50 tin nhắn gần nhất của phòng để tải lịch sử nhanh chóng.

## Giao Tiếp Frontend - Backend

### Socket.IO Events

- **Gateway Namespace**: `/chat`
- **Events Nhận Từ Client**:
  - `identify`: Client báo danh `userId` khi kết nối để lưu vào Redis.
  - `join_dm`: Mở/tạo phòng chat với một friend, server trả về lịch sử (cache hoặc db).
  - `send_dm`: Gửi tin nhắn vào room (Luồng 1).
  - `send_direct_message`: Gửi tin nhắn trực tiếp bằng `toUserId` (Luồng 2).
  - `typing`: Thông báo trạng thái đang gõ.
  - `get_dm_history`: Lấy thêm lịch sử tin nhắn.
- **Events Gửi Tới Client**:
  - `dm_joined`: Gửi roomId và danh sách tin nhắn cũ.
  - `dm_message`: Nhận tin nhắn mới (Luồng 1).
  - `receive_direct_message`: Nhận tin nhắn mới (Luồng 2). Client tự động tạo phòng tạm nếu chưa mở chat để hiện Unread Badge.
  - `user_typing`: Trạng thái đang gõ từ đối phương.
  - `user_status`: Thông báo khi bạn bè online/offline.

## Cấu Trúc Frontend

- **Zustand Store (`useChatStore`)**:
  - Quản lý trạng thái các phòng chat, tin nhắn, số lượng tin nhắn chưa đọc, và trạng thái đang gõ.
  - Xử lý việc chèn tin nhắn mới (bằng hàm `upsertRoomForDirect`) để hiển thị badge Unread ngay cả khi chưa mở cửa sổ chat.
- **Hook (`useFriendChat`)**:
  - Khởi tạo kết nối Socket.IO, tự động gửi event `identify`.
  - Lắng nghe các event từ server và cập nhật vào store.
  - Đăng ký các hàm gửi tin nhắn (`sendMessage`, `sendDirectMessage`) vào store để UI Component sử dụng.
- **UI Component (`ChatDrawer`)**:
  - Hỗ trợ giao diện chọn bạn bè, nhắn tin.
  - Tự động cuộn màn hình khi có tin nhắn mới.
  - Hiển thị trạng thái Typing, Connection Offline, và Error toasts.
  - Ưu tiên gọi hàm gửi room-based, fallback sang direct-based.
