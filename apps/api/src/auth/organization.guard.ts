import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationAccessService } from './organization-access.service';
import { UUID_PATTERN } from './auth.types';
import type { AuthenticatedRequest, OrganizationRole } from './auth.types';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: OrganizationAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.identity) throw new UnauthorizedException();
    const organizationId = request.params.organizationId;
    if (typeof organizationId !== 'string' || !UUID_PATTERN.test(organizationId)) {
      throw new BadRequestException('organizationId deve ser UUID.');
    }
    const roles =
      this.reflector.getAllAndOverride<OrganizationRole[]>('aex:organization-roles', [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    request.membership = await this.access.requireMembership(
      request.identity,
      organizationId,
      roles,
    );
    return true;
  }
}
