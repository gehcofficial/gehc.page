/**
 * Idempotent: role_key pada service_roles + penatalayan_bod_links.
 * Jalankan: npm run db:migrate:penatalayan-bod-link
 */
require('dotenv').config();
require('./_production-database-url.cjs');
const mysql = require('mysql2/promise');

const DDL_LINK = `CREATE TABLE IF NOT EXISTS \`penatalayan_bod_links\` (
  \`id\` VARCHAR(64) NOT NULL,
  \`token\` VARCHAR(64) NOT NULL,
  \`event_id\` VARCHAR(64) NOT NULL,
  \`service_date\` DATE NOT NULL,
  \`pattern_code\` VARCHAR(32) NOT NULL DEFAULT 'CREATIVE_LAB',
  \`host_group_id\` VARCHAR(64) NULL,
  \`responsible_group_id\` VARCHAR(64) NULL,
  \`created_by_id\` VARCHAR(64) NOT NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX \`penatalayan_bod_links_token_key\`(\`token\`),
  UNIQUE INDEX \`penatalayan_bod_links_event_id_key\`(\`event_id\`),
  INDEX \`penatalayan_bod_links_service_date_idx\`(\`service_date\`),
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

  async function hasColumn(table, name) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, name],
    );
    return rows.length > 0;
  }
  async function hasTable(table) {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return rows.length > 0;
  }
  async function hasIndex(table, name) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, name],
    );
    return rows.length > 0;
  }

  if (await hasTable('service_roles')) {
    if (!(await hasColumn('service_roles', 'role_key'))) {
      await conn.query('ALTER TABLE service_roles ADD COLUMN role_key VARCHAR(48) NULL');
      console.log('service_roles.role_key ditambahkan');
    } else {
      console.log('service_roles.role_key sudah ada');
    }
    if (!(await hasIndex('service_roles', 'service_roles_role_key_key'))) {
      await conn.query('CREATE UNIQUE INDEX service_roles_role_key_key ON service_roles(role_key)');
      console.log('indeks unik role_key dibuat');
    }
  }

  if (await hasTable('penatalayan_bod_links')) {
    console.log('tabel penatalayan_bod_links sudah ada');
  } else {
    await conn.query(DDL_LINK);
    console.log('✓ tabel penatalayan_bod_links dibuat');
  }

  await conn.end();
  console.log('✓ Selesai (penatalayan BOD link).');
})().catch((e) => {
  console.error('Gagal migrasi penatalayan BOD link:', e?.message || e);
  process.exit(1);
});
