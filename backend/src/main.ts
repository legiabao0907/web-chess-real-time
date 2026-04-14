import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật CORS để Next.js frontend (port 3000) có thể gọi API
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Bật WebSocket adapter (Socket.IO)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Prefix chung cho tất cả routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`🚀 Backend đang chạy tại port ${port}`);
  console.log('🎮 Chess WebSocket: ws://localhost:8080/chess');
}
bootstrap();
