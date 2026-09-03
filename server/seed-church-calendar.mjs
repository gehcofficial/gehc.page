/**
 * Seed kalender gerejawi ke church_calendar_entries.
 *
 * Idempotent lewat unique key (tenant_id, source, name, start_date) —
 * aman dijalankan berulang, dan aman lintas tahun.
 *
 * Pakai mysql2 langsung (bukan Prisma) supaya bisa mengimpor church-year.mjs
 * dan tetap satu statement INSERT — TiDB Cloud memutus koneksi pada rentetan
 * query sekuensial.
 *
 * Usage:
 *   npm run db:seed:church-calendar            # tahun ini + tahun depan
 *   node server/seed-church-calendar.mjs 2026 2027 2028
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { churchYearEntries, findCollisions, TENANT_DEFAULT } from './lib/church-year.mjs';

const COLUMNS = [
  'id',
  'tenant_id',
  'start_date',
  'all_day',
  'level',
  'source',
  'season',
  'name',
  'name_en',
  'is_public',
];

function stableId(tenantId, source, name, startDate) {
  const hash = crypto.createHash('sha1').update(`${tenantId}|${source}|${name}|${startDate}`).digest('hex');
  return `ccal-${hash.slice(0, 24)}`;
}

function resolveYears(argv) {
  const explicit = argv.filter((a) => /^\d{4}$/.test(a)).map(Number);
  if (explicit.length) return [...new Set(explicit)].sort();
  const now = new Date().getUTCFullYear();
  return [now, now + 1];
}

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

async function main() {
  const years = resolveYears(process.argv.slice(2));
  const tenantId = process.env.TENANT_ID || TENANT_DEFAULT;

  const entries = years.flatMap((y) => churchYearEntries(y));
  if (!entries.length) {
    console.log('Tidak ada entri untuk di-seed.');
    return;
  }

  const rows = entries.map((e) => [
    stableId(tenantId, e.source, e.name, e.startDate),
    tenantId,
    e.startDate,
    1, // all_day — seluruh hari raya gerejawi bersifat sehari penuh
    e.level,
    e.source,
    e.season,
    e.name,
    e.nameEn || null,
    e.isPublic ? 1 : 0,
  ]);

  const conn = await getConnection();
  try {
    const sql = `
      INSERT INTO church_calendar_entries (${COLUMNS.join(', ')})
      VALUES ?
      ON DUPLICATE KEY UPDATE
        level = VALUES(level),
        season = VALUES(season),
        name_en = VALUES(name_en),
        is_public = VALUES(is_public),
        updated_at = CURRENT_TIMESTAMP(3)
    `;
    const [result] = await conn.query(sql, [rows]);
    console.log(`✓ ${rows.length} entri kalender untuk tahun ${years.join(', ')} (affected ${result.affectedRows})`);

    for (const year of years) {
      const collisions = findCollisions(churchYearEntries(year));
      for (const c of collisions) {
        console.log(`  ⚠ ${c.date} — ${c.entries.map((e) => e.name).join(' + ')}`);
      }
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
