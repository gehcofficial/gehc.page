/**
 * Audit paritas .env (lokal) vs .env.staging (sumber staging).
 * Jalankan: npm run env:check
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const stagingPath = path.join(root, '.env.staging');
const envPath = path.join(root, '.env');

const SHARED_KEYS = [
  'DATABASE_URL',
  'ENABLE_DEMO_PERSONAS',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SESSION_SECRET',
  'SUPERADMIN_EMAILS',
  'GDRIVE_ROOT_FOLDER_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GEMINI_API_KEY',
  'REGISTRATION_OPEN',
  'VITE_API_BASE_URL',
];

const LOCAL_EXPECTED = {
  PORT: '8787',
  CORS_ORIGIN: 'http://localhost:8787,http://localhost:3000',
  APP_URL: 'http://localhost:8787',
};

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function mask(value) {
  if (!value) return '(kosong)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

let exitCode = 0;

if (!fs.existsSync(stagingPath)) {
  console.error('❌ .env.staging tidak ditemukan — salin dari .env.staging.example');
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error('❌ .env tidak ditemukan — jalankan: npm run env:sync');
  process.exit(1);
}

const staging = parseEnv(fs.readFileSync(stagingPath, 'utf8'));
const local = parseEnv(fs.readFileSync(envPath, 'utf8'));

console.log('=== Paritas shared (harus sama) ===\n');
for (const key of SHARED_KEYS) {
  const s = staging.get(key) ?? '';
  const l = local.get(key) ?? '';
  if (!s && !l) continue;
  if (s !== l) {
    console.log(`❌ ${key}`);
    console.log(`   .env.staging: ${mask(s)}`);
    console.log(`   .env:         ${mask(l)}`);
    exitCode = 1;
  } else {
    console.log(`✓  ${key}: ${mask(s)}`);
  }
}

console.log('\n=== Override lokal (harus beda dari staging) ===\n');
for (const [key, expected] of Object.entries(LOCAL_EXPECTED)) {
  const value = local.get(key) ?? '';
  if (value === expected) {
    console.log(`✓  ${key}=${value}`);
  } else {
    console.log(`⚠️  ${key}: diharapkan "${expected}", dapat "${value || '(kosong)'}"`);
    if (key === 'PORT' || key === 'CORS_ORIGIN' || key === 'APP_URL') exitCode = 1;
  }
}

const demo = local.get('ENABLE_DEMO_PERSONAS');
if (demo !== 'true') {
  console.log('\n⚠️  ENABLE_DEMO_PERSONAS bukan true — login demo tech@gehc.demo tidak aktif');
}

const db = local.get('DATABASE_URL') ?? '';
if (db && !db.includes('staging') && !db.includes('gehc_staging')) {
  console.log('\n⚠️  DATABASE_URL tidak terlihat mengarah ke cluster staging');
}

if (exitCode === 0) {
  console.log('\n✓ Paritas OK — npm run dev siap dijalankan');
} else {
  console.log('\n❌ Ada perbedaan — jalankan: npm run env:sync');
}

process.exit(exitCode);
