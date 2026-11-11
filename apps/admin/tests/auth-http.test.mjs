import assert from 'node:assert/strict';
import test from 'node:test';

// Start an isolated Next dev server with the fictitious env described in AUTH.md.
const origin = process.env.AEX_ADMIN_TEST_URL;
test('páginas públicas e proteção real das rotas Next sem sessão', { skip: !origin }, async () => {
  const login = await fetch(`${origin}/login`);
  const html = await login.text();
  assert.equal(login.status, 200);
  assert.match(html, /Acesso administrativo/);
  assert.match(html, /name="password"/);
  assert.match(login.headers.get('cache-control'), /no-store/);
  assert.equal(login.headers.get('referrer-policy'), 'no-referrer');
  assert.doesNotMatch(html, /sb_secret_|service_role/);
  for (const path of ['/', '/participantes', '/resultados', '/simulacoes', '/convites']) {
    const page = await fetch(`${origin}${path}`, { redirect: 'manual' });
    const body = await page.text();
    const destination = page.headers.get('location') ?? body;
    assert.match(destination, /\/login\?reason=session/, path);
    assert.doesNotMatch(body, /Resultados por exercício|Convidar administrador<\/h1>/);
  }
  const invalid = await fetch(`${origin}/auth/confirm?type=invite&invitation_id=invalid&token_hash=invalid`);
  assert.match(await invalid.text(), /convite está incompleto ou inválido/);
  const recovery = await fetch(`${origin}/esqueci-minha-senha`);
  assert.match(await recovery.text(), /Recuperar senha/);
  const expired = await fetch(`${origin}/auth/callback?error=access_denied`, { redirect: 'manual' });
  assert.match(expired.headers.get('location'), /\/auth\/erro$/);
});
