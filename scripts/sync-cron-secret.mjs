/**
 * Set CRON_SECRET untuk Vercel (Production + Preview) + catat di .env lokal.
 *
 * Vercel Cron otomatis mengirim header `Authorization: Bearer <CRON_SECRET>`
 * ke endpoint `/api/cron/*` bila env CRON_SECRET ada di project.
 *
 * Prasyarat: `vercel login` (sekali) dan repo tertaut (`vercel link`).
 *
 *   npm run env:sync-cron-secret
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

let envText = '';
try { envText = fs.readFileSync(envPath, 'utf8'); } catch { envText = ''; }

const existing = envText.match(/^CRON_SECRET=(.+)$/m)?.[1]?.trim();
const secret = existing || crypto.randomBytes(24).toString('hex');

if (existing) {
  console.log('CRON_SECRET sudah ada di .env — memakai nilai yang sama (tidak memutar ulang).');
} else {
  if (envText.includes('CRON_SECRET=')) {
    envText = envText.replace(/^CRON_SECRET=.*$/m, `CRON_SECRET=${secret}`);
  } else {
    envText += `${envText.endsWith('\n') || envText === '' ? '' : '\n'}\n# Vercel Cron — header Authorization: Bearer <ini>\nCRON_SECRET=${secret}\n`;
  }
  fs.writeFileSync(envPath, envText, 'utf8');
  console.log('CRON_SECRET ditulis ke .env');
}

for (const env of ['preview', 'production']) {
  console.log(`> vercel env add CRON_SECRET ${env}`);
  try {
    execSync(`vercel env add CRON_SECRET ${env} --force`, {
      cwd: root,
      input: secret,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } catch (e) {
    console.error(`Gagal set CRON_SECRET untuk ${env}. Pastikan sudah \`vercel login\`.`);
    process.exit(1);
  }
}

console.log('✓ CRON_SECRET tersinkron ke Vercel preview + production.');
console.log('  Lakukan redeploy (push commit atau "Redeploy" di Vercel) agar berlaku.');
