import { SupabaseService } from '../src/supabase/supabase.service';
import { provisionUser } from '../src/provisioning/provision-user';
import type { ProvisionInput } from '../src/provisioning/provision-user';

const input: ProvisionInput = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  displayName: 'Operador',
  role: 'admin',
  apply: false,
};

describe('Controlled provisioning (real SDK, simulated transport)', () => {
  const originalEnv = process.env;
  let service: SupabaseService;
  let writes: { path: string; body: unknown; preference: string | null }[];
  let existingRole: string | undefined;
  let confirmed: boolean;
  let organizationExists: boolean;
  let failMembership: boolean;
  let conflictOnWrite: boolean;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test_only',
    };
    service = new SupabaseService();
    writes = [];
    existingRole = undefined;
    confirmed = true;
    organizationExists = true;
    failMembership = false;
    conflictOnWrite = false;
    jest.spyOn(globalThis, 'fetch').mockImplementation((req, init) => {
      const url = new URL(req instanceof Request ? req.url : req.toString());
      if (url.pathname.startsWith('/auth/v1/admin/users/')) {
        return Promise.resolve(
          Response.json({
            id: input.userId,
            email_confirmed_at: confirmed ? '2026-11-10T00:00:00Z' : null,
          }),
        );
      }
      if (init?.method === 'POST') {
        writes.push({
          path: url.pathname,
          body: JSON.parse(typeof init.body === 'string' ? init.body : '{}') as unknown,
          preference: new Headers(init.headers).get('prefer'),
        });
        if (url.pathname.endsWith('/organization_members')) {
          if (failMembership)
            return Promise.resolve(Response.json({ message: 'failure' }, { status: 409 }));
          existingRole ??= conflictOnWrite ? 'participant' : input.role;
        }
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      if (url.pathname.endsWith('/organizations')) {
        expect(url.searchParams.get('id')).toBe(`eq.${input.organizationId}`);
        return Promise.resolve(
          Response.json(organizationExists ? [{ id: input.organizationId }] : []),
        );
      }
      if (url.pathname.endsWith('/organization_members')) {
        expect(url.searchParams.get('organization_id')).toBe(`eq.${input.organizationId}`);
        expect(url.searchParams.get('user_id')).toBe(`eq.${input.userId}`);
        return Promise.resolve(Response.json(existingRole ? [{ role: existingRole }] : []));
      }
      throw new Error('Unexpected request');
    });
  });
  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('previews without writes by default', async () => {
    await expect(provisionUser(service.client, input)).resolves.toMatchObject({
      status: 'preview',
    });
    expect(writes).toEqual([]);
  });
  it('requires a confirmed Auth user', async () => {
    confirmed = false;
    await expect(provisionUser(service.client, { ...input, apply: true })).rejects.toThrow(
      'confirmado',
    );
    expect(writes).toEqual([]);
  });
  it('requires an existing organization', async () => {
    organizationExists = false;
    await expect(provisionUser(service.client, { ...input, apply: true })).rejects.toThrow(
      'Organização',
    );
    expect(writes).toEqual([]);
  });
  it('never promotes an existing participant', async () => {
    existingRole = 'participant';
    await expect(provisionUser(service.client, { ...input, apply: true })).rejects.toThrow(
      'não altera papéis',
    );
    expect(writes).toEqual([]);
  });
  it('provisions explicitly and reruns with ignore-duplicates, never updating profiles or roles', async () => {
    for (let i = 0; i < 2; i++) {
      await expect(provisionUser(service.client, { ...input, apply: true })).resolves.toMatchObject(
        { status: 'provisioned' },
      );
    }
    expect(writes).toHaveLength(4);
    for (const write of writes) expect(write.preference).toContain('resolution=ignore-duplicates');
    expect(writes[1]?.body).toEqual({
      organization_id: input.organizationId,
      user_id: input.userId,
      role: 'admin',
    });
  });
  it('reports partial failure and allows safe retry', async () => {
    failMembership = true;
    await expect(provisionUser(service.client, { ...input, apply: true })).rejects.toThrow(
      'Perfil preservado',
    );
    failMembership = false;
    await expect(provisionUser(service.client, { ...input, apply: true })).resolves.toMatchObject({
      status: 'provisioned',
    });
  });
  it('does not overwrite a concurrently created participant role', async () => {
    conflictOnWrite = true;
    await expect(provisionUser(service.client, { ...input, apply: true })).rejects.toThrow(
      'divergente',
    );
    expect(existingRole).toBe('participant');
  });
});
