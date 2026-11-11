import type { SupabaseService } from '../supabase/supabase.service';
import { UUID_PATTERN } from '../auth/auth.types';
import type { OrganizationRole } from '../auth/auth.types';

export interface ProvisionInput {
  userId: string;
  organizationId: string;
  displayName: string;
  role: OrganizationRole;
  apply: boolean;
}

// Operator-only utility: never register this function as an HTTP endpoint.
export async function provisionUser(client: SupabaseService['client'], input: ProvisionInput) {
  if (
    !UUID_PATTERN.test(input.userId) ||
    !UUID_PATTERN.test(input.organizationId) ||
    !input.displayName.trim() ||
    [...input.displayName.trim()].length > 120 ||
    !['admin', 'participant'].includes(input.role)
  ) {
    throw new Error(
      'Informe UUIDs válidos, nome de 1 a 120 caracteres e role admin ou participant.',
    );
  }
  const user = await client.auth.admin.getUserById(input.userId);
  if (
    user.error ||
    !user.data.user ||
    user.data.user.is_anonymous ||
    !(user.data.user.email_confirmed_at || user.data.user.phone_confirmed_at)
  ) {
    throw new Error('O usuário Auth deve existir e ter email ou telefone confirmado.');
  }
  const org = await client
    .from('organizations')
    .select('id')
    .eq('id', input.organizationId)
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle<{ id: string }>();
  if (org.error || !org.data) throw new Error('Organização inexistente ou indisponível.');
  const current = await client
    .from('organization_members')
    .select('role')
    .eq('organization_id', input.organizationId)
    .eq('user_id', input.userId)
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle<{ role: OrganizationRole }>();
  if (current.error) throw new Error('Não foi possível consultar o vínculo atual.');
  if (current.data && current.data.role !== input.role) {
    throw new Error('Vínculo já existe com outro papel. Este fluxo não altera papéis.');
  }
  if (!input.apply)
    return {
      status: 'preview',
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role,
    };

  // Ignore conflicts: reruns never replace a profile or promote an existing member.
  const profile = await client
    .from('profiles')
    .upsert(
      { id: input.userId, display_name: input.displayName.trim() },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000));
  if (profile.error)
    throw new Error('Falha ao provisionar perfil. Reexecute após corrigir a causa.');
  const member = await client
    .from('organization_members')
    .upsert(
      {
        user_id: input.userId,
        organization_id: input.organizationId,
        role: input.role,
      },
      { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
    )
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000));
  if (member.error)
    throw new Error('Perfil preservado; vínculo não confirmado. Reexecute após corrigir a causa.');
  const verified = await client
    .from('organization_members')
    .select('role')
    .eq('organization_id', input.organizationId)
    .eq('user_id', input.userId)
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle<{ role: OrganizationRole }>();
  if (verified.error || verified.data?.role !== input.role) {
    throw new Error(
      'Vínculo final divergente ou indisponível. Nenhum papel existente foi sobrescrito.',
    );
  }
  return {
    status: 'provisioned',
    userId: input.userId,
    organizationId: input.organizationId,
    role: input.role,
  };
}
