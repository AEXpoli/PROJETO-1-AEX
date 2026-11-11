import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { Identity } from './auth.types';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async authenticate(token: string): Promise<Identity> {
    // getUser(token) validates against this project's Auth server without setting a session.
    const { data, error } = await this.supabase.client.auth.getUser(token).catch(() => {
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    });
    if (error) {
      if (error.status && [400, 401, 403, 404, 422].includes(error.status)) {
        throw new UnauthorizedException('Token inválido ou expirado.');
      }
      throw new ServiceUnavailableException('Serviço de autenticação indisponível.');
    }
    if (!data.user || data.user.is_anonymous) {
      throw new UnauthorizedException('Usuário autenticado obrigatório.');
    }
    return { id: data.user.id };
  }
}
