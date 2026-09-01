/**
 * Salin .env.staging → .env dengan override khusus lokal.
 * Jalankan: npm run env:sync
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  applyLocalOverrides,
  looksLikeProductionDb,
  readEnvMap,
  writeEnvFile,
  LOCAL_OVERRIDES,
} from './env-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stagingPath = path.join(root, '.env.staging');
const envPath = path.join(root, '.env');

if (!fs.existsSync(stagingPath)) {
  console.error('❌ .env.staging tidak ditemukan.');
  console.error('   Salin .env.staging.example → .env.staging, isi secret, lalu jalankan lagi.');
  process.exit(1);
}

const staging = readEnvMap(stagingPath);
const dbUrl = staging.get('DATABASE_URL') ?? '';

if (dbUrl && looksLikeProductionDb(dbUrl)) {
  console.error('❌ DATABASE_URL di .env.staging terlihat production — sync dibatalkan.');
  console.error('   Lokal harus mengarah ke branch staging (gehc_staging / youthgehc_staging).');
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.copyFileSync(envPath, path.join(root, `.env.backup.${stamp}`));
}

const merged = applyLocalOverrides(new Map(staging));

writeEnvFile(envPath, merged, [
  `# Di-generate otomatis dari .env.staging + override lokal (${new Date().toISOString().slice(0, 10)})`,
  '# Jalankan ulang: npm run env:sync',
  `# Backup sebelumnya: .env.backup.* (gitignored)`,
]);

console.log('✓ .env dibuat dari .env.staging');
if (fs.readdirSync(root).some((f) => f.startsWith('.env.backup.'))) {
  console.log('  Backup .env lama disimpan sebagai .env.backup.*');
}
console.log('  Override lokal:', Object.keys(LOCAL_OVERRIDES).join(', '));
console.log('\nLangkah berikutnya: npm run env:check && npm run dev');
