import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/set-cookie
 * Body: { accessToken: string, refreshToken: string }
 * Được gọi từ client sau khi login/register thành công,
 * để lưu token vào httpOnly cookie để middleware có thể đọc.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.accessToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });

  // accessToken cookie — đọc bởi middleware để bảo vệ route
  response.cookies.set('accessToken', body.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 phút (khớp với JWT_ACCESS_EXPIRES_IN)
    path: '/',
  });

  // refreshToken cookie — để dùng sau khi accessToken hết hạn
  if (body.refreshToken) {
    response.cookies.set('refreshToken', body.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
      path: '/',
    });
  }

  return response;
}

/**
 * DELETE /api/auth/set-cookie
 * Xoá cookie khi logout
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('accessToken');
  response.cookies.delete('refreshToken');
  return response;
}
