import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Các route chỉ được vào khi ĐÃ đăng nhập
const PROTECTED_PREFIXES = ['/home', '/play', '/live', '/analysis', '/ranks', '/archives', '/settings', '/support'];

// Các route chỉ được vào khi CHƯA đăng nhập (ngược lại nếu đã login thì redirect về /home)
const AUTH_ROUTES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Đọc accessToken từ cookie (được set sau khi login)
  const token = request.cookies.get('accessToken')?.value;
  const isLoggedIn = Boolean(token);

  // Nếu đang truy cập route cần login mà chưa login → redirect về landing /
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Nếu đã login mà vào /login, /register hoặc landing / → redirect về /home
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isLandingPage = pathname === '/';
  if ((isAuthRoute || isLandingPage) && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Chạy middleware trên tất cả các route trừ static files và _next internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|chess-bg.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
