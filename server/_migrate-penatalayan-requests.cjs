/**
 * Idempotent: flag wajib/opsional role penatalayan + antrean request ke divisi.
 *   service_roles.is_required (default true = wajib)
 *   service_role_requests (PENDING → FULFILLED / CANCELLED)
 *
 * Jalankan: npm run db:migrate:penatalayan-requests[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function ensureColumn(conn, table, column, ddl) {
  try {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS \`${column}\` ${ddl}`);
  } catch {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    if (!cols.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
  }
  console.log(`${table}.${column} OK`);
}

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

  await ensureColumn(conn, 'service_roles', 'is_required', 'BOOLEAN NOT NULL DEFAULT true');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS service_role_requests (
      \`id\` VARCHAR(64) NOT NULL,
      \`service_role_id\` VARCHAR(64) NOT NULL,
      \`event_id\` VARCHAR(64) NULL,
      \`date\` DATE NOT NULL,
      \`requester_id\` VARCHAR(64) NOT NULL,
      \`note\` TEXT NULL,
      \`status\` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      \`fulfilled_schedule_id\` VARCHAR(64) NULL,
      \`decided_by_id\` VARCHAR(64) NULL,
      \`decided_at\` DATETIME(3) NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`service_role_requests_role_date_idx\` (\`service_role_id\`, \`date\`),
      INDEX \`service_role_requests_status_idx\` (\`status\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
  console.log('service_role_requests OK');

  await conn.end();
  console.log('✓ Selesai (penatalayan requests).');
})().catch((e) => {
  console.error('Gagal migrasi penatalayan-requests:', e?.message || e);
  process.exit(1);
});
