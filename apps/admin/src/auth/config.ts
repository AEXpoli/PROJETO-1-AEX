export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const api = process.env.API_URL;
  const site = process.env.ADMIN_SITE_URL;
  if (!url || !key?.startsWith('sb_publishable_') || !api || !site) throw new Error('Configuração administrativa incompleta.');
  for (const value of [url, api, site]) {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('URL inválida.');
    if ((value === url || process.env.NODE_ENV === 'production') && parsed.protocol !== 'https:') throw new Error('HTTPS obrigatório.');
  }
  return { url, key, api: api.replace(/\/$/, ''), site: site.replace(/\/$/, '') };
}

