import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { authMessage, checkAccess, createAccessCoordinator, createChunkedStorage, createSingleFlight, parseAuthLink, readPublicConfig, validateForm } from '../src/auth/core.ts';
import { createNativeClient } from '../src/auth/runtime.js';
import { createProgressStorage } from '../src/services/progressStorage.web.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const session = { access_token: 'test-access', refresh_token: 'test-refresh', user: { id: userId } };
const me = { profile: { id: userId, display_name: 'Pessoa de teste' }, organizations: [{ id: 'org-a', name: 'Instituição fictícia', role: 'participant' }] };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
function memory() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
}

test('cadastro valida nome, e-mail, tamanho e confirmação sem exigir senha nova no login', () => {
  const form = { name: 'Ana', email: 'ana@example.test', password: 'exemplo-123', confirmation: 'exemplo-123' };
  assert.equal(validateForm('signup', form), null);
  for (const change of [{ name: '' }, { email: 'inválido' }, { password: 'curta' }, { confirmation: 'diferente' }]) {
    assert.equal(typeof validateForm('signup', { ...form, ...change }), 'string');
  }
  assert.equal(validateForm('login', { ...form, password: 'antiga' }), null);
  assert.equal(validateForm('password', { ...form, email: '' }), null);
});

test('configuração aceita apenas chave publishable e URLs sem credenciais', () => {
  assert.equal(readPublicConfig('https://example.supabase.co', 'sb_publishable_test', 'http://192.168.1.10:3002/').api, 'http://192.168.1.10:3002');
  for (const key of [undefined, '', 'sb_secret_test', 'service_role', 'eyJlegacy']) {
    assert.throws(() => readPublicConfig('https://example.supabase.co', key, 'http://localhost:3002'));
  }
  assert.throws(() => readPublicConfig('http://example.supabase.co', 'sb_publishable_test', 'http://localhost:3002'));
  assert.throws(() => readPublicConfig('https://example.supabase.co', 'sb_publishable_test', 'https://user:password@example.test'));
});

test('mensagens traduzem conta não confirmada, credenciais e links expirados sem refletir texto remoto', () => {
  assert.match(authMessage({ code: 'email_not_confirmed' }), /Confirme/);
  assert.match(authMessage({ code: 'invalid_credentials' }), /não conferem/);
  assert.match(authMessage({ code: 'otp_expired' }), /expirou/);
  assert.doesNotMatch(authMessage({ message: 'token secreto' }), /token secreto/);
});

test('callback valida destino exato, fragmento e recuperação em Expo Go e app instalado', () => {
  for (const callback of ['exp://192.168.1.10:8081/--/auth/callback', 'aex://auth/callback']) {
    assert.deepEqual(parseAuthLink(`${callback}#access_token=a&refresh_token=r&type=recovery`, callback), { access_token: 'a', refresh_token: 'r', recovery: true });
    assert.equal(parseAuthLink(`${callback}#access_token=a&refresh_token=r&type=signup`, callback).recovery, false);
    assert.throws(() => parseAuthLink(`${callback}?error=access_denied`, callback));
    assert.throws(() => parseAuthLink(`${callback}#access_token=a`, callback));
    assert.equal(parseAuthLink(`${callback}/extra#access_token=a&refresh_token=r`, callback), null);
  }
  assert.equal(parseAuthLink('https://other.test/auth/callback#access_token=a&refresh_token=r', 'aex://auth/callback'), null);
});

test('GET /me recebe Bearer; identidade e organizações vêm da API', async () => {
  const result = await checkAccess('http://api.test', session, async (url, options) => {
    assert.equal(url, 'http://api.test/me');
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    return response(me);
  });
  assert.deepEqual(result, { status: 'ready', userId, me });
});

for (const [name, transport, expected] of [
  ['token expirado', async () => response({}, 401), 'signedOut'],
  ['perfil não provisionado', async () => response({}, 403), 'blocked'],
  ['sem organização', async () => response({ ...me, organizations: [] }), 'blocked'],
  ['resposta de outro usuário', async () => response({ ...me, profile: { ...me.profile, id: 'other-user' } }), 'offline'],
  ['papel desconhecido', async () => response({ ...me, organizations: [{ ...me.organizations[0], role: 'owner' }] }), 'offline'],
  ['JSON inválido', async () => new Response('not-json'), 'offline'],
  ['serviço indisponível', async () => response({}, 503), 'offline'],
  ['falha de rede', async () => { throw new Error('offline'); }, 'offline'],
]) {
  test(`acesso fica protegido: ${name}`, async () => {
    assert.equal((await checkAccess('http://api.test', session, transport)).status, expected);
  });
}

test('sem sessão não consulta API nem libera rotas', async () => {
  const states = [];
  const access = createAccessCoordinator(state => states.push(state), () => assert.fail('Não deve consultar /me'));
  await access.check(null);
  assert.deepEqual(states, [{ status: 'signedOut' }]);
});

test('resposta atrasada de /me não reabre acesso depois de logout ou recuperação', async () => {
  for (const status of ['signedOut', 'recovery']) {
    const states = [];
    let finish;
    const access = createAccessCoordinator(state => states.push(state), () => new Promise(resolve => { finish = resolve; }));
    const pending = access.check(session);
    access.cancel({ status });
    finish({ status: 'ready', userId, me });
    await pending;
    assert.equal(states.at(-1).status, status);
  }
});

test('troca de conta descarta autorização pendente da conta anterior', async () => {
  const states = [];
  let finish;
  const access = createAccessCoordinator(state => states.push(state), value => value.user.id === userId
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ status: 'blocked' }));
  const pending = access.check(session);
  await access.check({ ...session, user: { id: 'other' } });
  finish({ status: 'ready', userId, me });
  await pending;
  assert.equal(states.at(-1).status, 'blocked');
});

test('toques repetidos não enviam duas ações e falha permite tentar novamente', async () => {
  const single = createSingleFlight();
  let finish;
  const pending = single(() => new Promise(resolve => { finish = resolve; }));
  await single(() => assert.fail('Ação duplicada'));
  finish(); await pending;
  await assert.rejects(single(async () => { throw new Error('offline'); }));
  let retried = false;
  await single(async () => { retried = true; });
  assert.equal(retried, true);
});

test('sessão grande e Unicode persistem sem superar 2 KB por entrada segura', async () => {
  const driver = memory();
  const storage = createChunkedStorage(driver);
  const value = JSON.stringify({ token: 'a'.repeat(4000), name: '😀'.repeat(700) });
  await storage.setItem('auth', value);
  assert.equal(await createChunkedStorage(driver).getItem('auth'), value);
  for (const part of driver.values.values()) assert.ok(Buffer.byteLength(part, 'utf8') < 2048);
  await storage.setItem('auth', 'nova sessão');
  assert.equal(driver.values.size, 2);
  await storage.removeItem('auth');
  assert.equal(driver.values.size, 0);
});

test('gravação interrompida preserva sessão anterior; leitura incompleta falha fechada', async () => {
  const driver = memory();
  const storage = createChunkedStorage(driver);
  await storage.setItem('auth', 'anterior');
  const setItem = driver.setItem;
  driver.setItem = async (key, value) => { if (value === 'nova') throw new Error('disk'); await setItem(key, value); };
  await assert.rejects(storage.setItem('auth', 'nova'));
  assert.equal(await storage.getItem('auth'), 'anterior');
  const manifest = JSON.parse(driver.values.get('auth'));
  driver.values.delete(`auth.${manifest.tag}.0`);
  await assert.rejects(storage.getItem('auth'));
  driver.values.set('auth', 'invalid-json');
  await storage.removeItem('auth');
  assert.equal(await storage.getItem('auth'), null);
});

test('progresso demonstrativo não é compartilhado ao trocar participante', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['aex-training-v1', 'legado sem proprietário']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  try {
    const first = createProgressStorage(userId);
    const second = createProgressStorage('22222222-2222-4222-8222-222222222222');
    assert.equal(await first.read(), null);
    await first.write('histórico A');
    assert.equal(await second.read(), null);
    await second.write('histórico B');
    assert.equal(await first.read(), 'histórico A');
    assert.equal(await second.read(), 'histórico B');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('SDK oficial: cadastro, login, restauração, e-mail, OTP, nova senha e logout com HTTP simulado', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const user = { id: userId, email: 'ana@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
  const authResponse = { access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user };
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    const body = options?.body ? JSON.parse(options.body) : null;
    calls.push({ url, body, method: options?.method });
    if (url.pathname.endsWith('/signup')) return response({ user, session: null });
    if (url.pathname.endsWith('/token') && body.password === 'wrong-password') return response({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 400);
    if (url.pathname.endsWith('/token') || url.pathname.endsWith('/verify')) return response(authResponse);
    if (url.pathname.endsWith('/user')) return response(user);
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
    if (url.pathname.endsWith('/recover') || url.pathname.endsWith('/resend')) return response({});
    assert.fail(`HTTP inesperado: ${url.pathname}`);
  };
  const driver = memory();
  const storage = createChunkedStorage(driver);
  const client = createNativeClient('https://example.supabase.co', 'sb_publishable_test', storage);
  let restored;
  try {
    const redirectTo = 'aex://auth/callback';
    await client.auth.getSession();
    const signup = await client.auth.signUp({ email: user.email, password: 'test-password', options: { data: { display_name: 'Ana' }, emailRedirectTo: redirectTo } });
    assert.equal(signup.error, null);
    assert.equal(signup.data.session, null);
    assert.deepEqual(calls.find(call => call.url.pathname.endsWith('/signup')).body.data, { display_name: 'Ana' });
    assert.equal(calls[0].url.searchParams.get('redirect_to'), redirectTo);
    const invalid = await client.auth.signInWithPassword({ email: user.email, password: 'wrong-password' });
    assert.equal(invalid.data.session, null);
    assert.match(authMessage(invalid.error), /não conferem/);
    const login = await client.auth.signInWithPassword({ email: user.email, password: 'test-password' });
    assert.equal(login.error, null);
    assert.equal(login.data.session.user.id, userId);
    assert.ok([...driver.values.values()].every(value => !value.includes('test-password')));
    client.auth.stopAutoRefresh();
    const expired = JSON.parse(await storage.getItem('aex-auth-v1'));
    expired.expires_at = Math.floor(Date.now() / 1000) - 60;
    await storage.setItem('aex-auth-v1', JSON.stringify(expired));
    restored = createNativeClient('https://example.supabase.co', 'sb_publishable_test', storage);
    assert.equal((await restored.auth.getSession()).data.session.access_token, jwt);
    assert.ok(calls.some(call => call.url.searchParams.get('grant_type') === 'refresh_token' && call.body.refresh_token === 'test-refresh'));
    assert.equal((await restored.auth.resend({ type: 'signup', email: user.email, options: { emailRedirectTo: redirectTo } })).error, null);
    assert.equal((await restored.auth.resetPasswordForEmail(user.email, { redirectTo })).error, null);
    assert.equal(calls.find(call => call.url.pathname.endsWith('/recover')).url.searchParams.get('redirect_to'), redirectTo);
    assert.equal((await restored.auth.verifyOtp({ email: user.email, token: '12345678', type: 'recovery' })).error, null);
    assert.equal((await restored.auth.updateUser({ password: 'new-password' })).error, null);
    assert.ok([...driver.values.values()].every(value => !value.includes('new-password')));
    assert.equal((await restored.auth.signOut({ scope: 'local' })).error, null);
    assert.equal((await restored.auth.getSession()).data.session, null);
    assert.equal(await storage.getItem('aex-auth-v1'), null);
  } finally {
    client.auth.stopAutoRefresh(); restored?.auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
  }
});
