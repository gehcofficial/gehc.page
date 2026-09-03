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
  'login_username',
  'onboarding_path',
  'avatar_source',
];

const REQUIRED_TABLES = [
  'profile_church_data_requests',
  'recreational_suggestions',
  'org_nodes',
  'org_assignments',
  'waiting_pool',
  'platform_operators',
  'platform_admin_grants',
  'event_check_ins',
  'channel_links',
  'church_programs',
  'ministry_month_plans',
  'ministry_week_deliverables',
  'church_calendar_entries',
  'event_question_bank',
  'event_question_assignments',
  'event_question_answers',
];

const REQUIRED_WAITING_POOL_COLUMNS = [
  'domicile_kind',
  'domicile_detail',
  'claim_token',
  'event_checked_in_at',
  'event_checked_in_by_id',
];

/** Kolom di tabel selain users/waiting_pool yang boot-critical */
const REQUIRED_TABLE_COLUMNS = {
  event_attendees: ['checked_in_at', 'checked_in_by_id'],
  EventProgram: ['kind', 'church_program_id', 'event_date', 'venue_name', 'location_detail', 'map_url', 'map_embed_query'],
};

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

async function columnExists(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col],
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return rows.length > 0;
}

export async function checkDbSchema() {
  const conn = await getConnection();
  const missing = { columns: [], tables: [] };

  try {
    for (const col of REQUIRED_USER_COLUMNS) {
      if (!(await columnExists(conn, 'users', col))) missing.columns.push(`users.${col}`);
    }

    for (const table of REQUIRED_TABLES) {
      if (!(await tableExists(conn, table))) missing.tables.push(table);
    }

    for (const col of REQUIRED_WAITING_POOL_COLUMNS) {
      if (!(await columnExists(conn, 'waiting_pool', col))) missing.columns.push(`waiting_pool.${col}`);
    }

    for (const [table, cols] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
      if (!(await tableExists(conn, table))) {
        missing.tables.push(table);
        continue;
      }
      for (const col of cols) {
        if (!(await columnExists(conn, table, col))) missing.columns.push(`${table}.${col}`);
      }
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
