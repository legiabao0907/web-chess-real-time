const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

/**
 * Gọi API backend với base URL tự động.
 * Tự gắn Authorization header nếu có accessToken lưu trong localStorage.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipAuth = false, headers = {}, ...rest } = options;

  const authHeaders: Record<string, string> = {};
  if (!skipAuth && typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(headers as Record<string, string>),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.message ??
      (Array.isArray(data?.message) ? data.message.join(', ') : 'Lỗi không xác định');
    throw new Error(message);
  }

  return data as T;
}
