/**
 * Idempotent: add RUNBOOK_DUE to notifications.type enum.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const ENUM_VALUES = ['IDLE_FLAG', 'MITOSIS_ALERT', 'MERGER_SUGGESTION', 'MENTION', 'ROLE_ASSIGNED', 'RUNBOOK_DUE'];

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
    const [cols] = await conn.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`,
    );
    if (!cols.length) {
      console.log('notifications.type missing — skip');
      return;
    }
    const type = String(cols[0].COLUMN_TYPE || '');
    if (type.includes('RUNBOOK_DUE')) {
      console.log('notifications.type already has RUNBOOK_DUE — skip');
      return;
    }
    const list = ENUM_VALUES.map((v) => `'${v}'`).join(',');
    await conn.query(`ALTER TABLE notifications MODIFY COLUMN type ENUM(${list}) NOT NULL`);
    console.log('notifications.type updated with RUNBOOK_DUE');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
