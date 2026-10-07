/**
 * Idempotent (Sprint B — Marturia & Diakonia):
 *   marturia_templates,
 *   diakonia_inventory, diakonia_checkout,
 *   diakonia_consumption, diakonia_safety, diakonia_incidents
 *
 * Jalankan: npm run db:migrate:marturia-diakonia-b[:staging|:prod]
 * Prisma models: prisma/schema.prisma (§ Sprint B).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`marturia_templates\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`title\` VARCHAR(200) NOT NULL,
    \`kind\` VARCHAR(16) NOT NULL DEFAULT 'POSTER',
    \`url\` TEXT NOT NULL,
    \`note\` TEXT NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`marturia_templates_kind_idx\`(\`kind\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_inventory\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`name\` VARCHAR(200) NOT NULL,
    \`unit\` VARCHAR(24) NOT NULL DEFAULT 'PCS',
    \`qty_total\` INT NOT NULL DEFAULT 0,
    \`condition\` VARCHAR(16) NOT NULL DEFAULT 'BAIK',
    \`location\` VARCHAR(200) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_checkout\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`inventory_id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`qty\` INT NOT NULL DEFAULT 1,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'KELUAR',
    \`note\` VARCHAR(500) NULL,
    \`checked_out_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX \`diakonia_checkout_event_id_status_idx\`(\`event_id\`, \`status\`),
    INDEX \`diakonia_checkout_inventory_id_idx\`(\`inventory_id\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`diakonia_checkout_inventory_fk\` FOREIGN KEY (\`inventory_id\`) REFERENCES \`diakonia_inventory\`(\`id\`) ON DELETE CASCADE
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_consumption\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`menu\` TEXT NULL,
    \`portions\` INT NULL,
    \`vendor\` VARCHAR(200) NULL,
    \`distribution_note\` TEXT NULL,
    \`leftover_note\` TEXT NULL,
    \`updated_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`diakonia_consumption_event_id_key\`(\`event_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_safety\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`standby_name\` VARCHAR(200) NULL,
    \`kit_location\` VARCHAR(200) NULL,
    \`protocol_note\` TEXT NULL,
    \`updated_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`diakonia_safety_event_id_key\`(\`event_id\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE TABLE IF NOT EXISTS \`diakonia_incidents\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`event_id\` VARCHAR(64) NOT NULL,
    \`description\` TEXT NOT NULL,
    \`severity\` VARCHAR(16) NOT NULL DEFAULT 'RINGAN',
    \`followup_case_id\` VARCHAR(64) NULL,
    \`created_by_id\` VARCHAR(64) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`diakonia_incidents_event_id_idx\`(\`event_id\`),
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
  console.log('✓ Selesai (Sprint B: Marturia & Diakonia).');
})().catch((e) => {
  console.error('Gagal migrasi marturia-diakonia-b:', e?.message || e);
  process.exit(1);
});
