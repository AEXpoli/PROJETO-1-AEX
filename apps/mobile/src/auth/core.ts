import type { AuthSession, AuthState, Me, SessionStorage } from './types';

export function createSingleFlight() {
  let running = false;
  return async (action: () => Promise<void>) => {
    if (running) return;
    running = true;
    try { await action(); } finally { running = false; }
  };
}

export function authMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar. Você pode solicitar uma nova mensagem.';
  if (code === 'invalid_credentials') return 'E-mail ou senha não conferem. Confira os dados e tente novamente.';
  if (code === 'weak_password') return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
  if (code === 'same_password') return 'Escolha uma senha diferente da anterior.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Aguarde alguns minutos antes de tentar novamente.';
  if (code === 'otp_expired') return 'Este link ou código expirou. Solicite uma nova mensagem.';
  if (code === 'user_already_exists' || code === 'email_exists') return 'Se você já tem uma conta, entre ou use “Esqueci minha senha”.';
  return 'Não foi possível concluir agora. Confira sua conexão e tente novamente.';
}

export function validateForm(mode: 'login' | 'signup' | 'email' | 'password', values: { name: string; email: string; password: string; confirmation: string }): string | null {
  if (mode === 'signup' && (values.name.trim().length < 1 || [...values.name.trim()].length > 120)) return 'Informe seu nome, com até 120 caracteres.';
  if (mode !== 'password' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return 'Informe um e-mail válido, como nome@exemplo.com.';
  if (mode === 'email') return null;
  if (mode === 'login') return values.password.length ? null : 'Informe sua senha.';
  if (values.password.length < 8) return 'Use uma senha com pelo menos 8 caracteres.';
  if (values.password !== values.confirmation) return 'As senhas precisam ser iguais. Confira a confirmação.';
  return null;
}

export function readPublicConfig(url: string | undefined, key: string | undefined, api: string | undefined) {
  if (!url || !key?.startsWith('sb_publishable_') || !api) throw new Error('Configuração pública ausente.');
  const supabaseUrl = new URL(url);
  const apiUrl = new URL(api);
  if (supabaseUrl.protocol !== 'https:' || !['https:', 'http:'].includes(apiUrl.protocol) ||
    supabaseUrl.username || supabaseUrl.password || apiUrl.username || apiUrl.password ||
    supabaseUrl.search || supabaseUrl.hash || apiUrl.search || apiUrl.hash) throw new Error('Configuração pública inválida.');
  return { url: supabaseUrl.origin, key, api: api.replace(/\/$/, '') };
}

export function parseAuthLink(raw: string, expected: string) {
  const url = new URL(raw);
  const callback = new URL(expected);
  if (url.protocol !== callback.protocol || url.host !== callback.host || url.pathname !== callback.pathname) return null;
  const params = new URLSearchParams(url.hash.slice(1));
  if (params.has('error') || url.searchParams.has('error')) throw new Error('Link inválido ou expirado.');
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (!access || !refresh) throw new Error('Abra o link completo enviado por e-mail ou use o código.');
  return { access_token: access, refresh_token: refresh, recovery: params.get('type') === 'recovery' };
}

function isMe(value: unknown, userId: string): value is Me {
  if (typeof value !== 'object' || value === null || !('profile' in value) || !('organizations' in value)) return false;
  const profile = value.profile;
  if (typeof profile !== 'object' || profile === null || !('id' in profile) || profile.id !== userId ||
    !('display_name' in profile) || typeof profile.display_name !== 'string' || !Array.isArray(value.organizations)) return false;
  return value.organizations.every((org: unknown) => typeof org === 'object' && org !== null && 'id' in org && typeof org.id === 'string' &&
    'name' in org && typeof org.name === 'string' && 'role' in org && (org.role === 'participant' || org.role === 'admin'));
}

export async function checkAccess(api: string, session: AuthSession, transport: typeof fetch = fetch): Promise<AuthState> {
  try {
    const response = await transport(`${api}/me`, { headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(10000) });
    if (response.status === 401) return { status: 'signedOut', message: 'Sua sessão expirou. Entre novamente.' };
    if (response.status === 403) return { status: 'blocked' };
    if (!response.ok) return { status: 'offline' };
    const data: unknown = await response.json();
    if (!isMe(data, session.user.id)) return { status: 'offline' };
    if (!data.organizations.length) return { status: 'blocked' };
    return { status: 'ready', me: data, userId: session.user.id };
  } catch { return { status: 'offline' }; }
}

/** Ignores late profile responses after logout, a new login or a recovery link. */
export function createAccessCoordinator(publish: (state: AuthState) => void, verify: (session: AuthSession) => Promise<AuthState>) {
  let generation = 0;
  return {
    cancel(state: AuthState) { generation++; publish(state); },
    async check(session: AuthSession | null) {
      const current = ++generation;
      if (!session) { publish({ status: 'signedOut' }); return; }
      publish({ status: 'loading' });
      const state = await verify(session);
      if (generation === current) publish(state);
    },
  };
}

/** SecureStore chunks stay below historical per-value limits (including UTF-8). */
export function createChunkedStorage(driver: SessionStorage): SessionStorage {
  let sequence = 0;
  const manifest = async (key: string): Promise<{ tag: string; count: number } | null> => {
    const raw = await driver.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('tag' in value) || typeof value.tag !== 'string' ||
      !/^[0-9-]+$/.test(value.tag) || !('count' in value) || typeof value.count !== 'number' ||
      !Number.isInteger(value.count) || value.count < 1 || value.count > 256) throw new Error('Sessão armazenada inválida.');
    return { tag: value.tag, count: value.count };
  };
  const clear = async (key: string, old: { tag: string; count: number } | null) => {
    if (old) await Promise.all(Array.from({ length: old.count }, (_, i) => driver.removeItem(`${key}.${old.tag}.${i}`)));
  };
  return {
    async getItem(key) {
      const info = await manifest(key);
      if (!info) return null;
      const parts = await Promise.all(Array.from({ length: info.count }, (_, i) => driver.getItem(`${key}.${info.tag}.${i}`)));
      if (parts.some(part => part === null)) throw new Error('Sessão armazenada incompleta.');
      return parts.join('');
    },
    async setItem(key, value) {
      const old = await manifest(key);
      const chars = Array.from(value);
      const parts = Array.from({ length: Math.max(1, Math.ceil(chars.length / 300)) }, (_, i) => chars.slice(i * 300, (i + 1) * 300).join(''));
      if (parts.length > 256) throw new Error('Sessão muito grande.');
      const tag = `${Date.now()}-${++sequence}`;
      await Promise.all(parts.map((part, i) => driver.setItem(`${key}.${tag}.${i}`, part)));
      await driver.setItem(key, JSON.stringify({ tag, count: parts.length }));
      await clear(key, old).catch(() => undefined);
    },
    async removeItem(key) {
      // A corrupt manifest must not prevent removing the session itself.
      const old = await manifest(key).catch(() => null);
      await driver.removeItem(key);
      await clear(key, old);
    },
  };
}
