import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { readSupabaseConfig } from './supabase.config';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient<Database>;

  constructor() {
    const { url, secretKey } = readSupabaseConfig();
    this.client = createClient<Database>(url, secretKey, {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(5000)])
              : AbortSignal.timeout(5000),
          }),
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async checkConnection(): Promise<void> {
    try {
      const { error } = await this.client
        .from('organizations')
        .select('id', { head: true })
        .limit(1)
        .retry(false)
        .abortSignal(AbortSignal.timeout(5000));
      if (error) throw new Error();
    } catch {
      // Never propagate SDK errors, headers, credentials or row contents to logs.
      throw new Error('Falha na conexão Supabase. Verifique URL, chave, rede e permissões.');
    }
  }
}
