/**
 * CLI prod: arahkan DATABASE_URL ke cluster/branch production (bukan staging).
 * Prioritas selaras Vercel + cloud agent: PRODUCTION → MAIN → PRD.
 *
 * Preload: node -r ./server/_production-database-url.cjs …
 */
function pickProductionDatabaseUrl() {
  return (
    process.env.DATABASE_URL_PRODUCTION
    || process.env.DATABASE_URL_MAIN
    || process.env.DATABASE_URL_PRD
    || ''
  );
}

function applyProductionDatabaseUrl() {
  const prod = pickProductionDatabaseUrl();
  if (!prod) return { applied: false, source: null };
  process.env.DATABASE_URL = prod;
  if (!process.env.GEHC_ENV) process.env.GEHC_ENV = 'production';
  const source = process.env.DATABASE_URL_PRODUCTION
    ? 'DATABASE_URL_PRODUCTION'
    : process.env.DATABASE_URL_MAIN
      ? 'DATABASE_URL_MAIN'
      : 'DATABASE_URL_PRD';
  return { applied: true, source };
}

const result = applyProductionDatabaseUrl();
if (result.applied) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    const db = u.pathname.replace(/^\//, '').split('?')[0];
    console.log(`[prod-db] DATABASE_URL ← ${result.source} (${u.hostname}/${db})`);
  } catch {
    console.log(`[prod-db] DATABASE_URL ← ${result.source}`);
  }
} else {
  console.warn('[prod-db] DATABASE_URL_PRODUCTION/MAIN/PRD tidak ada — pakai DATABASE_URL yang sudah di env (pastikan bukan staging).');
}

module.exports = { pickProductionDatabaseUrl, applyProductionDatabaseUrl };
