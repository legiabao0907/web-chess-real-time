import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    // 🔥 VẪN trả về tokens trong body để frontend lưu localStorage
    //    (httpOnly cookie không đọc được bằng JS, cần token cho Authorization header)
    return result;
  }

  // POST /auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    // 🔥 VẪN trả về tokens trong body để frontend lưu localStorage
    return result;
  }

  // POST /auth/refresh
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result; // trả về { accessToken, refreshToken }
  }

  // POST /auth/logout
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return { ok: true };
  }

  // ─── Helper: set httpOnly cookies ─────────────────────────────────────
  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    // Dùng chung config cho cả 2 cookie
    const cookieConfig = {
      httpOnly: true,
      secure: true,            // 🔥 true vì đã có HTTPS (SSL)
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie('accessToken', accessToken, {
      ...cookieConfig,
      maxAge: 15 * 60 * 1000, // 15 phút
    });

    res.cookie('refreshToken', refreshToken, {
      ...cookieConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });
  }
}
