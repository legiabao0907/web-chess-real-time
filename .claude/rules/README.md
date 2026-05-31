# Claude Code Rules

Thư mục này chứa các rules được tách từ CLAUDE.md chính, mỗi file tập trung vào một chủ đề cụ thể.

## Cấu Trúc Files

1. **01-project-overview.md** - Tổng quan dự án, tech stack, cấu trúc thư mục
2. **02-development-commands.md** - Các lệnh để chạy, build, test
3. **03-architecture-state.md** - Chiến lược quản lý trạng thái (Redis + PostgreSQL)
4. **04-architecture-realtime.md** - Giao tiếp thời gian thực với Socket.IO
5. **05-architecture-matchmaking.md** - Hệ thống ghép trận với Redis Lua scripts
6. **06-architecture-game-flow.md** - Luồng game từ matchmaking đến kết thúc
7. **07-architecture-tournament.md** - Hệ thống giải đấu Swiss pairing
8. **08-architecture-database.md** - Database schema với Drizzle ORM
9. **09-architecture-frontend.md** - Kiến trúc frontend Next.js
10. **10-patterns.md** - Các patterns chính (validation, clock, bot, auth)
11. **11-environment.md** - Biến môi trường cho backend và frontend
12. **12-testing.md** - Hướng dẫn testing và verification

## Sử Dụng

Claude Code sẽ tự động load các rules này khi làm việc với repository. Mỗi file cung cấp context cụ thể cho từng khía cạnh của dự án.
