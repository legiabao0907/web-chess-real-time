import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Cookie Parser (cần cho logout clearCookie) ───────────────────────────
  app.use(cookieParser());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  // 🔥 QUAN TRỌNG: Khi chạy sau Nginx proxy, origin từ browser là domain của bạn.
  //    Phải liệt kê CHÍNH XÁC các origin được phép, không dùng wildcard với credentials.
  const allowedOrigins = [
    // Domain chính HTTPS (qua Nginx)
    'https://chessskyscraper.duckdns.org',
    // Domain HTTP (redirect cũ)
    'http://chessskyscraper.duckdns.org',
    // Truy cập trực tiếp Next.js (development)
    'http://chessskyscraper.duckdns.org:9300',
    // Local development
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (Postman, server-to-server, mobile app)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // 🔥 BẮT BUỘC để cookie được gửi/nhận
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'], // Cho phép browser đọc Set-Cookie header
  });

  // ─── Trust Proxy (quan trọng khi chạy sau Nginx) ──────────────────────────
  // Để NestJS tin tưởng các header từ Nginx (X-Forwarded-For, X-Forwarded-Proto, etc.)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ─── WebSocket adapter (Socket.IO) ────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ─── Global prefix ───────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend đang chạy tại port ${port}`);
  console.log('🎮 Chess WebSocket: ws://0.0.0.0:8080/chess');
}
bootstrap();
