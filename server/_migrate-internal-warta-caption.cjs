/**
 * Idempotent: tambah kolom `caption` pada internal_warta.
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
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'internal_warta'`,
  );
  if (!t.length) {
    console.log('internal_warta belum ada — dilewati (jalankan migrasi utama dulu).');
    await conn.end();
    return;
  }
  const [c] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'internal_warta' AND COLUMN_NAME = 'caption'`,
  );
  if (c.length) {
    console.log('internal_warta.caption sudah ada');
  } else {
    await conn.query('ALTER TABLE `internal_warta` ADD COLUMN `caption` TEXT NULL AFTER `category`');
    console.log('internal_warta.caption ditambahkan');
  }

  await conn.end();
  console.log('✓ Selesai.');
})().catch((e) => {
  console.error('Gagal migrasi caption:', e?.message || e);
  process.exit(1);
});
