import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UUID_PATTERN } from './auth.types';

function rpcFailure(error: { code: string }): never {
  if (error.code === '42501') throw new ForbiddenException('Convite ou organização não autorizado.');
  if (error.code === '22023') throw new BadRequestException('Convite inválido, expirado ou já utilizado.');
  if (error.code === '23505') throw new ConflictException('Este fluxo é para novas contas. Procure o operador responsável para contas existentes.');
  if (error.code === 'PT429') throw new HttpException('Aguarde um minuto para enviar outro convite.', 429);
  throw new ServiceUnavailableException('Não foi possível concluir o convite.');
}

function invitationInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).some(key => !['email', 'display_name'].includes(key)) ||
    !('email' in body) || typeof body.email !== 'string' || !('display_name' in body) || typeof body.display_name !== 'string') {
    throw new BadRequestException('Informe somente email e display_name.');
  }
  const email = body.email.trim().toLowerCase();
  const name = body.display_name.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || [...name].length < 1 || [...name].length > 120) {
    throw new BadRequestException('Informe e-mail e nome válidos.');
  }
  return { email, name };
}

@Injectable()
export class AdminInvitationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async issue(issuer: string, organization: string, body: unknown) {
    const { email, name } = invitationInput(body);
    let origin: URL;
    try {
      origin = new URL(process.env.ADMIN_SITE_URL ?? '');
      if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
        (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))) throw new Error();
    } catch { throw new ServiceUnavailableException('URL de ativação administrativa não configurada.'); }
    const created = await this.supabase.client.rpc('aex_create_admin_invitation', {
      p_issuer: issuer, p_organization: organization, p_email: email, p_name: name,
    }).retry(false).abortSignal(AbortSignal.timeout(5000));
    if (created.error) rpcFailure(created.error);
    const value = created.data;
    if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.id !== 'string' || typeof value.expires_at !== 'string') {
      throw new ServiceUnavailableException('Não foi possível preparar o convite.');
    }
    const callback = new URL('/auth/confirm', origin);
    callback.searchParams.set('invitation_id', value.id);
    const invited = await this.supabase.client.auth.admin.inviteUserByEmail(email, {
      redirectTo: callback.toString(), data: { display_name: name },
    }).catch(() => null);
    // No permission is granted at send time. An ambiguous send remains unusable.
    const target = invited && !invited.error ? invited.data.user.id : null;
    const delivery = await this.supabase.client.rpc('aex_admin_invitation_delivery', {
      p_issuer: issuer, p_invitation: value.id, p_target: target,
    }).retry(false).abortSignal(AbortSignal.timeout(5000));
    if (delivery.error) rpcFailure(delivery.error);
    if (!target) throw new ServiceUnavailableException('O envio não foi confirmado. Confira o endereço e a configuração de e-mail antes de tentar novamente.');
    return { id: value.id, expires_at: value.expires_at, status: 'sent' };
  }

  async accept(userId: string, invitationId: string) {
    if (!UUID_PATTERN.test(invitationId)) throw new BadRequestException('Convite inválido.');
    const { data, error } = await this.supabase.client.rpc('aex_accept_admin_invitation', {
      p_user: userId, p_invitation: invitationId,
    }).retry(false).abortSignal(AbortSignal.timeout(5000));
    if (error) rpcFailure(error);
    return data;
  }
}
