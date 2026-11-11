'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { identity, requireAdmin, serverClient } from './server';
import { authConfig } from './config';
import { cookieOptions } from './ssr';
import { AccessError, apiRequest, authMessage, authorizeAdmin, isSessionCookie, passwordError, UUID, validEmail, type ActionState } from './core';

function field(data: FormData, key: string) { const value = data.get(key); return typeof value === 'string' ? value : ''; }
function failure(error: unknown): ActionState {
  if (error instanceof AccessError) return { message: error.kind === 'denied' ? 'Sua conta não está autorizada nesta organização.' : error.kind === 'session' ? 'Sua sessão expirou. Entre novamente ou solicite outro link.' : 'Serviço indisponível. Tente novamente em instantes.' };
  return { message: authMessage(error) };
}
async function clearSession() {
  try { await (await serverClient()).auth.signOut({ scope: 'local' }); } catch { /* Local logout still clears every session chunk. */ }
  const jar = await cookies();
  jar.getAll().filter(cookie => isSessionCookie(cookie.name) || cookie.name === 'aex-admin-organization').forEach(cookie => jar.delete(cookie.name));
}

export async function login(_state: ActionState, data: FormData): Promise<ActionState> {
  const email = field(data, 'email').trim();
  const password = field(data, 'password');
  if (!validEmail(email) || !password) return { message: 'Informe e-mail e senha.' };
  let destination = '/';
  try {
    const client = await serverClient();
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) return { message: authMessage(result.error) };
    (await cookies()).delete('aex-admin-organization');
    const session = await identity();
    await authorizeAdmin(authConfig().api, session.token, session.userId);
  } catch (error) {
    if (error instanceof AccessError && error.kind === 'denied') destination = '/acesso-nao-autorizado';
    else return failure(error);
  }
  revalidatePath('/', 'layout');
  redirect(destination);
}

export async function logout() { await clearSession(); revalidatePath('/', 'layout'); redirect('/login'); }

export async function requestPassword(_state: ActionState, data: FormData): Promise<ActionState> {
  const email = field(data, 'email').trim();
  if (!validEmail(email)) return { message: 'Informe um e-mail válido.' };
  try {
    const client = await serverClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${authConfig().site}/auth/callback` });
    if (error) return { message: authMessage(error) };
    return { success: true, message: 'Se houver uma conta elegível, você receberá um e-mail. Abra o link neste mesmo navegador. Confira também o spam.' };
  } catch (error) { return failure(error); }
}

export async function confirmInvitation(_state: ActionState, data: FormData): Promise<ActionState> {
  const token = field(data, 'token_hash');
  const invitation = field(data, 'invitation_id');
  if (!/^[a-zA-Z0-9_-]{20,256}$/.test(token) || !UUID.test(invitation)) return { message: 'Convite inválido. Solicite um novo convite à instituição.' };
  try {
    const client = await serverClient();
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'invite' });
    if (error) return { message: authMessage(error) };
    (await cookies()).delete('aex-admin-organization');
  } catch (error) { return failure(error); }
  redirect(`/ativar-conta?invitation_id=${invitation}`);
}

export async function changePassword(_state: ActionState, data: FormData): Promise<ActionState> {
  const password = field(data, 'password');
  const validation = passwordError(password, field(data, 'confirmation'));
  if (validation) return { message: validation };
  try {
    const session = await identity();
    const { error } = await session.client.auth.updateUser({ password });
    if (error) return { message: authMessage(error) };
    await clearSession();
  } catch (error) { return failure(error); }
  revalidatePath('/', 'layout');
  redirect('/login?reason=updated');
}

export async function activateAccount(_state: ActionState, data: FormData): Promise<ActionState> {
  const invitation = field(data, 'invitation_id');
  const password = field(data, 'password');
  const validation = passwordError(password, field(data, 'confirmation'));
  if (validation) return { message: validation };
  if (!UUID.test(invitation)) return { message: 'Convite inválido. Solicite um novo convite.' };
  try {
    const session = await identity();
    const { error } = await session.client.auth.updateUser({ password });
    if (error) return { message: authMessage(error) };
    const accepted = await apiRequest(authConfig().api, session.token, `/admin-invitations/${invitation}/accept`, { method: 'POST' });
    if (accepted.status === 400) return { message: 'Convite inválido, expirado ou já utilizado. Se já ativou a conta, tente entrar; caso contrário, solicite outro convite.' };
    if (!accepted.ok) return { message: 'A ativação não foi confirmada. Tente entrar ou repita a ativação.' };
    (await cookies()).delete('aex-admin-organization');
    await authorizeAdmin(authConfig().api, session.token, session.userId);
  } catch (error) { return failure(error); }
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function issueInvitation(_state: ActionState, data: FormData): Promise<ActionState> {
  const context = await requireAdmin();
  const email = field(data, 'email').trim();
  const name = field(data, 'display_name').trim();
  if (!validEmail(email) || [...name].length < 1 || [...name].length > 120) return { message: 'Informe e-mail e nome válidos.' };
  try {
    const response = await apiRequest(authConfig().api, context.token, `/organizations/${context.organization.id}/admin-invitations`, {
      method: 'POST', body: JSON.stringify({ email, display_name: name }),
    });
    if (response.status === 409) return { message: 'A conta já existe. Procure o operador responsável; este fluxo não altera papéis existentes.' };
    if (response.status === 429) return { message: 'Aguarde um minuto antes de enviar outro convite.' };
    if (!response.ok) return { message: 'Envio não confirmado. Confira a configuração de e-mail e tente novamente.' };
    return { success: true, message: 'Convite enviado. O acesso só será liberado após a ativação pela pessoa convidada.' };
  } catch (error) { return failure(error); }
}

export async function selectOrganization(data: FormData) {
  const selected = field(data, 'organization');
  let authorized = false;
  try {
    const session = await identity();
    if (UUID.test(selected)) {
      await authorizeAdmin(authConfig().api, session.token, session.userId, selected);
      (await cookies()).set('aex-admin-organization', selected, { ...cookieOptions, name: 'aex-admin-organization' });
      authorized = true;
    }
  } catch { /* A forged selection never changes the current organization. */ }
  revalidatePath('/', 'layout');
  redirect(authorized ? '/' : '/acesso-nao-autorizado');
}
