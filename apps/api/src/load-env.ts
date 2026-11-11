import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

export function loadApiEnv(): void {
  const path = resolve(__dirname, '../.env');
  if (existsSync(path)) loadEnvFile(path);
}
