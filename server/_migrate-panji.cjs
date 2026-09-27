/**
 * Idempotent (P4 — Panji Yosua): tabel `incident_logs`.
 *
 * Jalankan: npm run db:migrate:panji[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = `CREATE TABLE IF NOT EXISTS \`incident_logs\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`title\` VARCHAR(200) NOT NULL,
  \`category\` VARCHAR(60) NOT NULL DEFAULT 'LAIN',
  \`severity\` VARCHAR(20) NOT NULL DEFAULT 'RINGAN',
  \`occurred_at\` DATETIME(3) NOT NULL,
  \`location\` VARCHAR(190) NULL,
  \`description\` TEXT NULL,
  \`action_taken\` TEXT NULL,
  \`reporter_user_id\` VARCHAR(64) NULL,
  \`event_id\` VARCHAR(64) NULL,
  \`status\` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  \`handled_by_id\` VARCHAR(64) NULL,
  \`handled_at\` DATETIME(3) NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX \`incident_logs_status_occurred_at_idx\`(\`status\`, \`occurred_at\`),
  INDEX \`incident_logs_event_id_idx\`(\`event_id\`),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

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
  await conn.query(DDL);
  console.log('✓ incident_logs siap');
  await conn.end();
})().catch((e) => {
  console.error('Gagal migrasi P4:', e?.message || e);
  process.exit(1);
});
