import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [
    DrizzleModule,
    PassportModule,
    // JwtModule được cấu hình động trong AuthService (signAsync với secret riêng)
    // Nên ở đây chỉ cần register không cần options mặc định
    JwtModule.register({}),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
