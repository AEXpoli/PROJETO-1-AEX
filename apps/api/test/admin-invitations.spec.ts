import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';

const USER = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const INV = '44444444-4444-4444-8444-444444444444';

describe('Admin invitation HTTP endpoints with real authentication guards', () => {
  let app: INestApplication<Server>;
  const originalEnv = process.env;
  let role: string;
  let authStatus: number;
  let acceptCode: string;
  let emailFails: boolean;
  let calls: { path: string; body: Record<string, unknown> }[];
  beforeAll(async () => {
    process.env = { ...originalEnv, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only', ADMIN_SITE_URL: 'http://localhost:3001' };
    const module = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    app = module.createNestApplication<INestApplication<Server>>(); await app.init();
  });
  afterAll(async () => { await app.close(); process.env = originalEnv; });
  beforeEach(() => {
    role = 'admin'; authStatus = 200; acceptCode = ''; emailFails = false; calls = [];
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
      calls.push({ path: url.pathname, body });
      if (url.pathname === '/auth/v1/user') return Promise.resolve(Response.json(authStatus === 200 ? { id: USER, aud: 'authenticated', role: 'authenticated', user_metadata: { role: 'admin' } } : { message: 'invalid' }, { status: authStatus }));
      if (url.pathname.endsWith('/organization_members')) return Promise.resolve(Response.json(url.searchParams.get('organization_id') === `eq.${B}` || role === 'none' ? [] : [{ user_id: USER, organization_id: A, role }]));
      if (url.pathname.endsWith('/aex_create_admin_invitation')) return Promise.resolve(Response.json({ id: INV, expires_at: '2026-11-12T12:00:00Z' }));
      if (url.pathname.endsWith('/invite')) return Promise.resolve(Response.json(emailFails ? { message: 'private email error' } : { id: TARGET, email: 'invite@example.test' }, { status: emailFails ? 400 : 200 }));
      if (url.pathname.endsWith('/aex_admin_invitation_delivery')) return Promise.resolve(new Response(null, { status: 204 }));
      if (url.pathname.endsWith('/aex_accept_admin_invitation')) return Promise.resolve(Response.json(acceptCode ? { code: acceptCode, message: 'private SQL error' } : { organization_id: A, status: 'accepted' }, { status: acceptCode ? 400 : 200 }));
      throw new Error('Unexpected HTTP path');
    });
  });
  afterEach(() => jest.restoreAllMocks());
  const issue = (org = A, extra = {}) => request(app.getHttpServer()).post(`/organizations/${org}/admin-invitations`).auth('test-token', { type: 'bearer' }).send({ email: 'invite@example.test', display_name: 'Teste', ...extra });

  it('requires token before issuing/accepting', async () => {
    await request(app.getHttpServer()).post(`/organizations/${A}/admin-invitations`).send({}).expect(401);
    await request(app.getHttpServer()).post(`/admin-invitations/${INV}/accept`).expect(401);
    expect(calls).toHaveLength(0);
  });
  it('rejects an expired token', async () => { authStatus = 401; await issue().expect(401); expect(calls).toHaveLength(1); });
  it.each(['participant','none'])('rejects role %s before invitation writes', async value => {
    role = value; await issue().expect(403); expect(calls.some(call => call.path.includes('/rpc/'))).toBe(false);
  });
  it('rejects another organization even for an administrator', async () => { await issue(B).expect(403); });
  it('rejects a role sent by the frontend', async () => { await issue(A, { role: 'admin' }).expect(400); expect(calls.some(call => call.path.includes('/invite'))).toBe(false); });
  it('sends invitation only after verifying issuer and uses configured callback', async () => {
    await issue().expect(201);
    expect(calls.find(call => call.path.endsWith('aex_create_admin_invitation'))?.body.p_issuer).toBe(USER);
    expect(calls.find(call => call.path.endsWith('/invite'))?.body.data).toEqual({ display_name: 'Teste' });
    expect(calls.find(call => call.path.endsWith('aex_admin_invitation_delivery'))?.body.p_target).toBe(TARGET);
  });
  it('failed delivery is marked unusable and returns sanitized error', async () => {
    emailFails = true; const result = await issue().expect(503);
    expect(calls.find(call => call.path.endsWith('aex_admin_invitation_delivery'))?.body.p_target).toBeNull();
    expect(result.text).not.toContain('private');
  });
  it('acceptance derives user from token, ignoring supplied role/user/org', async () => {
    await request(app.getHttpServer()).post(`/admin-invitations/${INV}/accept`).auth('test-token', { type: 'bearer' }).send({ user_id: TARGET, role: 'admin', organization_id: B }).expect(201);
    expect(calls.find(call => call.path.endsWith('aex_accept_admin_invitation'))?.body).toEqual({ p_user: USER, p_invitation: INV });
  });
  it.each([['22023',400],['42501',403]])('maps invalid or unauthorized invitation %s', async (code, status) => {
    acceptCode = String(code);
    const result = await request(app.getHttpServer()).post(`/admin-invitations/${INV}/accept`).auth('test-token', { type: 'bearer' }).expect(Number(status));
    expect(result.text).not.toContain('private');
  });
  it('API independently protects admin-access', async () => {
    await request(app.getHttpServer()).get(`/organizations/${A}/admin-access`).auth('test-token', { type: 'bearer' }).expect(200);
    role = 'participant';
    await request(app.getHttpServer()).get(`/organizations/${A}/admin-access`).auth('test-token', { type: 'bearer' }).expect(403);
  });
});
