/**
 * Idempotent (Sprint A — Marturia & Diakonia):
 *   marturia_shotlist, marturia_assets, marturia_asset_versions,
 *   marturia_souls, marturia_referrals,
 *   diakonia_event_checks, diakonia_transport,
 *   diakonia_cases, diakonia_visits, diakonia_kost
 *
 * Jalankan: npm run db:migrate:marturia-diakonia-a[:staging|:prod]
 * Prisma models: prisma/schema.prisma (§ Sprint A).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`marturia_shotlist\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`item\` VARCHAR(300) NOT NULL,
    \`sort_order\` INT NOT NULL DEFAULT 0,
    \`done\` BOOLEAN NOT NULL DEFAULT false,
    \`done_by_id\` VARCHAR(64) NULL,
    \`assignee_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`marturia_shotlist_event_id_sort_order_idx\`(\`event_id\`, \`sort_order\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`marturia_assets\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`brief\` TEXT NULL,
    \`requester_division\` VARCHAR(24) NOT NULL DEFAULT 'KOINONIA',
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'DIMINTA',
    \`handoff_to\` VARCHAR(24) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`marturia_assets_event_id_status_idx\`(\`event_id\`, \`status\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`marturia_asset_versions\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`asset_id\` VARCHAR(64) NOT NULL,
    \`url\` TEXT NOT NULL,
    \`note\` VARCHAR(500) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`marturia_asset_versions_asset_id_idx\`(\`asset_id\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`marturia_asset_versions_asset_fk\` FOREIGN KEY (\`asset_id\`) REFERENCES \`marturia_assets\`(\`id\`) ON DELETE CASCADE
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`marturia_souls\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NULL,
    \`nickname\` VARCHAR(120) NOT NULL,
    \`inviter_id\` VARCHAR(64) NULL,
    \`referral_code\` VARCHAR(32) NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'BARU',
    \`handover_note\` TEXT NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`marturia_souls_event_id_status_idx\`(\`event_id\`, \`status\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`marturia_referrals\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`code\` VARCHAR(32) NOT NULL,
    \`inviter_id\` VARCHAR(64) NOT NULL,
    \`clicks\` INT NOT NULL DEFAULT 0,
    \`registrations\` INT NOT NULL DEFAULT 0,
    \`attendances\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`marturia_referrals_code_key\`(\`code\`),
    INDEX \`marturia_referrals_inviter_id_idx\`(\`inviter_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_event_checks\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`area\` VARCHAR(16) NOT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'BELUM',
    \`note\` TEXT NULL,
    \`updated_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`diakonia_event_checks_event_id_area_key\`(\`event_id\`, \`area\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_transport\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`pickup_point\` VARCHAR(200) NOT NULL,
    \`driver\` VARCHAR(120) NULL,
    \`seats\` INT NULL,
    \`contact\` VARCHAR(80) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`diakonia_transport_event_id_idx\`(\`event_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_cases\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`kind\` VARCHAR(24) NOT NULL DEFAULT 'LAINNYA',
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'LAPOR',
    \`subject_ref\` VARCHAR(200) NULL,
    \`pastoral_note_id\` VARCHAR(64) NULL,
    \`need_summary\` TEXT NULL,
    \`funding_link\` VARCHAR(300) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`diakonia_cases_status_updated_at_idx\`(\`status\`, \`updated_at\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_visits\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`case_id\` VARCHAR(64) NOT NULL,
    \`visited_on\` DATE NOT NULL,
    \`visitors\` VARCHAR(300) NULL,
    \`result\` TEXT NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`diakonia_visits_case_id_idx\`(\`case_id\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`diakonia_visits_case_fk\` FOREIGN KEY (\`case_id\`) REFERENCES \`diakonia_cases\`(\`id\`) ON DELETE CASCADE
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_kost\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`area\` VARCHAR(150) NOT NULL,
    \`price_range\` VARCHAR(100) NULL,
    \`contact\` VARCHAR(120) NULL,
    \`note\` TEXT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'USULAN',
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`diakonia_kost_status_idx\`(\`status\`),
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
  console.log('✓ Selesai (Sprint A: Marturia & Diakonia).');
})().catch((e) => {
  console.error('Gagal migrasi marturia-diakonia-a:', e?.message || e);
  process.exit(1);
});
