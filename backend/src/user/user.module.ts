import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    DrizzleModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [UserService, JwtAuthGuard],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
