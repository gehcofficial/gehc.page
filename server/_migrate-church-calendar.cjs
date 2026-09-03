/**
 * Idempotent: kalender gerejawi bertanggal (church_calendar_entries).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function hasTable(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return rows.length > 0;
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  try {
    if (!(await hasTable(conn, 'church_calendar_entries'))) {
      await conn.query(`
        CREATE TABLE church_calendar_entries (
          id VARCHAR(64) NOT NULL,
          tenant_id VARCHAR(16) NOT NULL DEFAULT 'tenant-youth',
          start_date DATE NOT NULL,
          end_date DATE NULL,
          all_day TINYINT(1) NOT NULL DEFAULT 1,
          level VARCHAR(16) NOT NULL,
          source VARCHAR(16) NOT NULL,
          season VARCHAR(32) NULL,
          name VARCHAR(160) NOT NULL,
          name_en VARCHAR(160) NULL,
          scripture_ref VARCHAR(120) NULL,
          notes TEXT NULL,
          is_public TINYINT(1) NOT NULL DEFAULT 0,
          church_program_id VARCHAR(64) NULL,
          created_by_id VARCHAR(64) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY church_calendar_natural (tenant_id, source, name, start_date),
          KEY church_calendar_tenant_start_idx (tenant_id, start_date),
          KEY church_calendar_public_start_idx (is_public, start_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('church_calendar_entries created');
    } else {
      console.log('church_calendar_entries already exists');
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
