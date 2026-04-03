import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật CORS để Next.js frontend (port 3000) có thể gọi API
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Prefix chung cho tất cả routes
  app.setGlobalPrefix('api');

  await app.listen(8080);
  console.log('🚀 Backend đang chạy tại http://localhost:8080');
}
bootstrap();
