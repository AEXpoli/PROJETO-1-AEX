import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OrganizationGuard } from './organization.guard';
import { OrganizationAccessService } from './organization-access.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminInvitationsService } from './admin-invitations.service';

@Module({
  imports: [SupabaseModule],
  controllers: [MeController, AdminInvitationsController],
  providers: [
    AuthService,
    AdminInvitationsService,
    OrganizationGuard,
    OrganizationAccessService,
    MeService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [OrganizationGuard, OrganizationAccessService],
})
export class AuthModule {}
