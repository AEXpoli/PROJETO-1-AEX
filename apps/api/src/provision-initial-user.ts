import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { loadApiEnv } from './load-env';
import { SupabaseService } from './supabase/supabase.service';
import { provisionUser } from './provisioning/provision-user';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'user-id': { type: 'string' },
      'organization-id': { type: 'string' },
      'display-name': { type: 'string' },
      role: { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  if (
    !values['user-id'] ||
    !values['organization-id'] ||
    !values['display-name'] ||
    (values.role !== 'admin' && values.role !== 'participant')
  ) {
    throw new Error(
      'Use --user-id UUID --organization-id UUID --display-name NOME --role admin|participant [--apply].',
    );
  }
  loadApiEnv();
  const service = new SupabaseService();
  console.log(
    await provisionUser(service.client, {
      userId: values['user-id'],
      organizationId: values['organization-id'],
      displayName: values['display-name'],
      role: values.role,
      apply: values.apply,
    }),
  );
}

main().catch(() => {
  // Avoid logging arguments, Auth payloads or SDK transport details.
  console.error(
    'Provisionamento não concluído. Confira os argumentos, usuário confirmado, organização, papel existente e conexão. Consulte docs de autenticação.',
  );
  process.exitCode = 1;
});
