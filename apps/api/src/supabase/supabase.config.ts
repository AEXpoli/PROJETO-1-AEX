export function readSupabaseConfig(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  secretKey: string;
} {
  const url = env.SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url) throw new Error('SUPABASE_URL é obrigatória.');
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (
      (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/'
    )
      throw new Error();
  } catch {
    throw new Error('SUPABASE_URL deve ser a URL HTTPS do projeto (HTTP somente local).');
  }
  if (!secretKey || !/^sb_secret_\S+$/.test(secretKey)) {
    throw new Error('SUPABASE_SECRET_KEY deve conter uma chave secreta sb_secret_ do backend.');
  }
  return { url, secretKey };
}
