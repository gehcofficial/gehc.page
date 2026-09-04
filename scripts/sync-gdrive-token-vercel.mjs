/**
 * Sync Drive owner OAuth to Vercel preview + production.
 * Token is the same for staging and prod; only GDRIVE_ROOT_FOLDER_ID differs.
 *
 *   npm run env:sync-gdrive-token
 *
 * Requires: npx vercel login
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvMap } from './env-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function refreshToken() {
  const fromEnv = process.env.GDRIVE_USER_REFRESH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const tokenPath = join(ROOT, '.gdrive-user-token.json');
  if (existsSync(tokenPath)) {
    try {
      const j = JSON.parse(readFileSync(tokenPath, 'utf8'));
      if (j.refresh_token) return String(j.refresh_token);
    } catch {
      /* ignore */
    }
  }
  return '';
}

function addEnv(key, val, target) {
  console.log(`> vercel env add ${key} ${target}`);
  execSync(`vercel env add ${key} ${target} --force`, {
    input: val,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

const token = refreshToken();
if (!token) {
  console.error('GDRIVE_USER_REFRESH_TOKEN tidak ada di .env atau .gdrive-user-token.json');
  console.error('Jalankan dulu: npm run drive:auth');
  process.exit(1);
}

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  console.error('GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET wajib di .env');
  process.exit(1);
}

const prodMap = readEnvMap(join(ROOT, '.env.production'));
const prodRoot = prodMap?.get('GDRIVE_ROOT_FOLDER_ID')?.trim();
const stagingRoot = process.env.GDRIVE_ROOT_FOLDER_ID?.trim();

for (const env of ['preview', 'production']) {
  addEnv('GDRIVE_USER_REFRESH_TOKEN', token, env);
  addEnv('GOOGLE_CLIENT_ID', clientId, env);
  addEnv('GOOGLE_CLIENT_SECRET', clientSecret, env);
}

if (prodRoot) {
  addEnv('GDRIVE_ROOT_FOLDER_ID', prodRoot, 'production');
  console.log('  Production GDRIVE_ROOT_FOLDER_ID → root prod (…' + prodRoot.slice(-6) + ')');
} else {
  console.warn('  .env.production tanpa GDRIVE_ROOT_FOLDER_ID — tidak diubah di Vercel Production.');
}

if (stagingRoot) {
  addEnv('GDRIVE_ROOT_FOLDER_ID', stagingRoot, 'preview');
  console.log('  Preview GDRIVE_ROOT_FOLDER_ID → root staging (…' + stagingRoot.slice(-6) + ')');
}

console.log('✓ Token Drive pemilik disalin ke Vercel preview + production (nilai sama).');
console.log('  Redeploy Production agar unggah foto profil/cover memakai Drive.');
