import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { OrganizationGuard } from './organization.guard';
import type { OrganizationRole } from './auth.types';

export const PUBLIC_ROUTE = 'aex:public';
export const ORGANIZATION_ROLES = 'aex:organization-roles';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
// Requires the organizationId route parameter. Authentication runs globally first.
export const RequireOrganization = (...roles: OrganizationRole[]) =>
  applyDecorators(SetMetadata(ORGANIZATION_ROLES, roles), UseGuards(OrganizationGuard));
