/**
 * Idempotent: tabel P1 — Fasilitas & Keuangan (portal jemaat).
 *   facilities, facility_bookings, maintenance_logs,
 *   cash_accounts, cash_transactions, funding_requests, distributions
 *
 * Jalankan: npm run db:migrate:church-p1[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`facilities\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`code\` VARCHAR(40) NOT NULL,
    \`name\` VARCHAR(150) NOT NULL,
    \`kind\` ENUM('GEDUNG','RUANG','ALAT') NOT NULL,
    \`capacity\` INT NULL,
    \`location\` VARCHAR(190) NULL,
    \`hourly_rate\` DECIMAL(12,2) NULL,
    \`daily_rate\` DECIMAL(12,2) NULL,
    \`is_active\` BOOLEAN NOT NULL DEFAULT true,
    \`notes\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`facilities_code_key\`(\`code\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`facility_bookings\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`facility_id\` VARCHAR(64) NOT NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`purpose\` TEXT NULL,
    \`unit\` VARCHAR(40) NOT NULL,
    \`requester_user_id\` VARCHAR(64) NOT NULL,
    \`contact_phone\` VARCHAR(40) NULL,
    \`start_at\` DATETIME(3) NOT NULL,
    \`end_at\` DATETIME(3) NOT NULL,
    \`status\` ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED','DONE','CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    \`rate_amount\` DECIMAL(12,2) NOT NULL DEFAULT 0,
    \`invoice_no\` VARCHAR(60) NULL,
    \`invoice_issued_at\` DATETIME(3) NULL,
    \`paid_at\` DATETIME(3) NULL,
    \`paid_amount\` DECIMAL(12,2) NULL,
    \`approver_id\` VARCHAR(64) NULL,
    \`approved_at\` DATETIME(3) NULL,
    \`reject_reason\` TEXT NULL,
    \`notes\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`facility_bookings_facility_id_start_at_idx\`(\`facility_id\`, \`start_at\`),
    INDEX \`facility_bookings_status_idx\`(\`status\`),
    INDEX \`facility_bookings_requester_user_id_idx\`(\`requester_user_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`maintenance_logs\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`facility_id\` VARCHAR(64) NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`description\` TEXT NULL,
    \`vendor\` VARCHAR(150) NULL,
    \`cost_amount\` DECIMAL(12,2) NOT NULL DEFAULT 0,
    \`spent_at\` DATETIME(3) NOT NULL,
    \`unit\` VARCHAR(40) NOT NULL,
    \`drive_folder_id\` VARCHAR(120) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`maintenance_logs_spent_at_idx\`(\`spent_at\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`cash_accounts\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`code\` VARCHAR(40) NOT NULL,
    \`name\` VARCHAR(150) NOT NULL,
    \`unit\` VARCHAR(40) NOT NULL,
    \`kind\` ENUM('KAS_GEREJA','KAS_UNIT','PETTY_CASH') NOT NULL,
    \`opening_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0,
    \`is_active\` BOOLEAN NOT NULL DEFAULT true,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`cash_accounts_code_key\`(\`code\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`cash_transactions\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`account_id\` VARCHAR(64) NOT NULL,
    \`direction\` ENUM('IN','OUT') NOT NULL,
    \`amount\` DECIMAL(14,2) NOT NULL,
    \`category\` VARCHAR(60) NOT NULL,
    \`unit\` VARCHAR(40) NULL,
    \`ref_type\` ENUM('BOOKING','BZP_SALE','FUNDING','MANUAL') NULL,
    \`ref_id\` VARCHAR(64) NULL,
    \`description\` TEXT NULL,
    \`occurred_at\` DATETIME(3) NOT NULL,
    \`created_by_id\` VARCHAR(64) NOT NULL,
    \`approved_by_id\` VARCHAR(64) NULL,
    \`approved_at\` DATETIME(3) NULL,
    \`proof_file_id\` VARCHAR(120) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`cash_transactions_account_id_occurred_at_idx\`(\`account_id\`, \`occurred_at\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`funding_requests\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`unit\` VARCHAR(40) NOT NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`description\` TEXT NULL,
    \`amount\` DECIMAL(14,2) NOT NULL,
    \`needed_by\` DATETIME(3) NULL,
    \`status\` ENUM('SUBMITTED','APPROVED','REJECTED','DISBURSED','SETTLED') NOT NULL DEFAULT 'SUBMITTED',
    \`requester_user_id\` VARCHAR(64) NOT NULL,
    \`approver_user_id\` VARCHAR(64) NULL,
    \`approved_at\` DATETIME(3) NULL,
    \`reject_reason\` TEXT NULL,
    \`disbursed_at\` DATETIME(3) NULL,
    \`account_id\` VARCHAR(64) NULL,
    \`settle_note\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`funding_requests_status_idx\`(\`status\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`distributions\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`source_type\` ENUM('BZP_CAMPAIGN','BZP_SALES','DONATION','OTHER') NOT NULL,
    \`source_ref\` VARCHAR(64) NULL,
    \`target_unit\` VARCHAR(40) NOT NULL,
    \`amount\` DECIMAL(14,2) NOT NULL,
    \`status\` ENUM('PROPOSED','APPROVED','PAID') NOT NULL DEFAULT 'PROPOSED',
    \`decided_by_user_id\` VARCHAR(64) NOT NULL,
    \`decided_at\` DATETIME(3) NULL,
    \`note\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`distributions_status_idx\`(\`status\`),
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

  for (const sql of DDL) {
    const name = (sql.match(/`([a-z_]+)`/) || [])[1] || '?';
    try {
      await conn.query(sql);
      console.log(`✓ ${name}`);
    } catch (e) {
      console.warn(`! ${name}: ${e.message}`);
    }
  }

  await conn.end();
  console.log('✓ Selesai (P1).');
})().catch((e) => {
  console.error('Gagal migrasi P1:', e?.message || e);
  process.exit(1);
});
