/**
 * Shared env parity config — dipakai env:sync, env:check, dev:staging.
 */
import fs from 'node:fs';

/** Variabel yang wajib di-override saat dev lokal (beda dari Vercel staging). */
export const LOCAL_OVERRIDES = {
  PORT: '8787',
  CORS_ORIGIN: 'http://localhost:8787,http://localhost:3000',
  APP_URL: 'http://localhost:8787',
};

/** Hanya di .env lokal — tidak disalin dari staging. */
export const LOCAL_ONLY_KEYS = ['PORT'];

/** Variabel staging URL — harus beda antara .env dan .env.staging. */
export const STAGING_URL_KEYS = ['APP_URL', 'CORS_ORIGIN'];

/** Harus identik antara .env dan .env.staging. */
export const SHARED_KEYS = [
  'DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SESSION_SECRET',
  'SUPERADMIN_EMAILS',
  'GDRIVE_ROOT_FOLDER_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GEMINI_API_KEY',
  'REGISTRATION_OPEN',
  'VITE_API_BASE_URL',
];

export function parseEnv(content) {
  const map = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

export function formatValue(value) {
  if (/[\s#"'=]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}

export function readEnvMap(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parseEnv(fs.readFileSync(filePath, 'utf8'));
}

export function writeEnvFile(filePath, envMap, headerLines = []) {
  const header = headerLines.length ? `${headerLines.join('\n')}\n\n` : '';
  const body = [...envMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join('\n');
  fs.writeFileSync(filePath, `${header}${body}\n`, 'utf8');
}

export function applyLocalOverrides(envMap) {
  for (const [key, value] of Object.entries(LOCAL_OVERRIDES)) {
    envMap.set(key, value);
  }
  return envMap;
}

export function looksLikeStagingDb(url = '') {
  const lower = url.toLowerCase();
  return lower.includes('staging') || lower.includes('gehc_staging') || lower.includes('youthgehc_staging');
}

export function looksLikeProductionDb(url = '') {
  const lower = url.toLowerCase();
  return (lower.includes('youthgehc') || lower.includes('gehc_prod') || lower.includes('/gehc?'))
    && !looksLikeStagingDb(url);
}

export function maskSecret(value) {
  if (!value) return '(kosong)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
