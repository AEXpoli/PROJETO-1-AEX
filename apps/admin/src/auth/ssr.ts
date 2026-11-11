import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
export const cookieOptions = { name: 'aex-admin-auth', path: '/', httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' };

// No browser Supabase client: credentials and refresh tokens stay in HttpOnly cookies.
export function createAuthClient(url: string, key: string, cookies: CookieMethodsServer) {
  return createServerClient(url, key, { cookieOptions, cookies, global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) }),
  } });
}
