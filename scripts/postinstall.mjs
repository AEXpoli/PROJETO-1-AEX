import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL === '1') {
  console.log('[postinstall] Ambiente Vercel detectado: patch-package ignorado.');
  process.exit(0);
}

const patchPackageBin = process.platform === 'win32'
  ? 'node_modules/.bin/patch-package.cmd'
  : 'node_modules/.bin/patch-package';

if (!existsSync(patchPackageBin)) {
  console.log('[postinstall] patch-package não encontrado; nenhuma correção aplicada.');
  process.exit(0);
}

console.log('[postinstall] Aplicando patches de dependências...');
run('npm', ['run', 'patch:dependencies']);
