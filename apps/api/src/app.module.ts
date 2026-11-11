import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';

@Module({ imports: [HealthModule, SupabaseModule, AuthModule, ContentModule] })
export class AppModule {}
