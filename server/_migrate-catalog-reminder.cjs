/**
 * Idempotent: institutions.country, institution_suggestions, notifications.type CATALOG_REMINDER.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const ENUM_VALUES = [
  'IDLE_FLAG',
  'MITOSIS_ALERT',
  'MERGER_SUGGESTION',
  'MENTION',
  'ROLE_ASSIGNED',
  'RUNBOOK_DUE',
  'CATALOG_REMINDER',
];

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
    const [instCols] = await conn.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'institutions' AND column_name = 'country'`,
    );
    if (!instCols.length) {
      await conn.query(
        `ALTER TABLE institutions ADD COLUMN country VARCHAR(80) NULL DEFAULT 'Indonesia'`,
      );
      console.log('institutions.country added');
    } else {
      console.log('institutions.country exists');
    }
    try {
      await conn.query('CREATE INDEX institutions_country_idx ON institutions(country)');
    } catch {
      /* exists */
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS institution_suggestions (
        id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(190) NOT NULL,
        city VARCHAR(120) NULL,
        country VARCHAR(80) NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        institution_id VARCHAR(64) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX institution_suggestions_user_id_idx (user_id),
        INDEX institution_suggestions_status_idx (status),
        PRIMARY KEY (id)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('institution_suggestions OK');

    const [notifCols] = await conn.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`,
    );
    if (!notifCols.length) {
      console.log('notifications.type missing — skip enum');
    } else {
      const type = String(notifCols[0].COLUMN_TYPE || '');
      if (type.includes('CATALOG_REMINDER')) {
        console.log('notifications.type already has CATALOG_REMINDER');
      } else {
        const list = ENUM_VALUES.map((v) => `'${v}'`).join(',');
        await conn.query(`ALTER TABLE notifications MODIFY COLUMN type ENUM(${list}) NOT NULL`);
        console.log('notifications.type updated with CATALOG_REMINDER');
      }
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
