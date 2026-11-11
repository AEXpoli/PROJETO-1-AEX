import { NextResponse, type NextRequest } from 'next/server';
import { createAuthClient } from './auth/ssr';
import { authConfig } from './auth/config';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    const config = authConfig();
    const client = createAuthClient(config.url, config.key, {
      getAll: () => request.cookies.getAll(),
      setAll(values, cacheHeaders) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
      },
    });
    await client.auth.getClaims();
  } catch { /* Authorization fails closed in the server data layer, not only in proxy. */ }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
