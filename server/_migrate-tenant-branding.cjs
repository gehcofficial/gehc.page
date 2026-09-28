/**
 * Idempotent (D3 — branding tema portal per unit pada `tenants`):
 *   brand_accent, brand_accent_2, brand_ink, logo_url, hero_image_url, theme_tone
 *
 * Jalankan: npm run db:migrate:tenant-branding[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const COLUMNS = [
  ['brand_accent', 'VARCHAR(20) NULL'],
  ['brand_accent_2', 'VARCHAR(20) NULL'],
  ['brand_ink', 'VARCHAR(20) NULL'],
  ['logo_url', 'TEXT NULL'],
  ['hero_image_url', 'TEXT NULL'],
  ['theme_tone', 'VARCHAR(20) NULL'],
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

  const [t] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'`,
  );
  if (!t.length) {
    console.log('tenants belum ada — dilewati.');
    await conn.end();
    return;
  }

  for (const [col, def] of COLUMNS) {
    const [c] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = ?`,
      [col],
    );
    if (c.length) {
      console.log(`tenants.${col} sudah ada`);
    } else {
      await conn.query(`ALTER TABLE \`tenants\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`✓ tenants.${col} ditambahkan`);
    }
  }

  await conn.end();
  console.log('✓ Selesai (D3).');
})().catch((e) => {
  console.error('Gagal migrasi branding tenant:', e?.message || e);
  process.exit(1);
});
