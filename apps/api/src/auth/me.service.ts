import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OrganizationAccessService } from './organization-access.service';
import type { Identity } from './auth.types';

export interface Profile {
  id: string;
  display_name: string;
}
interface Organization {
  id: string;
  name: string;
}

@Injectable()
export class MeService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: OrganizationAccessService,
  ) {}

  async getMe(identity: Identity) {
    const memberships = await this.access.memberships(identity);
    if (!memberships.length) throw new ForbiddenException('Usuário sem vínculo organizacional.');
    // No privileged profile/organization reads until membership has been established.
    const [profile, organizations] = await Promise.all([
      this.supabase.client
        .from('profiles')
        .select('id,display_name')
        .eq('id', identity.id)
        .retry(false)
        .abortSignal(AbortSignal.timeout(5000))
        .maybeSingle<Profile>(),
      this.supabase.client
        .from('organizations')
        .select('id,name')
        .in(
          'id',
          memberships.map((member) => member.organization_id),
        )
        .order('id')
        .retry(false)
        .abortSignal(AbortSignal.timeout(5000))
        .returns<Organization[]>(),
    ]);
    if (profile.error || organizations.error || !organizations.data)
      throw new ServiceUnavailableException('Não foi possível consultar o perfil.');
    if (!profile.data) throw new ForbiddenException('Perfil não provisionado.');
    return {
      profile: profile.data,
      organizations: organizations.data.map((organization) => ({
        ...organization,
        role: memberships.find((member) => member.organization_id === organization.id)!.role,
      })),
    };
  }
}
