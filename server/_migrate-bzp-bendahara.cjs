/**
 * Idempotent (P2 — BZP di bawah Bendahara):
 *   - bzp_settings.petty_cash_allowance_account_id
 *   - campaigns.funding_request_id
 *
 * Jalankan: npm run db:migrate:bzp-bendahara[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const COLUMNS = [
  ['bzp_settings', 'petty_cash_allowance_account_id', 'VARCHAR(64) NULL'],
  ['campaigns', 'funding_request_id', 'VARCHAR(64) NULL'],
];

(async () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  for (const [table, column, def] of COLUMNS) {
    const [t] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    if (!t.length) {
      console.log(`! ${table} belum ada — dilewati.`);
      continue;
    }
    const [c] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    if (c.length) {
      console.log(`${table}.${column} sudah ada`);
    } else {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
      console.log(`✓ ${table}.${column} ditambahkan`);
    }
  }

  await conn.end();
  console.log('✓ Selesai (P2).');
})().catch((e) => {
  console.error('Gagal migrasi P2:', e?.message || e);
  process.exit(1);
});
