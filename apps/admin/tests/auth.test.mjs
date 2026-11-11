import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { AccessError, authorizeAdmin, authMessage, isSessionCookie, passwordError, validEmail } from '../src/auth/core.ts';
import { createAuthClient } from '../src/auth/ssr.ts';
import { authConfig } from '../src/auth/config.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const me = { profile: { id: USER, display_name: 'Admin fictício' }, organizations: [{ id: A, name: 'Organização A', role: 'admin' }, { id: B, name: 'Organização B', role: 'participant' }] };
const json = (body, status = 200) => Response.json(body, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
const rejected = (operation, kind) => assert.rejects(operation, error => error instanceof AccessError && error.kind === kind);

test('admin válido consulta /me e autorização da organização com Bearer e sem cache', async () => {
  const paths = [];
  const result = await authorizeAdmin('http://api.test', 'access', USER, A, async (url, options) => {
    paths.push(new URL(url).pathname);
    assert.equal(options.headers.Authorization, 'Bearer access');
    assert.equal(options.cache, 'no-store');
    return json(url.endsWith('/me') ? me : { organization_id: A, role: 'admin' });
  });
  assert.equal(result.organization.id, A);
  assert.deepEqual(result.organizations.map(org => org.id), [A]);
  assert.deepEqual(paths, ['/me', `/organizations/${A}/admin-access`]);
});

for (const [name, data] of [
  ['participante', { ...me, organizations: [{ ...me.organizations[0], role: 'participant' }] }],
  ['administrador sem vínculo', { ...me, organizations: [] }],
]) test(`${name} não acessa o painel`, async () => {
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, undefined, async () => json(data)), 'denied');
});

test('organização forjada ou papel válido somente em outra organização é recusado', async () => {
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, B, async () => json(me)), 'denied');
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, '../../other', async () => json(me)), 'denied');
});

test('API pode revogar acesso após /me sem que o cliente libere o painel', async () => {
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, A, async url => url.endsWith('/me') ? json(me) : json({},403)), 'denied');
});

test('sessão expirada, ausência de vínculo e falha de rede falham fechadas', async () => {
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, A, async () => json({},401)), 'session');
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, A, async () => json({},403)), 'denied');
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, A, async () => { throw new Error('offline'); }), 'unavailable');
});

test('não aceita perfil de outro usuário, papel desconhecido ou autorização divergente', async () => {
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, A, async () => json({ ...me, profile: { id: B, display_name: 'Outra pessoa' } })), 'unavailable');
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, A, async () => json({ ...me, organizations: [{ ...me.organizations[0], role: 'owner' }] })), 'unavailable');
  await rejected(() => authorizeAdmin('http://api.test', 'access', USER, A, async url => json(url.endsWith('/me') ? me : { organization_id: B, role: 'admin' })), 'denied');
});

test('validação de formulários e mensagens não refletem erros privados', () => {
  assert.equal(validEmail('admin@example.test'),true); assert.equal(validEmail('admin'),false);
  assert.equal(passwordError('password123','password123'),null);
  assert.ok(passwordError('curta','curta')); assert.ok(passwordError('password123','other'));
  assert.match(authMessage({ code: 'invalid_credentials' }),/inválidos/);
  assert.match(authMessage({ code: 'otp_expired' }),/expirado/);
  assert.doesNotMatch(authMessage({ message: 'secret error' }),/secret/);
});

test('configuração rejeita chave privilegiada e URLs contendo credenciais', () => {
  const original = process.env;
  process.env = { ...original, NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', API_URL: 'http://localhost:3002', ADMIN_SITE_URL: 'http://localhost:3001' };
  try {
    assert.equal(authConfig().site,'http://localhost:3001');
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_invalid'; assert.throws(authConfig);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.ADMIN_SITE_URL = 'https://user:password@example.test'; assert.throws(authConfig);
  } finally { process.env = original; }
});

test('logout identifica todos os chunks de sessão, sem apagar cookies de outras aplicações', () => {
  for (const name of ['aex-admin-auth','aex-admin-auth.0','aex-admin-auth.1','aex-admin-auth-code-verifier']) assert.equal(isSessionCookie(name),true);
  assert.equal(isSessionCookie('aex-admin-auth-other-app'),true);
  assert.equal(isSessionCookie('other-app-auth'),false);
});

test('SDK SSR real: login inválido/válido, cookies HttpOnly, restauração, convite, recuperação PKCE e logout', async () => {
  const originalFetch = globalThis.fetch;
  const jar = new Map();
  const written = [];
  const requests = [];
  const user = { id: USER, email: 'admin@example.test', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: { role: 'admin' }, created_at: '2026-01-01T00:00:00Z' };
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: USER, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.test`;
  const session = { access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user };
  globalThis.fetch = async (input, options) => {
    const url = new URL(input); const body = options.body ? JSON.parse(options.body) : {};
    requests.push({ url, body });
    if (url.pathname.endsWith('/token')) return body.password === 'wrong' ? json({ code: 'invalid_credentials', message: 'private' },400) : json(session);
    if (url.pathname.endsWith('/user')) return json(user);
    if (url.pathname.endsWith('/recover')) return json({});
    if (url.pathname.endsWith('/verify')) return body.token_hash === 'expired' ? json({ code: 'otp_expired', message: 'private' },403) : json(session);
    if (url.pathname.endsWith('/logout')) return new Response(null,{status:204});
    assert.fail(`Unexpected ${url.pathname}`);
  };
  const cookies = {
    getAll: () => [...jar].map(([name,value]) => ({name,value})),
    setAll: values => values.forEach(cookie => { written.push(cookie); if (cookie.options.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name,cookie.value); }),
  };
  try {
    const client = createAuthClient('https://example.supabase.co','sb_publishable_test',cookies);
    const invalid = await client.auth.signInWithPassword({ email:user.email,password:'wrong' });
    assert.equal(invalid.data.session,null); assert.match(authMessage(invalid.error),/inválidos/);
    assert.equal((await client.auth.signInWithPassword({email:user.email,password:'example-password'})).error,null);
    assert.ok(written.length > 0);
    for (const cookie of written) { assert.equal(cookie.options.httpOnly,true); assert.equal(cookie.options.sameSite,'lax'); }
    assert.ok([...jar.values()].every(value => !value.includes('example-password')));
    const restored = createAuthClient('https://example.supabase.co','sb_publishable_test',cookies);
    assert.equal((await restored.auth.getUser()).data.user.id, USER);
    assert.equal((await restored.auth.getSession()).data.session.access_token,token);
    assert.match(authMessage((await restored.auth.verifyOtp({token_hash:'expired',type:'invite'})).error),/expirado/);
    assert.equal((await restored.auth.verifyOtp({token_hash:'valid',type:'invite'})).error,null);
    assert.equal((await restored.auth.resetPasswordForEmail(user.email,{redirectTo:'http://localhost:3001/auth/callback'})).error,null);
    const recover = requests.find(call => call.url.pathname.endsWith('/recover'));
    assert.ok(recover.body.code_challenge); assert.equal(recover.body.code_challenge_method,'s256');
    assert.equal(recover.url.searchParams.get('redirect_to'),'http://localhost:3001/auth/callback');
    assert.equal((await restored.auth.exchangeCodeForSession('recovery-code')).error,null);
    assert.ok(requests.some(call => call.url.searchParams.get('grant_type') === 'pkce' && call.body.auth_code === 'recovery-code' && call.body.code_verifier));
    assert.equal((await restored.auth.updateUser({password:'new-password'})).error,null);
    assert.equal((await restored.auth.signOut({scope:'local'})).error,null);
    assert.equal((await restored.auth.getSession()).data.session,null);
    assert.ok(![...jar.keys()].some(isSessionCookie));
  } finally { globalThis.fetch = originalFetch; }
});
