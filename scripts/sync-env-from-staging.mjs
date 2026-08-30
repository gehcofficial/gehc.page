/**
 * Salin .env.staging → .env dengan override khusus lokal.
 * Jalankan: npm run env:sync
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const stagingPath = path.join(root, '.env.staging');
const envPath = path.join(root, '.env');

const LOCAL_OVERRIDES = {
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

function formatValue(value) {
  if (/[\s#"'=]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}

if (!fs.existsSync(stagingPath)) {
  console.error('❌ .env.staging tidak ditemukan.');
  console.error('   Salin .env.staging.example → .env.staging, isi secret, lalu jalankan lagi.');
  process.exit(1);
}

const staging = parseEnv(fs.readFileSync(stagingPath, 'utf8'));
const merged = new Map(staging);

for (const [key, value] of Object.entries(LOCAL_OVERRIDES)) {
  merged.set(key, value);
}

if (!merged.get('ENABLE_DEMO_PERSONAS')) {
  merged.set('ENABLE_DEMO_PERSONAS', 'true');
}

const header = `# Di-generate otomatis dari .env.staging + override lokal (${new Date().toISOString().slice(0, 10)})\n# Jalankan ulang: npm run env:sync\n\n`;
const body = [...merged.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `${key}=${formatValue(value)}`)
  .join('\n');

fs.writeFileSync(envPath, `${header}${body}\n`, 'utf8');

console.log('✓ .env dibuat dari .env.staging');
console.log('  Override lokal:', Object.keys(LOCAL_OVERRIDES).join(', '));
console.log('  ENABLE_DEMO_PERSONAS:', merged.get('ENABLE_DEMO_PERSONAS'));
console.log('\nLangkah berikutnya: npm run env:check && npm run dev');
