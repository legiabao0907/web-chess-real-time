# Biến Môi Trường

## Backend Environment Variables

Xem [docker-compose.yml](docker-compose.yml) để tham khảo các giá trị mặc định.

### Database
- `DATABASE_URL`: Chuỗi kết nối PostgreSQL
  - Format: `postgres://user:password@host:port/database`
  - Example: `postgres://postgres:admin@postgres:5432/testnest`

### Redis
- `REDIS_HOST`: Hostname của Redis server (default: `redis`)
- `REDIS_PORT`: Port của Redis (default: `6379`)
- `REDIS_PASSWORD`: Password để kết nối Redis

### JWT Authentication
- `JWT_ACCESS_SECRET`: Secret key để ký access tokens
- `JWT_REFRESH_SECRET`: Secret key để ký refresh tokens
- `JWT_ACCESS_EXPIRES_IN`: Thời gian hết hạn access token (default: `15m`)
- `JWT_REFRESH_EXPIRES_IN`: Thời gian hết hạn refresh token (default: `7d`)

### CORS & Server
- `FRONTEND_URL`: URL của frontend để cấu hình CORS (default: `http://localhost:3000`)
- `PORT`: Port mà backend server lắng nghe (default: `8080`)

## Frontend Environment Variables

### API Endpoints
- `NEXT_PUBLIC_API_URL`: URL của backend API
  - Example: `http://localhost:8080/api`
  - Dùng cho HTTP requests
- `NEXT_PUBLIC_BACKEND_URL`: URL của backend WebSocket
  - Example: `http://localhost:8080`
  - Dùng cho Socket.IO connection

## Development vs Production

### Development
- Sử dụng `localhost` cho các URLs
- Secrets có thể dùng giá trị mặc định
- Debug mode enabled

### Production
- **Phải thay đổi** tất cả secrets (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, REDIS_PASSWORD)
- Sử dụng domain names thực tế
- Enable HTTPS
- Cấu hình CORS chặt chẽ
