/**
 * Idempotent (Creative Lab — update karya per kelompok):
 *   worship_lab_updates
 *
 * Jalankan: npm run db:migrate:worship-lab[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`worship_lab_updates\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`session_id\` VARCHAR(64) NOT NULL,
    \`team_index\` INT NOT NULL,
    \`team_name\` VARCHAR(80) NOT NULL,
    \`user_id\` VARCHAR(64) NOT NULL,
    \`kind\` VARCHAR(12) NOT NULL,
    \`body\` TEXT NULL,
    \`progress\` INT NULL,
    \`photo_file_id\` VARCHAR(128) NULL,
    \`photo_url\` VARCHAR(500) NULL,
    \`thumb_url\` VARCHAR(500) NULL,
    \`acknowledged_at\` DATETIME(3) NULL,
    \`acknowledged_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`worship_lab_updates_session_team_created_idx\`(\`session_id\`, \`team_index\`, \`created_at\`),
    INDEX \`worship_lab_updates_session_kind_created_idx\`(\`session_id\`, \`kind\`, \`created_at\`),
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
  console.log('✓ Selesai (Creative Lab: update karya kelompok).');
})().catch((e) => {
  console.error('Gagal migrasi worship lab:', e?.message || e);
  process.exit(1);
});
