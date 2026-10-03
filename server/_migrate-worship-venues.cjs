/**
 * Idempotent (F5.3 — Tempat pos pola ibadah, Didaskalia):
 *   worship_venues
 *
 * Jalankan: npm run db:migrate:worship-venues[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`worship_venues\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`code\` VARCHAR(24) NOT NULL,
    \`name\` VARCHAR(150) NOT NULL,
    \`capacity\` INT NOT NULL DEFAULT 0,
    \`kind\` VARCHAR(16) NOT NULL DEFAULT 'LANTAI',
    \`note\` VARCHAR(500) NULL,
    \`is_active\` BOOLEAN NOT NULL DEFAULT true,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`worship_venues_code_key\`(\`code\`),
    INDEX \`worship_venues_is_active_sort_order_idx\`(\`is_active\`, \`sort_order\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
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

  for (const ddl of DDL) {
    const name = /`([a-z_]+)`/.exec(ddl)?.[1] || '?';
    const [t] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [name],
    );
    if (t.length) {
      console.log(`tabel ${name} sudah ada`);
      continue;
    }
    await conn.query(ddl);
    console.log(`✓ tabel ${name} dibuat`);
  }

  await conn.end();
  console.log('✓ Selesai (F5.3: tempat pos pola ibadah).');
})().catch((e) => {
  console.error('Gagal migrasi worship-venues:', e?.message || e);
  process.exit(1);
});
