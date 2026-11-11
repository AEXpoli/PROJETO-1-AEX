import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '../../../auth/config';
import { createAuthClient } from '../../../auth/ssr';
export async function GET(request: NextRequest) {
  const config = authConfig();
  const response = NextResponse.redirect(new URL('/redefinir-senha', config.site));
  response.headers.set('Cache-Control', 'private, no-store');
  const client = createAuthClient(config.url, config.key, {
    getAll: () => request.cookies.getAll(),
    setAll(values, cacheHeaders) {
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
    },
  });
  const code = request.nextUrl.searchParams.get('code');
  try {
    if (!code || request.nextUrl.searchParams.has('error')) throw new Error();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error();
  } catch { response.headers.set('Location', new URL('/auth/erro', config.site).toString()); }
  return response;
}
