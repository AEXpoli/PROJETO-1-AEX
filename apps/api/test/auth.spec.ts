import { Controller, Get, Req } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/auth/auth.module';
import { RequireOrganization } from '../src/auth/auth.decorators';
import type { AuthenticatedRequest, Membership } from '../src/auth/auth.types';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// Fixtures exercise reusable guards without publishing business endpoints in production.
@Controller('test/organizations/:organizationId')
class ProtectedFixture {
  @Get('admin')
  @RequireOrganization('admin')
  admin(@Req() req: AuthenticatedRequest) {
    return req.membership;
  }

  @Get('member')
  @RequireOrganization('admin', 'participant')
  member(@Req() req: AuthenticatedRequest) {
    return req.membership;
  }
}

describe('Authentication and organization authorization (HTTP + real SDK)', () => {
  let app: INestApplication<Server>;
  const originalEnv = process.env;
  let calls: URL[];
  let members: Membership[];
  let authStatus: number;
  let dbStatus: number;
  let anonymous: boolean;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test_only',
    };
    const module = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [ProtectedFixture],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    process.env = originalEnv;
  });
  beforeEach(() => {
    calls = [];
    authStatus = 200;
    dbStatus = 200;
    anonymous = false;
    members = [
      { user_id: USER, organization_id: A, role: 'admin' },
      { user_id: USER, organization_id: B, role: 'participant' },
      { user_id: OTHER, organization_id: C, role: 'admin' },
    ];
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push(url);
      if (url.pathname === '/auth/v1/user') {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer access-token');
        return Promise.resolve(
          Response.json(
            authStatus === 200
              ? {
                  id: USER,
                  is_anonymous: anonymous,
                  aud: 'authenticated',
                  role: 'authenticated',
                  user_metadata: { role: 'admin', organization_id: C },
                  app_metadata: { role: 'admin' },
                }
              : { msg: 'private upstream auth message' },
            { status: authStatus },
          ),
        );
      }
      // The shared service must retain its backend credential after getUser(token).
      expect(new Headers(init?.headers).get('apikey')).toBe('sb_secret_test_only');
      expect(new Headers(init?.headers).get('authorization')).not.toBe('Bearer access-token');
      if (dbStatus !== 200)
        return Promise.resolve(
          Response.json({ message: 'private SQL detail' }, { status: dbStatus }),
        );
      if (url.pathname.endsWith('/organization_members')) {
        const userId = url.searchParams.get('user_id')?.replace('eq.', '');
        const organizationId = url.searchParams.get('organization_id')?.replace('eq.', '');
        return Promise.resolve(
          Response.json(
            members.filter(
              (m) =>
                m.user_id === userId && (!organizationId || m.organization_id === organizationId),
            ),
          ),
        );
      }
      if (url.pathname.endsWith('/profiles')) {
        expect(url.searchParams.get('id')).toBe(`eq.${USER}`);
        return Promise.resolve(Response.json([{ id: USER, display_name: 'Pessoa de teste' }]));
      }
      if (url.pathname.endsWith('/organizations')) {
        expect(url.searchParams.get('id')).toBe(`in.(${A},${B})`);
        return Promise.resolve(
          Response.json([
            { id: A, name: 'A' },
            { id: B, name: 'B' },
          ]),
        );
      }
      throw new Error('Unexpected request');
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([undefined, 'Basic access-token', 'Bearer', 'Bearer one two', 'Bearer one,two'])(
    'rejects missing or malformed token: %s',
    async (header) => {
      const req = request(app.getHttpServer()).get('/me');
      if (header) req.set('Authorization', header);
      await req.expect(401);
      expect(calls).toHaveLength(0);
    },
  );
  it.each([401, 403])(
    'rejects invalid/expired/project-mismatched token (%s) before DB reads',
    async (status) => {
      authStatus = status;
      const response = await request(app.getHttpServer())
        .get('/me')
        .auth('access-token', { type: 'bearer' })
        .expect(401);
      expect(calls.map((url) => url.pathname)).toEqual(['/auth/v1/user']);
      expect(response.text).not.toContain('private');
    },
  );
  it('fails closed if Auth is unavailable', async () => {
    authStatus = 503;
    await request(app.getHttpServer())
      .get('/me')
      .auth('access-token', { type: 'bearer' })
      .expect(503);
    expect(calls).toHaveLength(1);
  });
  it('rejects anonymous Auth users', async () => {
    anonymous = true;
    await request(app.getHttpServer())
      .get('/me')
      .auth('access-token', { type: 'bearer' })
      .expect(401);
    expect(calls).toHaveLength(1);
  });
  it('rejects a user without membership before profile or organization reads', async () => {
    members = [];
    await request(app.getHttpServer())
      .get('/me')
      .auth('access-token', { type: 'bearer' })
      .expect(403);
    expect(calls.map((url) => url.pathname)).toEqual([
      '/auth/v1/user',
      '/rest/v1/organization_members',
    ]);
  });
  it('blocks participant escalation despite frontend headers and editable metadata', async () => {
    await request(app.getHttpServer())
      .get(`/test/organizations/${B}/admin?role=admin&organizationId=${A}`)
      .auth('access-token', { type: 'bearer' })
      .set('x-role', 'admin')
      .set('x-organization-id', A)
      .expect(403);
  });
  it('blocks an administrator from another organization', async () => {
    await request(app.getHttpServer())
      .get(`/test/organizations/${C}/admin`)
      .auth('access-token', { type: 'bearer' })
      .expect(403);
    expect(calls[1]?.searchParams.get('organization_id')).toBe(`eq.${C}`);
    expect(calls[1]?.searchParams.get('user_id')).toBe(`eq.${USER}`);
  });
  it.each([
    [A, 'admin'],
    [B, 'member'],
  ])('allows a valid organization role (%s/%s)', async (org, route) => {
    await request(app.getHttpServer())
      .get(`/test/organizations/${org}/${route}`)
      .auth('access-token', { type: 'bearer' })
      .expect(200);
  });
  it('checks current membership on every request', async () => {
    await request(app.getHttpServer())
      .get(`/test/organizations/${A}/admin`)
      .auth('access-token', { type: 'bearer' })
      .expect(200);
    members = [];
    await request(app.getHttpServer())
      .get(`/test/organizations/${A}/admin`)
      .auth('access-token', { type: 'bearer' })
      .expect(403);
  });
  it('returns only own profile and authorized organizations, with no cache', async () => {
    await request(app.getHttpServer())
      .get(`/me?userId=${OTHER}&organizationId=${C}`)
      .auth('access-token', { type: 'bearer' })
      .expect('Cache-Control', 'no-store')
      .expect(200, {
        profile: { id: USER, display_name: 'Pessoa de teste' },
        organizations: [
          { id: A, name: 'A', role: 'admin' },
          { id: B, name: 'B', role: 'participant' },
        ],
      });
    expect(calls[1]?.pathname).toBe('/rest/v1/organization_members');
  });
  it('fails closed and sanitizes authorization database errors', async () => {
    dbStatus = 403;
    const res = await request(app.getHttpServer())
      .get('/me')
      .auth('access-token', { type: 'bearer' })
      .expect(503);
    expect(res.text).not.toContain('private SQL');
    expect(calls).toHaveLength(2);
  });
  it('rejects malformed organization IDs before querying membership', async () => {
    await request(app.getHttpServer())
      .get('/test/organizations/not-uuid/admin')
      .auth('access-token', { type: 'bearer' })
      .expect(400);
    expect(calls).toHaveLength(1);
  });
});
