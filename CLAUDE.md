# CLAUDE.md

File này cung cấp hướng dẫn cho Claude Code (claude.ai/code) khi làm việc với code trong repository này.

## Tổng Quan

Ứng dụng cờ vua full-stack thời gian thực với tính năng ghép trận, giải đấu, xem trận đấu và đối thủ AI. Xây dựng với NestJS backend, Next.js frontend, PostgreSQL để lưu trữ dữ liệu và Redis cho trạng thái game thời gian thực.

## Chi Tiết Documentation

Tài liệu chi tiết đã được tách thành các file rules riêng biệt trong thư mục [.claude/rules/](.claude/rules/):

1. **[Tổng Quan Dự Án](.claude/rules/01-project-overview.md)** - Tech stack và cấu trúc dự án
2. **[Lệnh Phát Triển](.claude/rules/02-development-commands.md)** - Commands để run, build, test
3. **[Quản Lý Trạng Thái](.claude/rules/03-architecture-state.md)** - Redis + PostgreSQL strategy
4. **[Giao Tiếp Thời Gian Thực](.claude/rules/04-architecture-realtime.md)** - Socket.IO gateways
5. **[Hệ Thống Ghép Trận](.claude/rules/05-architecture-matchmaking.md)** - Redis Lua scripts
6. **[Luồng Game](.claude/rules/06-architecture-game-flow.md)** - Game lifecycle
7. **[Hệ Thống Giải Đấu](.claude/rules/07-architecture-tournament.md)** - Swiss pairing
8. **[Database Schema](.claude/rules/08-architecture-database.md)** - Drizzle ORM tables
9. **[Kiến Trúc Frontend](.claude/rules/09-architecture-frontend.md)** - Next.js structure
10. **[Patterns](.claude/rules/10-patterns.md)** - Validation, clock, bot, auth patterns
11. **[Biến Môi Trường](.claude/rules/11-environment.md)** - Environment variables
12. **[Testing](.claude/rules/12-testing.md)** - Testing guidelines
13. **[Kiến Trúc Chat](.claude/rules/13-architecture-chat.md)** - Direct Message 1-1

## Quick Start

```bash
# Khởi động tất cả services
docker-compose up

# Hoặc chạy riêng lẻ
docker-compose up postgres redis  # Infrastructure
cd backend && npm run start:dev   # Backend
cd frontend && npm run dev         # Frontend
```

Xem [Development Commands](.claude/rules/02-development-commands.md) để biết thêm chi tiết.

## Trạng Thái Dự Án (Project Status)

### 1. Những gì đã hoàn thành gần đây
- **Tính năng Direct Message (DM) 1-1**:
  - Tích hợp Redis Hash (`chess:online_users`) để theo dõi `userId -> socketId` theo thời gian thực.
  - Hỗ trợ gửi tin nhắn trực tiếp qua sự kiện `send_direct_message` mà không cần join room từ trước.
  - Xây dựng hoàn chỉnh UI `ChatDrawer` trên Frontend với tính năng auto-scroll, trạng thái đang gõ (typing indicator), cảnh báo mất kết nối, và hỗ trợ đa tab (multi-tab support).
  - Tích hợp Zustand store (`useChatStore`) để quản lý phòng chat tạm thời và thông báo tin nhắn chưa đọc (unread badge).
- **Sửa lỗi kết nối Docker**:
  - Khắc phục lỗi frontend không thể `fetch` dữ liệu từ backend bằng cách thay đổi địa chỉ IP Wi-Fi tĩnh (hardcoded) thành `localhost` trong `docker-compose.yml`.
- **Sửa 3 bug hệ thống Tournament (31/05/2026)**:
  - **Bug 1 - Countdown 30s không hiển thị**: `useState` cho `nextRoundAt` gây stale closure trong `setInterval`. Fix: refactor dùng `useRef` (`nextRoundAtRef` + `countdownTimerRef`) + helper `startCountdown(ms)` / `clearCountdown()`.
  - **Bug 2 - Text countdown không mất + không nhận real-time events**: Root cause chính: **Socket.IO connect sai namespace**. Frontend dùng `NEXT_PUBLIC_API_URL` → connect `/api/tournament` thay vì `/tournament` → không nhận được bất kỳ event nào. Fix: dùng `NEXT_PUBLIC_BACKEND_URL` cho Socket.IO. Ngoài ra: đảo thứ tự handler (countdown events trước, data sau), gọi `clearCountdown()` trong `fetchState`.
  - **Bug 3 - Không thể xóa giải đấu**: Thêm `DELETE /tournament/:id` (creator/admin), `deleteTournament()` cascade DB+Redis, nút Delete trên frontend.
- **Hệ thống ELO chuẩn FIDE + Hiển thị +/- ELO (31/05/2026)**:
  - ELO tính theo công thức FIDE: $E_A = 1/(1+10^{(R_B-R_A)/400})$, $R_{new}=R+K(S-E)$, K=32.
  - Backend: `triggerEloUpdate()` trả về `{winnerChange, loserChange, winnerNewElo, loserNewElo}`.
  - Backend: Persist ELO vào PostgreSQL `users` table (`blitzRating`/`bulletRating`/`rapidRating`) qua `LeaderboardService.updateElo()`.
  - Backend: Tất cả 4 code path `game_over` (checkmate, resign, draw offer, accept draw) đều gửi kèm `whiteEloChange`/`blackEloChange`/`whiteNewElo`/`blackNewElo`.
  - Frontend: Game-over modal hiển thị +/- ELO với icon (🏆/💔/🤝), old→new ELO, glow effect xanh/đỏ.
  - Frontend: `useChessSocket` cập nhật localStorage `authUser` sau game để bottom panel/profile hiển thị ELO mới ngay.
  - Frontend: Profile page (`GET /user/me`) đọc từ DB đã được update → hiển thị ELO chính xác.
- **Cập nhật tài liệu**: Tạo file `.claude/rules/13-architecture-chat.md`.

### 2. Trạng thái cập nhật của từng phần
- **Backend (NestJS)**: 🟢 Hoạt động ổn định. Các module Game, Tournament, Chat, Auth đã được định hình rõ ràng và tích hợp Socket.IO + Redis thành công.
- **Frontend (Next.js)**: 🟢 Hoạt động trơn tru. Giao diện người dùng đã tích hợp tốt với WebSockets và Zustand. Dashboard, Profile, và ChatDrawer đã hoàn thiện.
- **Database (PostgreSQL + Drizzle)**: 🟢 Ổn định. Schema cho Users, Games, Tournaments và Chat đã được định nghĩa đầy đủ.
- **Infrastructure (Docker)**: 🟢 Môi trường dev (Postgres, Redis, Backend, Frontend) đã được dockerize hoàn chỉnh và chạy trơn tru qua `docker-compose`.

### 3. Những quyết định quan trọng & Lý do
- **Sử dụng Redis Hash cho Online Users**: Thay vì chỉ dùng Socket.IO rooms, chúng ta lưu mapping `userId -> socketId` vào Redis (`chess:online_users`).
  - *Lý do*: Cho phép gửi tin nhắn tới người dùng ngay cả khi họ chưa mở khung chat (chưa join room). Nó cũng giúp dễ dàng đồng bộ tin nhắn trên nhiều tab trình duyệt của cùng một user và chuẩn bị sẵn sàng cho việc scale backend ra nhiều instance.
- **Kiến trúc 2 luồng gửi tin nhắn (Room-based & Direct-based)**: Tồn tại song song cả `send_dm` (gửi vào room) và `send_direct_message` (gửi thẳng tới user).
  - *Lý do*: Đảm bảo tính linh hoạt. UI sẽ ưu tiên gửi room-based nếu đã join phòng, nhưng sẽ fallback sang direct-based một cách mượt mà để đảm bảo tin nhắn không bao giờ bị rớt.
- **Sử dụng `localhost` thay vì IP tĩnh trong Docker**: 
  - *Lý do*: IP của card Wi-Fi thay đổi liên tục khi đổi mạng, dẫn đến lỗi fetch trên trình duyệt. Việc dùng `localhost` đảm bảo môi trường local development luôn ổn định bất kể cấu hình mạng.
- **Phân biệt `NEXT_PUBLIC_API_URL` và `NEXT_PUBLIC_BACKEND_URL` cho Socket.IO**:
  - `NEXT_PUBLIC_API_URL` = `http://localhost:8080/api` → dùng cho REST API calls (`apiFetch`)
  - `NEXT_PUBLIC_BACKEND_URL` = `http://localhost:8080` → dùng cho Socket.IO connections
  - *Lý do*: Socket.IO namespace là `/tournament`, `/chess`, `/chat`, `/watch` — nếu dùng API URL (`/api/tournament`) sẽ connect sai namespace và không nhận được real-time events. **Tất cả hooks (`useChessSocket`, `useFriendChat`, `useWatchSocket`) đã dùng đúng `BACKEND_URL`, chỉ tournament detail page từng dùng sai.**
- **Countdown dùng `useRef` thay vì `useState`**:
  - *Lý do*: Trong `setInterval`, biến state bị capture bởi closure và trở thành stale khi component re-render vì các state khác. Dùng `useRef` đảm bảo luôn đọc được giá trị mới nhất.
- **Drizzle DB update dùng TypeScript property name, không dùng DB column name**:
  - Drizzle `.set({ blitzRating: 1200 })` dùng tên property TypeScript (`blitzRating`), KHÔNG dùng tên cột DB (`blitz_rating`).
  - Nếu dùng dynamic key `{ [colName]: value }`, `colName` phải là `'blitzRating'` (TypeScript prop), không phải `'blitz_rating'` (DB column).
  - *Lý do*: Drizzle map property name → column name qua schema definition. String không được map.
- **NestJS Module phải import đủ dependencies**:
  - Khi inject provider từ module khác (VD: `DRIZZLE` từ `DrizzleModule`), phải thêm module đó vào `imports` của module hiện tại.
  - *Ví dụ lỗi*: `LeaderboardService` inject `DRIZZLE` nhưng `LeaderboardModule` thiếu `imports: [DrizzleModule]` → `UnknownDependenciesException`.

### 4. Bước tiếp theo cần làm (Next Steps)

**Ưu tiên cao**:
- **Fix game stuck bug**: Khi 1 người chơi disconnect, game có thể kẹt không resign được. Cần thêm auto-timeout khi không có heartbeat, và đảm bảo resign hoạt động trong mọi trạng thái game.
- **Tournament edge cases**: Xử lý khi người chơi thoát giữa chừng (disconnect/reconnect trong tournament game), trường hợp chỉ còn 1 người trong tournament.

**Ưu tiên trung bình**:
- **Cập nhật stats vào profileInfo DB**: Hiện tại wins/losses/draws chỉ lưu trong Redis, chưa update vào PostgreSQL `profileInfo.metadata` JSONB → profile page luôn hiện 0 games.
- **Hệ thống Bạn bè (Friend System)**: Hoàn thiện luồng gửi/nhận lời mời kết bạn (schema đã có bảng `friends`). Cần: UI gửi/nhận lời mời, chấp nhận/từ chối, danh sách bạn bè.
- **Thông báo (Notifications)**: Đẩy thông báo thời gian thực (Toast) khi có lời mời kết bạn, tin nhắn mới ngoài màn hình Chat, hoặc khi được ghép trận.

**Ưu tiên thấp**:
- **Tối ưu hóa Docker build**: `--no-cache` build quá chậm (Next.js production build). Cân nhắc dùng `npm run dev` cho development thay vì Docker.
- **Auto-reconnect WebSocket**: Xử lý mất kết nối mạng — tự động reconnect và resync state.
