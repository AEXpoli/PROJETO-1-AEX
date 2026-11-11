import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ContentAccessGuard } from './content-access.guard';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [ContentController],
  providers: [ContentAccessGuard, ContentService],
})
export class ContentModule {}
