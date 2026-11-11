import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { OrganizationAccessService } from '../auth/organization-access.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Injectable()
export class ContentAccessGuard implements CanActivate {
  constructor(private readonly access: OrganizationAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { identity } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!identity) throw new UnauthorizedException();
    // Content is global in the current schema; a valid membership grants catalog access.
    if (!(await this.access.memberships(identity)).length) {
      throw new ForbiddenException('Usuário sem vínculo organizacional.');
    }
    return true;
  }
}
