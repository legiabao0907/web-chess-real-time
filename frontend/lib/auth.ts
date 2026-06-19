import { apiFetch } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  eloBlitz: number;
  eloRapid: number;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  identifier: string; // email hoặc username
  password: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    skipAuth: true,
  });
}

// ─── Token Management ─────────────────────────────────────────────────────────

/** Lưu tokens vào localStorage sau khi đăng nhập / đăng ký thành công */
export function saveTokens(tokens: AuthTokens): void {
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}

/**
 * Lưu tokens vào httpOnly cookie thông qua Next.js route handler.
 * Middleware sẽ đọc cookie này để bảo vệ route dashboard.
 *
 * 🔥 QUAN TRỌNG: Khi chạy sau Nginx reverse proxy, Nginx thường route tất cả
 *    /api/* sang NestJS backend. Nếu vậy, Next.js route handler này sẽ KHÔNG
 *    được gọi. Đó là lý do NestJS auth controller đã được sửa để TỰ set cookie
 *    trong response login/register — cookie sẽ đến từ NestJS thay vì Next.js.
 *
 *    Hàm này vẫn được gọi như một fallback an toàn (khi truy cập trực tiếp
 *    không qua Nginx). Nếu thất bại, login vẫn hoạt động nhờ NestJS cookie.
 */
export async function persistCookies(tokens: AuthTokens): Promise<void> {
  try {
    const res = await fetch('/api/auth/set-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens),
    });
    if (!res.ok) {
      console.warn(
        '⚠️ set-cookie route returned non-OK (likely Nginx routing /api to NestJS). ' +
        'Cookies should already be set by NestJS auth response.'
      );
    }
  } catch (err) {
    // Không throw — đây là fallback, cookie chính đã được NestJS set
    console.warn(
      '⚠️ Could not reach /api/auth/set-cookie (likely proxied to NestJS by Nginx). ' +
      'Cookies from NestJS auth response should already be in place.',
      (err as Error).message
    );
  }
}

/** Xoá cookie khi logout */
export async function clearCookies(): Promise<void> {
  await fetch('/api/auth/set-cookie', { method: 'DELETE' });
}

/** Lấy accessToken từ localStorage */
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

/** Lấy refreshToken từ localStorage */
export function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

/** Xoá tokens (logout) */
export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('authUser');
}

/** Lưu thông tin user vào localStorage */
export function saveUser(user: AuthUser): void {
  localStorage.setItem('authUser', JSON.stringify(user));
}

/** Lấy thông tin user từ localStorage */
export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('authUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
