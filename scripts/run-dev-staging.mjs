/**
 * Jalankan server dev memakai secret .env.staging + override localhost.
 * Cross-platform (hindari masalah comma di dotenv-cli Windows).
 * Jalankan: npm run dev:staging
 */
import fs from 'node:fs';
import path from 'node:path';
import { applyLocalOverrides, readEnvMap } from './env-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stagingPath = path.join(root, '.env.staging');

if (!fs.existsSync(stagingPath)) {
  console.error('❌ .env.staging tidak ditemukan — salin dari .env.staging.example');
  process.exit(1);
}

const env = applyLocalOverrides(new Map(readEnvMap(stagingPath)));
for (const [key, value] of env) {
  process.env[key] = value;
}

console.log('dev:staging → secret dari .env.staging + override localhost (PORT/CORS/APP_URL)\n');
await import('../server/index.mjs');
