import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const USER = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const EXERCISE = 'a5400000-0000-4000-8000-000000000101';
const OPTION = 'a5400000-0000-4000-8000-000000000202';
const ATTEMPT = '30000000-0000-4000-8000-000000000001';
const ASSIGNMENT = '40000000-0000-4000-8000-000000000001';
const body = { id: ATTEMPT, selectedOptionId: OPTION };
const result = {
  attempt: {
    id: ATTEMPT,
    exerciseId: EXERCISE,
    selectedOptionId: OPTION,
    submittedAt: '2026-11-11T00:00:00+00:00',
  },
  correct: true,
  selectedLabel: 'Selecionada',
  correctLabel: 'Correta',
  explanation: 'Explicação após responder.',
  completedAt: '2026-11-11T00:00:00+00:00',
  evaluation: 'server',
  assignmentId: null,
  pointsAwarded: 10,
};
const progress = {
  evaluation: 'server',
  completions: [],
  summary: {
    total: 3,
    completed: 0,
    correct: 0,
    reviewed: 0,
    points: 0,
    isComplete: false,
    exerciseStats: [],
  },
  modules: [],
};
const achievements = [
  {
    id: 'first',
    title: 'Primeiro passo',
    description: 'Concluir a primeira atividade.',
    unlocked: false,
  },
];
const endpoints = ['attempts', 'progress', 'achievements'];

describe('Stage 5.5 endpoints (HTTP and actual Supabase SDK)', () => {
  let app: INestApplication<Server>;
  const originalEnv = process.env;
  let rpcCalls: { path: string; body: unknown }[];
  let hasMembership: boolean;
  let invalidAuth: boolean;
  let rpcCode: string | undefined;
  let rpcResult: unknown;
  let loseResponse: boolean;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test_only',
    };
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    process.env = originalEnv;
  });
  beforeEach(() => {
    rpcCalls = [];
    hasMembership = true;
    invalidAuth = false;
    rpcCode = undefined;
    rpcResult = result;
    loseResponse = false;
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === '/auth/v1/user') {
        return Promise.resolve(
          Response.json(
            invalidAuth ? { msg: 'invalid token' } : { id: USER, is_anonymous: false },
            { status: invalidAuth ? 401 : 200 },
          ),
        );
      }
      if (url.pathname.endsWith('/organization_members')) {
        expect(url.searchParams.get('user_id')).toBe(`eq.${USER}`);
        return Promise.resolve(
          Response.json(
            hasMembership
              ? [{ user_id: USER, organization_id: ASSIGNMENT, role: 'participant' }]
              : [],
          ),
        );
      }
      expect(url.pathname).toMatch(/^\/rest\/v1\/rpc\/aex_(record_attempt|learning_read)$/);
      expect(init?.method).toBe('POST');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(typeof init?.body).toBe('string');
      const payload: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      rpcCalls.push({ path: url.pathname, body: payload });
      if (loseResponse) {
        loseResponse = false;
        return Promise.reject(new TypeError('SECRET_TRANSPORT_DETAILS'));
      }
      if (rpcCode)
        return Promise.resolve(
          Response.json({ code: rpcCode, message: 'SECRET_DATABASE_DETAILS' }, { status: 400 }),
        );
      return Promise.resolve(Response.json(rpcResult));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('requires a token before submitting', async () => {
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .send(body)
      .expect(401);
    expect(rpcCalls).toHaveLength(0);
  });
  it.each(endpoints)('protects GET /me/%s', async (resource) => {
    await request(app.getHttpServer()).get(`/me/${resource}`).expect(401);
    expect(rpcCalls).toHaveLength(0);
  });
  it('rejects invalid tokens', async () => {
    invalidAuth = true;
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send(body)
      .expect(401);
    expect(rpcCalls).toHaveLength(0);
  });
  it('requires membership before calling the transactional function', async () => {
    hasMembership = false;
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send(body)
      .expect(403);
    expect(rpcCalls).toHaveLength(0);
  });
  it.each([true, false])(
    'returns server correctness (%s) using one atomic RPC',
    async (correct) => {
      rpcResult = { ...result, correct };
      await request(app.getHttpServer())
        .post(`/exercises/${EXERCISE}/attempts`)
        .auth('token', { type: 'bearer' })
        .send(body)
        .expect('Cache-Control', 'no-store')
        .expect(200, rpcResult);
      expect(rpcCalls).toEqual([
        {
          path: '/rest/v1/rpc/aex_record_attempt',
          body: {
            p_participant_id: USER,
            p_attempt_id: ATTEMPT,
            p_exercise_id: EXERCISE,
            p_selected_option_id: OPTION,
          },
        },
      ]);
    },
  );
  it.each([
    'participant_id',
    'participantId',
    'is_correct',
    'correct',
    'points',
    'role',
    'submittedAt',
  ])('rejects client-controlled result/identity field %s', async (field) => {
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send({ ...body, [field]: field.includes('participant') ? OTHER : true })
      .expect(400);
    expect(rpcCalls).toHaveLength(0);
  });
  it.each([
    {},
    { ...body, id: 'not-uuid' },
    { ...body, selectedOptionId: 'not-uuid' },
    { ...body, assignmentId: 'not-uuid' },
  ])('validates the request schema: %j', async (input) => {
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send(input)
      .expect(400);
    expect(rpcCalls).toHaveLength(0);
  });
  it('validates the exercise UUID', async () => {
    await request(app.getHttpServer())
      .post('/exercises/not-uuid/attempts')
      .auth('token', { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(rpcCalls).toHaveLength(0);
  });
  it('forwards only the explicit assignment id for database authorization', async () => {
    rpcResult = { ...result, assignmentId: ASSIGNMENT };
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send({ ...body, assignmentId: ASSIGNMENT })
      .expect(200);
    expect(rpcCalls[0]?.body).toMatchObject({
      p_participant_id: USER,
      p_assignment_id: ASSIGNMENT,
    });
  });
  it.each([
    ['PT400', 400],
    ['PT403', 403],
    ['PT404', 404],
    ['PT409', 409],
    ['57014', 503],
  ])('maps database failure %s to %s without details', async (code, status) => {
    rpcCode = String(code);
    const response = await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send(body)
      .expect(Number(status));
    expect(response.text).not.toContain('SECRET_');
  });
  it('preserves the id on lost-response retry and does not retry a write automatically', async () => {
    loseResponse = true;
    const response = await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send(body)
      .expect(503);
    expect(response.text).not.toContain('SECRET_');
    expect(rpcCalls).toHaveLength(1);
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send(body)
      .expect(200, result);
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[1]).toEqual(rpcCalls[0]);
  });
  it.each(endpoints)(
    'scopes GET /me/%s to the token, ignoring foreign query/header identities',
    async (resource) => {
      rpcResult =
        resource === 'attempts' ? [result] : resource === 'progress' ? progress : achievements;
      await request(app.getHttpServer())
        .get(`/me/${resource}?participantId=${OTHER}&userId=${OTHER}`)
        .set('x-user-id', OTHER)
        .auth('token', { type: 'bearer' })
        .expect('Cache-Control', 'no-store')
        .expect(200, rpcResult);
      expect(rpcCalls).toEqual([
        {
          path: '/rest/v1/rpc/aex_learning_read',
          body: { p_participant_id: USER, p_resource: resource },
        },
      ]);
    },
  );
  it('rejects an invalid database response rather than returning arbitrary fields', async () => {
    rpcResult = { ...result, privateField: 'SECRET_FIELD' };
    const response = await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/attempts`)
      .auth('token', { type: 'bearer' })
      .send(body)
      .expect(500);
    expect(response.text).not.toContain('SECRET_FIELD');
  });
});
