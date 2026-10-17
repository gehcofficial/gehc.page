/**
 * Idempotent: flag wajib/opsional role penatalayan + antrean request ke divisi.
 *   service_roles.is_required (default true = wajib)
 *   service_role_requests (PENDING → FULFILLED / CANCELLED)
 *   + usulan mentor: proposed_user_id + batch_id (multi-role x multi-people)
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

  await ensureColumn(conn, 'service_role_requests', 'proposed_user_id', 'VARCHAR(64) NULL');
  await ensureColumn(conn, 'service_role_requests', 'batch_id', 'VARCHAR(64) NULL');
  try {
    await conn.query('CREATE INDEX IF NOT EXISTS `service_role_requests_proposed_idx` ON `service_role_requests` (`service_role_id`, `date`, `proposed_user_id`)');
  } catch {
    try { await conn.query('CREATE INDEX `service_role_requests_proposed_idx` ON `service_role_requests` (`service_role_id`, `date`, `proposed_user_id`)'); } catch { /* sudah ada */ }
  }
  try {
    await conn.query('CREATE INDEX IF NOT EXISTS `service_role_requests_batch_idx` ON `service_role_requests` (`status`, `batch_id`)');
  } catch {
    try { await conn.query('CREATE INDEX `service_role_requests_batch_idx` ON `service_role_requests` (`status`, `batch_id`)'); } catch { /* sudah ada */ }
  }
  console.log('service_role_requests usulan (proposed_user_id, batch_id) OK');

  await conn.end();
  console.log('✓ Selesai (penatalayan requests).');
})().catch((e) => {
  console.error('Gagal migrasi penatalayan-requests:', e?.message || e);
  process.exit(1);
});
