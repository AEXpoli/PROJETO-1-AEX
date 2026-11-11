import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { participantExerciseSchema, learningModuleSchema } from '@aex/validation';
import { AppModule } from '../src/app.module';

const USER = '11111111-1111-4111-8111-111111111111';
const MODULE = 'a5400000-0000-4000-8000-000000000001';
const DRAFT = 'a5400000-0000-4000-8000-000000000002';
const ARCHIVED = 'a5400000-0000-4000-8000-000000000003';
const EMPTY = 'a5400000-0000-4000-8000-000000000004';
const EXERCISE = 'a5400000-0000-4000-8000-000000000101';
const HIDDEN = 'a5400000-0000-4000-8000-000000000102';
const UNDER_DRAFT = 'a5400000-0000-4000-8000-000000000103';
const RETIRED = 'a5400000-0000-4000-8000-000000000104';
const MISSING = 'a5400000-0000-4000-8000-000000000999';
const OPTION_A = 'a5400000-0000-4000-8000-000000000201';
const OPTION_B = 'a5400000-0000-4000-8000-000000000202';
const endpoints = [
  '/modules',
  `/modules/${MODULE}`,
  `/modules/${MODULE}/exercises`,
  `/exercises/${EXERCISE}`,
];

const modules = [
  {
    id: MODULE,
    title: 'Mensagens',
    description: 'Situações fictícias.',
    sort_order: 0,
    status: 'published',
  },
  { id: DRAFT, title: 'Rascunho', description: '', sort_order: 1, status: 'draft' },
  { id: ARCHIVED, title: 'Arquivado', description: '', sort_order: 2, status: 'archived' },
  { id: EMPTY, title: 'Sem exercícios', description: '', sort_order: 3, status: 'published' },
];
const exerciseRows = [
  { id: EXERCISE, module_id: MODULE, status: 'published' },
  { id: HIDDEN, module_id: MODULE, status: 'draft' },
  { id: UNDER_DRAFT, module_id: DRAFT, status: 'published' },
  { id: RETIRED, module_id: MODULE, status: 'archived' },
];

describe('Educational content endpoints (HTTP + real SDK)', () => {
  let app: INestApplication<Server>;
  const originalEnv = process.env;
  let urls: URL[];
  let member: boolean;
  let authStatus: number;
  let contentStatus: number;
  let invalidContent: boolean;
  let invalidModule: boolean;
  let memberRole: string;
  let emptyCatalog: boolean;

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
    urls = [];
    member = true;
    memberRole = 'participant';
    authStatus = 200;
    contentStatus = 200;
    invalidContent = false;
    invalidModule = false;
    emptyCatalog = false;
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      urls.push(url);
      expect(init?.method ?? 'GET').toBe('GET');
      if (url.pathname === '/auth/v1/user')
        return Promise.resolve(
          Response.json(
            authStatus === 200 ? { id: USER, is_anonymous: false } : { msg: 'invalid JWT' },
            { status: authStatus },
          ),
        );
      if (url.pathname.endsWith('/organization_members')) {
        expect(url.searchParams.get('user_id')).toBe(`eq.${USER}`);
        return Promise.resolve(
          Response.json(
            member ? [{ user_id: USER, organization_id: MODULE, role: memberRole }] : [],
          ),
        );
      }
      expect(url.searchParams.get('select')).not.toMatch(
        /\*|is_correct|explanation|takeaway|correctOptionId/i,
      );
      expect(url.searchParams.get('status')).toBe('eq.published');
      if (contentStatus !== 200)
        return Promise.resolve(
          Response.json({ message: 'SECRET_DATABASE_ERROR' }, { status: contentStatus }),
        );
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (url.pathname.endsWith('/learning_modules')) {
        if (!id) expect(url.searchParams.get('order')).toBe('sort_order.asc,id.asc');
        return Promise.resolve(
          Response.json(
            emptyCatalog
              ? []
              : modules
                  .filter((row) => row.status === 'published' && (!id || row.id === id))
                  .map((row) => ({
                    ...row,
                    title: invalidModule ? '' : row.title,
                    explanation: 'SECRET_MODULE',
                  })),
          ),
        );
      }
      if (url.pathname.endsWith('/exercises')) {
        expect(url.searchParams.get('learning_modules.status')).toBe('eq.published');
        expect(url.searchParams.get('select')).toContain('learning_modules!inner(status)');
        expect(url.searchParams.get('select')).toContain(
          'exercise_options(id,option_text,sort_order)',
        );
        const moduleId = url.searchParams.get('module_id')?.replace('eq.', '');
        if (moduleId) expect(url.searchParams.get('order')).toBe('sort_order.asc,id.asc');
        return Promise.resolve(
          Response.json(
            exerciseRows
              .filter(
                (row) =>
                  row.status === 'published' &&
                  modules.some(
                    (parent) => parent.id === row.module_id && parent.status === 'published',
                  ) &&
                  (!id || row.id === id) &&
                  (!moduleId || row.module_id === moduleId),
              )
              .map((row) => ({
                ...row,
                title: 'SMS suspeito',
                scenario: 'Mensagem fictícia',
                question: 'Como agir?',
                sort_order: 0,
                learning_modules: { status: 'published' },
                takeaway: 'SECRET_TAKEAWAY',
                correctOptionId: OPTION_B,
                exercise_options: [
                  {
                    id: OPTION_B,
                    option_text: invalidContent ? '' : 'Alternativa B',
                    sort_order: 1,
                    is_correct: true,
                    explanation: 'SECRET_EXPLANATION',
                  },
                  {
                    id: OPTION_A,
                    option_text: 'Alternativa A',
                    sort_order: 0,
                    is_correct: false,
                    explanation: 'SECRET_EXPLANATION',
                  },
                ],
              })),
          ),
        );
      }
      throw new Error('Unexpected request');
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(endpoints)('requires authentication: %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
    expect(urls).toHaveLength(0);
  });
  it.each(endpoints)('rejects an invalid token before privileged reads: %s', async (path) => {
    authStatus = 401;
    await request(app.getHttpServer()).get(path).auth('token', { type: 'bearer' }).expect(401);
    expect(urls).toHaveLength(1);
  });
  it.each(endpoints)('requires organizational membership: %s', async (path) => {
    member = false;
    await request(app.getHttpServer()).get(path).auth('token', { type: 'bearer' }).expect(403);
    expect(urls).toHaveLength(2);
  });
  it('lists only published modules in deterministic order', async () => {
    await request(app.getHttpServer())
      .get('/modules')
      .auth('token', { type: 'bearer' })
      .expect(200, [
        { id: MODULE, title: 'Mensagens', description: 'Situações fictícias.', sortOrder: 0 },
        { id: EMPTY, title: 'Sem exercícios', description: '', sortOrder: 3 },
      ]);
  });
  it('reads a published module using the shared response schema', async () => {
    const res = await request(app.getHttpServer())
      .get(`/modules/${MODULE}`)
      .auth('token', { type: 'bearer' })
      .expect(200);
    expect(learningModuleSchema.safeParse(res.body).success).toBe(true);
  });
  it.each([
    `/modules/${DRAFT}`,
    `/modules/${ARCHIVED}`,
    `/modules/${MISSING}`,
    `/modules/${DRAFT}/exercises`,
    `/modules/${MISSING}/exercises`,
    `/exercises/${HIDDEN}`,
    `/exercises/${RETIRED}`,
    `/exercises/${UNDER_DRAFT}`,
    `/exercises/${MISSING}`,
  ])('hides unpublished, missing or inaccessible parent content: %s', async (path) => {
    await request(app.getHttpServer()).get(path).auth('token', { type: 'bearer' }).expect(404);
  });
  it('lists only published exercises, and returns options in content order', async () => {
    await request(app.getHttpServer())
      .get(`/modules/${MODULE}/exercises`)
      .auth('token', { type: 'bearer' })
      .expect(200, [
        {
          id: EXERCISE,
          moduleId: MODULE,
          title: 'SMS suspeito',
          scenario: 'Mensagem fictícia',
          question: 'Como agir?',
          sortOrder: 0,
          options: [
            { id: OPTION_A, label: 'Alternativa A' },
            { id: OPTION_B, label: 'Alternativa B' },
          ],
        },
      ]);
  });
  it('reads a published exercise using the safe shared contract', async () => {
    const res = await request(app.getHttpServer())
      .get(`/exercises/${EXERCISE}`)
      .auth('token', { type: 'bearer' })
      .expect(200);
    expect(participantExerciseSchema.safeParse(res.body).success).toBe(true);
  });
  it.each(endpoints)(
    'never serializes answer keys, explanations or extra DB fields: %s',
    async (path) => {
      const res = await request(app.getHttpServer())
        .get(path)
        .auth('token', { type: 'bearer' })
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(res.text).not.toMatch(
        /is_correct|isCorrect|correctOptionId|correctLabel|explanation|takeaway|SECRET_|learning_modules|exercise_options/,
      );
      expect(urls[0]?.pathname).toBe('/auth/v1/user');
      expect(urls[1]?.pathname).toBe('/rest/v1/organization_members');
    },
  );
  it('does not expose keys even to admin or via client-provided select/status flags', async () => {
    memberRole = 'admin';
    const res = await request(app.getHttpServer())
      .get(`/exercises/${EXERCISE}?select=*&includeAnswers=true&status=draft`)
      .auth('token', { type: 'bearer' })
      .expect(200);
    expect(res.text).not.toMatch(/is_correct|explanation|SECRET_|takeaway/);
  });
  it.each(['/modules/not-uuid', '/modules/not-uuid/exercises', '/exercises/not-uuid'])(
    'validates UUID: %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).auth('token', { type: 'bearer' }).expect(400);
      expect(urls).toHaveLength(2);
    },
  );
  it('returns an empty collection for an empty catalog', async () => {
    emptyCatalog = true;
    await request(app.getHttpServer())
      .get('/modules')
      .auth('token', { type: 'bearer' })
      .expect(200, []);
  });
  it('returns an empty collection for a published module without exercises', async () => {
    await request(app.getHttpServer())
      .get(`/modules/${EMPTY}/exercises`)
      .auth('token', { type: 'bearer' })
      .expect(200, []);
  });
  it('validates outgoing module data', async () => {
    invalidModule = true;
    await request(app.getHttpServer())
      .get('/modules')
      .auth('token', { type: 'bearer' })
      .expect(500);
  });
  it('validates outgoing exercise/option data', async () => {
    invalidContent = true;
    const res = await request(app.getHttpServer())
      .get(`/exercises/${EXERCISE}`)
      .auth('token', { type: 'bearer' })
      .expect(500);
    expect(res.text).not.toContain('SECRET_');
  });
  it('sanitizes content database errors', async () => {
    contentStatus = 403;
    const res = await request(app.getHttpServer())
      .get('/modules')
      .auth('token', { type: 'bearer' })
      .expect(503);
    expect(res.text).not.toContain('SECRET_DATABASE_ERROR');
  });
  it('does not implement submission routes', async () => {
    await request(app.getHttpServer())
      .post(`/exercises/${EXERCISE}/answers`)
      .auth('token', { type: 'bearer' })
      .send({ optionId: OPTION_A })
      .expect(404);
  });
});
