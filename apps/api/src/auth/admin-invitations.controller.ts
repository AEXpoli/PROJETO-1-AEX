import { Body, Controller, Get, Header, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { RequireOrganization } from './auth.decorators';
import type { AuthenticatedRequest } from './auth.types';
import { AdminInvitationsService } from './admin-invitations.service';

@Controller()
export class AdminInvitationsController {
  constructor(private readonly invitations: AdminInvitationsService) {}

  @Get('organizations/:organizationId/admin-access')
  @RequireOrganization('admin')
  @Header('Cache-Control', 'no-store')
  access(@Req() request: AuthenticatedRequest) {
    return { organization_id: request.membership?.organization_id, role: 'admin' };
  }

  @Post('organizations/:organizationId/admin-invitations')
  @RequireOrganization('admin')
  @Header('Cache-Control', 'no-store')
  issue(@Req() request: AuthenticatedRequest, @Param('organizationId') organization: string, @Body() body: unknown) {
    if (!request.identity) throw new UnauthorizedException();
    return this.invitations.issue(request.identity.id, organization, body);
  }

  @Post('admin-invitations/:id/accept')
  @Header('Cache-Control', 'no-store')
  accept(@Req() request: AuthenticatedRequest, @Param('id') invitation: string) {
    if (!request.identity) throw new UnauthorizedException();
    return this.invitations.accept(request.identity.id, invitation);
  }
}
