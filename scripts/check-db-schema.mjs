/**
 * Cek kolom/tabel wajib di TiDB vs kebutuhan Prisma saat ini.
 * Read-only — tidak mengubah database.
 *
 * Usage:
 *   npm run db:schema:check
 *   node scripts/check-db-schema.mjs --quiet   # exit 1 tanpa log panjang
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

/** Kolom users yang sering menyebabkan error auth/API jika belum dimigrasi */
const REQUIRED_USER_COLUMNS = [
  'major_other',
  'work_industry',
  'work_role',
  'birth_date',
  'membership_kind',
  'domicile_kind',
  'domicile_detail',
];

const REQUIRED_TABLES = [
  'profile_church_data_requests',
  'recreational_suggestions',
  'org_nodes',
  'org_assignments',
  'waiting_pool',
];

const REQUIRED_WAITING_POOL_COLUMNS = ['domicile_kind', 'domicile_detail', 'claim_token'];

const quiet = process.argv.includes('--quiet');

async function getConnection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL tidak dikonfigurasi');
  const u = new URL(raw);
  return mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
}

export async function checkDbSchema() {
  const conn = await getConnection();
  const missing = { columns: [], tables: [] };

  try {
    for (const col of REQUIRED_USER_COLUMNS) {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [col],
      );
      if (!rows.length) missing.columns.push(`users.${col}`);
    }

    for (const table of REQUIRED_TABLES) {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      );
      if (!rows.length) missing.tables.push(table);
    }

    for (const col of REQUIRED_WAITING_POOL_COLUMNS) {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'waiting_pool' AND COLUMN_NAME = ?`,
        [col],
      );
      if (!rows.length) missing.columns.push(`waiting_pool.${col}`);
    }
  } finally {
    await conn.end();
  }

  return missing;
}

async function main() {
  let missing;
  try {
    missing = await checkDbSchema();
  } catch (err) {
    if (!quiet) console.error(`❌ Tidak bisa cek schema: ${err.message}`);
    process.exit(1);
  }

  const hasIssues = missing.columns.length > 0 || missing.tables.length > 0;

  if (!hasIssues) {
    if (!quiet) console.log('✓ Schema DB sinkron (kolom & tabel wajib ada).');
    process.exit(0);
  }

  if (!quiet) {
    console.log('⚠️  Database schema belum sinkron dengan Prisma:\n');
    for (const c of missing.columns) console.log(`   - kolom hilang: ${c}`);
    for (const t of missing.tables) console.log(`   - tabel hilang: ${t}`);
    console.log('\n   Perbaikan: npm run db:migrate:local');
    console.log('   Lalu restart: npm run dev:all\n');
  }

  process.exit(1);
}

const isDirectRun = process.argv[1]?.includes('check-db-schema');
if (isDirectRun) {
  main();
}
