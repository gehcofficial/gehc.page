/**
 * Migrasi 31: pastoral_care_notes.subject_name + subject_user_id nullable.
 * Idempotent — aman dijalankan berulang.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function columnInfo(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT IS_NULLABLE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows[0] || null;
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
  try {
    const nameCol = await columnInfo(conn, 'pastoral_care_notes', 'subject_name');
    if (!nameCol) {
      await conn.query('ALTER TABLE pastoral_care_notes ADD COLUMN subject_name VARCHAR(160) NULL');
      console.log('subject_name added');
    } else {
      console.log('subject_name exists');
    }
    const subCol = await columnInfo(conn, 'pastoral_care_notes', 'subject_user_id');
    if (subCol && subCol.IS_NULLABLE === 'NO') {
      await conn.query('ALTER TABLE pastoral_care_notes MODIFY COLUMN subject_user_id VARCHAR(64) NULL');
      console.log('subject_user_id -> nullable');
    } else if (subCol) {
      console.log('subject_user_id already nullable');
    } else {
      console.log('pastoral_care_notes.subject_user_id missing — lewati');
    }
  } finally {
    await conn.end();
  }
  console.log('OK pastoral subject name');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
