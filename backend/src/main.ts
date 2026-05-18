import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật CORS để Next.js frontend (port 3000) có thể gọi API
  app.enableCors({
    origin: true, // Cho phép mọi origin (localhost, IP) gọi API
    credentials: true,
  });

  // Bật WebSocket adapter (Socket.IO)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Prefix chung cho tất cả routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend đang chạy tại port ${port}`);
  console.log('🎮 Chess WebSocket: ws://0.0.0.0:8080/chess');
}
bootstrap();
