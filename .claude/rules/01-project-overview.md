# Tổng Quan Dự Án

Ứng dụng cờ vua full-stack thời gian thực với tính năng ghép trận, giải đấu, xem trận đấu và đối thủ AI.

## Tech Stack

- **Backend**: NestJS với TypeScript
- **Frontend**: Next.js 16 với React 19
- **Database**: PostgreSQL với Drizzle ORM
- **Cache/State**: Redis cho trạng thái game thời gian thực
- **Real-time**: Socket.IO cho WebSocket communication
- **Chess Engine**: chess.js cho validation, Stockfish WASM cho AI

## Cấu Trúc Dự Án

```
.
├── backend/          # NestJS backend
│   ├── src/
│   │   ├── auth/     # Xác thực JWT
│   │   ├── game/     # Logic game và matchmaking
│   │   ├── tournament/ # Hệ thống giải đấu
│   │   ├── chat/     # Chat trong game
│   │   ├── watch/    # Chế độ xem trận
│   │   ├── user/     # Quản lý người dùng
│   │   ├── ai/       # Tích hợp Stockfish
│   │   ├── redis/    # Redis client và Lua scripts
│   │   └── drizzle/  # Database schema và migrations
│   └── Dockerfile
├── frontend/         # Next.js frontend
│   ├── app/
│   │   ├── (auth)/   # Login/Register pages
│   │   └── (dashboard)/ # Authenticated pages
│   └── Dockerfile
└── docker-compose.yml
```
