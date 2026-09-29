/**
 * Idempotent (F5 — Pola Ibadah & Mentoring Day, Didaskalia):
 *   worship_patterns, worship_sessions, worship_likert_items,
 *   worship_likert_responses, worship_chips, worship_chip_votes
 *
 * Jalankan: npm run db:migrate:worship[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`worship_patterns\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`code\` VARCHAR(40) NOT NULL,
    \`name\` VARCHAR(150) NOT NULL,
    \`summary\` TEXT NULL,
    \`owner_division\` VARCHAR(24) NOT NULL DEFAULT 'DIDASKALIA',
    \`default_duration_min\` INT NULL,
    \`phases\` JSON NULL,
    \`modules\` JSON NULL,
    \`playbook\` MEDIUMTEXT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    \`sort_order\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`worship_patterns_code_key\`(\`code\`),
    INDEX \`worship_patterns_status_sort_order_idx\`(\`status\`, \`sort_order\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`worship_sessions\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`pattern_id\` VARCHAR(64) NOT NULL,
    \`slug\` VARCHAR(80) NOT NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`event_id\` VARCHAR(64) NULL,
    \`tenant_id\` VARCHAR(64) NOT NULL DEFAULT 'tenant-youth',
    \`session_date\` DATE NULL,
    \`status\` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    \`access_code\` VARCHAR(12) NULL,
    \`config\` JSON NULL,
    \`likert_opened_at\` DATETIME(3) NULL,
    \`started_at\` DATETIME(3) NULL,
    \`wrap_up_at\` DATETIME(3) NULL,
    \`closed_at\` DATETIME(3) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`worship_sessions_slug_key\`(\`slug\`),
    INDEX \`worship_sessions_tenant_id_status_idx\`(\`tenant_id\`, \`status\`),
    INDEX \`worship_sessions_pattern_id_idx\`(\`pattern_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`worship_likert_items\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`session_id\` VARCHAR(64) NOT NULL,
    \`topic_code\` VARCHAR(40) NOT NULL,
    \`text\` TEXT NOT NULL,
    \`gospel_note\` TEXT NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`worship_likert_items_session_id_topic_code_sort_order_idx\`(\`session_id\`, \`topic_code\`, \`sort_order\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`worship_likert_responses\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`session_id\` VARCHAR(64) NOT NULL,
    \`user_id\` VARCHAR(64) NOT NULL,
    \`item_id\` VARCHAR(64) NOT NULL,
    \`topic_code\` VARCHAR(40) NOT NULL,
    \`value\` INT NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`worship_likert_responses_session_id_user_id_item_id_key\`(\`session_id\`, \`user_id\`, \`item_id\`),
    INDEX \`worship_likert_responses_session_id_topic_code_idx\`(\`session_id\`, \`topic_code\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`worship_chips\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`session_id\` VARCHAR(64) NOT NULL,
    \`code\` VARCHAR(40) NOT NULL,
    \`label\` VARCHAR(80) NOT NULL,
    \`topic_code\` VARCHAR(40) NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    \`is_active\` BOOLEAN NOT NULL DEFAULT true,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`worship_chips_session_id_code_key\`(\`session_id\`, \`code\`),
    INDEX \`worship_chips_session_id_sort_order_idx\`(\`session_id\`, \`sort_order\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`worship_chip_votes\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`session_id\` VARCHAR(64) NOT NULL,
    \`user_id\` VARCHAR(64) NOT NULL,
    \`chip_code\` VARCHAR(40) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`worship_chip_votes_session_id_user_id_chip_code_key\`(\`session_id\`, \`user_id\`, \`chip_code\`),
    INDEX \`worship_chip_votes_session_id_chip_code_idx\`(\`session_id\`, \`chip_code\`),
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
  console.log('✓ Selesai (F5: pola ibadah & mentoring).');
})().catch((e) => {
  console.error('Gagal migrasi worship:', e?.message || e);
  process.exit(1);
});
