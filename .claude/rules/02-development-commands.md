# Các Lệnh Phát Triển

## Backend (NestJS)

```bash
cd backend
npm run start:dev          # Chạy backend ở chế độ watch
npm run build              # Build cho production
npm run start:prod         # Chạy bản build production
npm run lint               # Lint và fix code
npm run test               # Chạy unit tests
npm run test:e2e           # Chạy e2e tests
npm run db:push            # Đẩy Drizzle schema lên database
npm run db:seed            # Seed dữ liệu test vào database
```

## Frontend (Next.js)

```bash
cd frontend
npm run dev                # Chạy dev server (port 3000)
npm run build              # Build cho production
npm run start              # Chạy bản build production
npm run lint               # Lint code
```

## Docker

```bash
docker-compose up          # Khởi động tất cả services (postgres, redis, backend, frontend)
docker-compose up -d       # Khởi động ở chế độ detached
docker-compose down        # Dừng tất cả services
docker-compose logs -f backend  # Theo dõi logs của backend
```

## Workflow Phát Triển Thông Thường

1. Khởi động infrastructure: `docker-compose up postgres redis`
2. Chạy backend: `cd backend && npm run start:dev`
3. Chạy frontend: `cd frontend && npm run dev`
4. Seed dữ liệu test (nếu cần): `cd backend && npm run db:seed`
