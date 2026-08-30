/**
 * Audit paritas .env (lokal) vs .env.staging (sumber staging).
 * Jalankan: npm run env:check
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  LOCAL_OVERRIDES,
  SHARED_KEYS,
  STAGING_URL_KEYS,
  readEnvMap,
  looksLikeStagingDb,
  looksLikeProductionDb,
  maskSecret,
} from './env-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stagingPath = path.join(root, '.env.staging');
const envPath = path.join(root, '.env');

let exitCode = 0;

if (!fs.existsSync(stagingPath)) {
  console.error('❌ .env.staging tidak ditemukan — salin dari .env.staging.example');
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error('❌ .env tidak ditemukan — jalankan: npm run env:sync');
  process.exit(1);
}

const staging = readEnvMap(stagingPath);
const local = readEnvMap(envPath);

console.log('=== Paritas shared (harus sama) ===\n');
for (const key of SHARED_KEYS) {
  const s = staging.get(key) ?? '';
  const l = local.get(key) ?? '';
  if (!s && !l) continue;
  if (s !== l) {
    console.log(`❌ ${key}`);
    console.log(`   .env.staging: ${maskSecret(s)}`);
    console.log(`   .env:         ${maskSecret(l)}`);
    exitCode = 1;
  } else {
    console.log(`✓  ${key}: ${maskSecret(s)}`);
  }
}

console.log('\n=== Override lokal (harus beda dari staging) ===\n');
for (const [key, expected] of Object.entries(LOCAL_OVERRIDES)) {
  const value = local.get(key) ?? '';
  const stagingValue = staging.get(key) ?? '';
  if (value === expected) {
    console.log(`✓  ${key}=${value}`);
  } else {
    console.log(`❌ ${key}: diharapkan "${expected}", dapat "${value || '(kosong)'}"`);
    exitCode = 1;
  }
  if (STAGING_URL_KEYS.includes(key) && value === stagingValue && stagingValue) {
    console.log(`   ⚠️  ${key} masih sama dengan .env.staging — OAuth/CORS lokal bisa gagal`);
    exitCode = 1;
  }
}

const demo = local.get('ENABLE_DEMO_PERSONAS');
if (demo !== 'true') {
  console.log('\n⚠️  ENABLE_DEMO_PERSONAS bukan true — login demo tech@gehc.demo tidak aktif');
  exitCode = 1;
}

const db = local.get('DATABASE_URL') ?? '';
if (!db) {
  console.log('\n❌ DATABASE_URL kosong');
  exitCode = 1;
} else if (looksLikeProductionDb(db)) {
  console.log('\n❌ DATABASE_URL terlihat production — lokal harus pakai cluster staging');
  exitCode = 1;
} else if (!looksLikeStagingDb(db)) {
  console.log('\n⚠️  DATABASE_URL tidak terlihat mengarah ke cluster staging');
}

const clientId = local.get('GOOGLE_CLIENT_ID') ?? '';
if (!clientId) {
  console.log('\n⚠️  GOOGLE_CLIENT_ID kosong — Google SSO nonaktif (demo login masih OK)');
}

if (exitCode === 0) {
  console.log('\n✓ Paritas OK — npm run dev siap dijalankan');
} else {
  console.log('\n❌ Ada masalah — jalankan: npm run env:sync');
}

process.exit(exitCode);
