import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfig } from './config';
import { createAuthClient } from './ssr';
import { AccessError, authorizeAdmin } from './core';

export async function serverClient() {
  const config = authConfig();
  const jar = await cookies();
  return createAuthClient(config.url, config.key, {
    getAll: () => jar.getAll(),
    setAll(values) {
      try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
      catch { /* Server Components are read-only; proxy persists refreshed cookies. */ }
    },
  });
}

export async function identity() {
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new AccessError(error && error.status && error.status >= 500 ? 'unavailable' : 'session');
  // getSession supplies only the bearer; identity comes from getUser and NestJS.
  const session = await client.auth.getSession();
  if (session.error || !session.data.session) throw new AccessError('session');
  return { client, userId: data.user.id, token: session.data.session.access_token };
}

export const requireAdmin = cache(async () => {
  let result;
  try {
    const session = await identity();
    const selected = (await cookies()).get('aex-admin-organization')?.value;
    result = { ...await authorizeAdmin(authConfig().api, session.token, session.userId, selected), token: session.token };
  } catch (error) {
    if (error instanceof AccessError && error.kind === 'session') redirect('/login?reason=session');
    if (error instanceof AccessError && error.kind === 'denied') redirect('/acesso-nao-autorizado');
    redirect('/acesso-nao-autorizado?reason=unavailable');
  }
  return result;
});
