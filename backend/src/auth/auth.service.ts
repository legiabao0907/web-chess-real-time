import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema/schema';
import { users } from '../drizzle/schema/users.schema';
import { eq, or } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Tạo cặp Access + Refresh Token ───────────────────────────────────────
  private async generateTokens(userId: string, username: string, email: string) {
    const payload = { sub: userId, username, email };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'access-secret';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'refresh-secret';
    const accessExpiresIn = (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshExpiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`;

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  // ─── Đăng ký ──────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const { username, email, password } = dto;

    // Kiểm tra username hoặc email đã tồn tại chưa
    const existing = await this.db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    if (existing.length > 0) {
      const conflict = existing[0];
      if (conflict.email === email) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw new ConflictException('Username đã được sử dụng');
    }

    // Hash password với bcrypt (cost factor 12)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Tạo user mới
    const [newUser] = await this.db
      .insert(users)
      .values({ username, email, passwordHash })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        eloBlitz: users.eloBlitz,
        eloRapid: users.eloRapid,
        createdAt: users.createdAt,
      });

    const tokens = await this.generateTokens(newUser.id, newUser.username, newUser.email);

    return {
      user: newUser,
      ...tokens,
    };
  }

  // ─── Đăng nhập ────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const { identifier, password } = dto;

    // Tìm user theo email hoặc username
    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    // So sánh password với hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Sai mật khẩu');
    }

    const tokens = await this.generateTokens(user.id, user.username, user.email);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        eloBlitz: user.eloBlitz,
        eloRapid: user.eloRapid,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  // ─── Làm mới Access Token bằng Refresh Token ──────────────────────────────
  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException('User không tồn tại');
      }

      return this.generateTokens(user.id, user.username, user.email);
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }
}
