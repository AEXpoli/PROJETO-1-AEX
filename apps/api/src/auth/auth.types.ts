import type { Request } from 'express';

export type OrganizationRole = 'admin' | 'participant';
export interface Identity {
  id: string;
}
export interface Membership {
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
}
export interface AuthenticatedRequest extends Request {
  identity?: Identity;
  membership?: Membership;
}
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
