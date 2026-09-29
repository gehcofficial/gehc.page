/**
 * Idempotent (landing unit — jadwal per unit pada `tenants`):
 *   schedules  JSON NULL   -- [{ label, day, time }]
 *
 * Jalankan: npm run db:migrate:tenant-schedules[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

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

  const [t] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'`,
  );
  if (!t.length) {
    console.log('tenants belum ada — dilewati.');
    await conn.end();
    return;
  }

  const [c] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'schedules'`,
  );
  if (c.length) {
    console.log('tenants.schedules sudah ada');
  } else {
    await conn.query('ALTER TABLE `tenants` ADD COLUMN `schedules` JSON NULL');
    console.log('✓ tenants.schedules ditambahkan');
  }

  await conn.end();
  console.log('✓ Selesai (landing unit: schedules).');
})().catch((e) => {
  console.error('Gagal migrasi schedules tenant:', e?.message || e);
  process.exit(1);
});
