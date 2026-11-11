import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('HTTP foundation', () => {
  let app: INestApplication<Server>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({})
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('GET /health/live funciona sem serviços externos', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
  });
  it('não expõe módulos da fase seguinte', async () => {
    await request(app.getHttpServer()).get('/users').expect(404);
  });
});
