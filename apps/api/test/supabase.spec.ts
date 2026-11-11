import { readSupabaseConfig } from '../src/supabase/supabase.config';
import { SupabaseService } from '../src/supabase/supabase.service';

const config = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
};

describe('Supabase configuration', () => {
  it('requires the URL and a backend secret key without exposing values', () => {
    expect(() => readSupabaseConfig({})).toThrow('SUPABASE_URL');
    expect(() => readSupabaseConfig({ SUPABASE_URL: config.SUPABASE_URL })).toThrow(
      'SUPABASE_SECRET_KEY',
    );
    expect(() =>
      readSupabaseConfig({ ...config, SUPABASE_SECRET_KEY: 'sb_publishable_test' }),
    ).toThrow('SUPABASE_SECRET_KEY');
    expect(() => readSupabaseConfig({ ...config, SUPABASE_URL: 'http://example.com' })).toThrow(
      'SUPABASE_URL',
    );
    expect(readSupabaseConfig(config)).toEqual({
      url: config.SUPABASE_URL,
      secretKey: config.SUPABASE_SECRET_KEY,
    });
  });
});

describe('Supabase connectivity', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, ...config };
  });
  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('uses a bounded HEAD request and succeeds even with no records', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));
    await expect(new SupabaseService().checkConnection()).resolves.toBeUndefined();
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.supabase.co/rest/v1/organizations?select=id&limit=1');
    expect(options?.method).toBe('HEAD');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails on denied access without exposing remote errors', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 403 }));
    await expect(new SupabaseService().checkConnection()).rejects.toThrow('Falha na conexão');
  });

  it('sanitizes transport failures', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sensitive transport details'));
    await expect(new SupabaseService().checkConnection()).rejects.toThrow(
      'Falha na conexão Supabase. Verifique URL, chave, rede e permissões.',
    );
  });
});
