/**
 * Idempotent (Serving Week — grup WA temporer + perwakilan, BOD Tim Kerja):
 *   serving_week_channels
 *
 * Jalankan: npm run db:migrate:serving-week[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`serving_week_channels\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_date\` DATE NOT NULL,
    \`cycle_index\` INT NULL,
    \`responsible_group_id\` VARCHAR(64) NULL,
    \`host_group_id\` VARCHAR(64) NULL,
    \`event_id\` VARCHAR(64) NULL,
    \`wa_url\` VARCHAR(500) NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    \`representative_ids\` JSON NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`closed_by_id\` VARCHAR(64) NULL,
    \`closed_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`serving_week_channels_event_date_key\`(\`event_date\`),
    INDEX \`serving_week_channels_status_event_date_idx\`(\`status\`, \`event_date\`),
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
  console.log('✓ Selesai (Serving Week: grup WA temporer).');
})().catch((e) => {
  console.error('Gagal migrasi serving-week:', e?.message || e);
  process.exit(1);
});
