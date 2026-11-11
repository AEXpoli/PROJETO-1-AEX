import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';

@Module({ imports: [HealthModule, SupabaseModule, AuthModule] })
export class AppModule {}
