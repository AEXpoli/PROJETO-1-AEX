export type Organization = { id: string; name: string; role: 'admin' | 'participant' };
export type Me = { profile: { id: string; display_name: string }; organizations: Organization[] };
export type ActionState = { message: string; success?: boolean };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SESSION_COOKIE = 'aex-admin-auth';

export class AccessError extends Error {
  readonly kind: 'session' | 'denied' | 'unavailable';
  constructor(kind: 'session' | 'denied' | 'unavailable') { super(kind); this.kind = kind; }
}

export function authMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'invalid_credentials') return 'E-mail ou senha inválidos.';
  if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.';
  if (code === 'otp_expired') return 'Convite ou link inválido, expirado ou já utilizado. Solicite outro.';
  if (code === 'weak_password') return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
  if (code === 'same_password') return 'Escolha uma senha diferente da anterior.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Aguarde alguns minutos antes de tentar novamente.';
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}

export function validEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export function passwordError(password: string, confirmation: string) {
  if (password.length < 8) return 'Use uma senha com pelo menos 8 caracteres.';
  return password === confirmation ? null : 'As senhas precisam ser iguais.';
}
export function isSessionCookie(name: string) {
  return name === SESSION_COOKIE || name.startsWith(`${SESSION_COOKIE}.`) || name.startsWith(`${SESSION_COOKIE}-`);
}

export function parseMe(value: unknown, userId: string): Me {
  if (!value || typeof value !== 'object' || !('profile' in value) || !('organizations' in value)) throw new AccessError('unavailable');
  const profile = value.profile;
  if (!profile || typeof profile !== 'object' || !('id' in profile) || profile.id !== userId || !('display_name' in profile) || typeof profile.display_name !== 'string' || !Array.isArray(value.organizations)) throw new AccessError('unavailable');
  const organizations: Organization[] = value.organizations.map((org: unknown) => {
    if (!org || typeof org !== 'object' || !('id' in org) || typeof org.id !== 'string' || !UUID.test(org.id) || !('name' in org) || typeof org.name !== 'string' || !('role' in org) || !['admin','participant'].includes(String(org.role))) throw new AccessError('unavailable');
    return { id: org.id, name: org.name, role: org.role as Organization['role'] };
  });
  return { profile: { id: userId, display_name: profile.display_name }, organizations };
}

export async function apiRequest(api: string, token: string, path: string, init: RequestInit = {}, transport: typeof fetch = fetch) {
  let response: Response;
  try {
    response = await transport(`${api}${path}`, { ...init, cache: 'no-store',
      headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });
  } catch { throw new AccessError('unavailable'); }
  if (response.status === 401) throw new AccessError('session');
  if (response.status === 403) throw new AccessError('denied');
  return response;
}

export async function authorizeAdmin(api: string, token: string, userId: string, selected?: string, transport: typeof fetch = fetch) {
  const response = await apiRequest(api, token, '/me', {}, transport);
  if (!response.ok) throw new AccessError('unavailable');
  let me: Me;
  try { me = parseMe(await response.json(), userId); } catch { throw new AccessError('unavailable'); }
  const organizations = me.organizations.filter(org => org.role === 'admin');
  const organization = selected ? organizations.find(org => org.id === selected) : organizations[0];
  if (!organization) throw new AccessError('denied');
  // The API's existing OrganizationGuard revalidates the selected organization.
  const access = await apiRequest(api, token, `/organizations/${organization.id}/admin-access`, {}, transport);
  if (!access.ok) throw new AccessError('unavailable');
  const checked: unknown = await access.json();
  if (!checked || typeof checked !== 'object' || !('organization_id' in checked) || checked.organization_id !== organization.id || !('role' in checked) || checked.role !== 'admin') throw new AccessError('denied');
  return { me, organizations, organization };
}
