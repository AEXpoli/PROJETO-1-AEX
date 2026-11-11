import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { Identity, Membership, OrganizationRole } from './auth.types';

@Injectable()
export class OrganizationAccessService {
  constructor(private readonly supabase: SupabaseService) {}

  async memberships(identity: Identity, organizationId?: string): Promise<Membership[]> {
    // This authorization lookup is always scoped to the identity verified by Auth.
    let query = this.supabase.client
      .from('organization_members')
      .select('organization_id,user_id,role')
      .eq('user_id', identity.id);
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query
      .order('organization_id')
      .retry(false)
      .abortSignal(AbortSignal.timeout(5000))
      .returns<Membership[]>();
    if (error || !data)
      throw new ServiceUnavailableException('Não foi possível verificar os vínculos.');
    return data.filter((member) => member.role === 'admin' || member.role === 'participant');
  }

  async requireMembership(
    identity: Identity,
    organizationId: string,
    roles: OrganizationRole[],
  ): Promise<Membership> {
    const [membership] = await this.memberships(identity, organizationId);
    if (!membership || (roles.length > 0 && !roles.includes(membership.role))) {
      throw new ForbiddenException('Acesso à organização não autorizado.');
    }
    return membership;
  }
}
