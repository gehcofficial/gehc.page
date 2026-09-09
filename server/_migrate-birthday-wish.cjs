/**
 * Idempotent: enum BIRTHDAY_WISH + tabel birthday_settings (1 baris aktif).
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
  'EVENT_ARCHIVED',
  'APPROVAL_ITEM',
  'DRIVE_DRIFT',
  'BIRTHDAY_WISH',
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
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`,
    );
    if (cols.length && !String(cols[0].COLUMN_TYPE || '').includes('BIRTHDAY_WISH')) {
      await conn.query(`ALTER TABLE notifications MODIFY COLUMN type ENUM(${ENUM_VALUES.map((v) => `'${v}'`).join(',')}) NOT NULL`);
      console.log('notifications.type updated with BIRTHDAY_WISH');
    } else {
      console.log('notifications.type already has BIRTHDAY_WISH');
    }
    await conn.query(`
      CREATE TABLE IF NOT EXISTS birthday_settings (
        id VARCHAR(64) NOT NULL,
        caption TEXT NOT NULL,
        photo_url TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        updated_by_id VARCHAR(64) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('birthday_settings ready');
    const [rows] = await conn.query(`SELECT id FROM birthday_settings WHERE is_active = 1 LIMIT 1`);
    if (!rows.length) {
      await conn.query(
        `INSERT INTO birthday_settings (id, caption, photo_url, is_active) VALUES ('bday-default', 'Selamat ulang tahun, {nama}! Tuhan Yesus memberkati di usia {umur} tahun. 🎉', NULL, 1)`,
      );
      console.log('default caption seeded');
    }
  } finally {
    await conn.end();
  }
  console.log('OK birthday wish');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
