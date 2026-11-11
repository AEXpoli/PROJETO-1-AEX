import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadApiEnv } from './load-env';
import { SupabaseModule } from './supabase/supabase.module';
import { SupabaseService } from './supabase/supabase.service';

async function check(): Promise<void> {
  loadApiEnv();
  const app = await NestFactory.createApplicationContext(SupabaseModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    await app.get(SupabaseService).checkConnection();
    console.log('Supabase: conexão OK (somente leitura, sem retornar registros).');
  } finally {
    await app.close();
  }
}

check().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha na verificação Supabase.');
  process.exitCode = 1;
});
