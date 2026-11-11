import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ContentAccessGuard } from '../content/content-access.guard';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [AttemptsController],
  providers: [ContentAccessGuard, AttemptsService],
})
export class AttemptsModule {}
