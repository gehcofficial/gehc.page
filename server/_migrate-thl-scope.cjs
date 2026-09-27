/**
 * Idempotent (P3 — THL Stewardship + MDS):
 *   - service_roles.scope ENUM('UNIT','CHURCH') default UNIT
 *
 * Jalankan: npm run db:migrate:thl-scope[:staging|:prod]
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
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_roles'`,
  );
  if (!t.length) {
    console.log('service_roles belum ada — dilewati.');
    await conn.end();
    return;
  }

  const [c] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_roles' AND COLUMN_NAME = 'scope'`,
  );
  if (c.length) {
    console.log('service_roles.scope sudah ada');
  } else {
    await conn.query("ALTER TABLE `service_roles` ADD COLUMN `scope` ENUM('UNIT','CHURCH') NOT NULL DEFAULT 'UNIT'");
    console.log('✓ service_roles.scope ditambahkan');
  }

  // Tandai divisi THL sebagai CHURCH bila ada.
  const [r] = await conn.query(
    "UPDATE service_roles SET scope = 'CHURCH' WHERE UPPER(division) IN ('THL_STEWARDSHIP','THL_MDS') AND scope <> 'CHURCH'",
  );
  console.log(`divisi THL ditandai CHURCH: ${r.affectedRows}`);

  await conn.end();
  console.log('✓ Selesai (P3).');
})().catch((e) => {
  console.error('Gagal migrasi P3:', e?.message || e);
  process.exit(1);
});
