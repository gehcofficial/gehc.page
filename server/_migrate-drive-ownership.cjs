/**
 * Idempotent: indeks Drive (album, arsip, kesaksian, BZP, pastoral).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function hasColumn(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col],
  );
  return rows.length > 0;
}

async function addColumn(conn, table, col, ddl) {
  if (await hasColumn(conn, table, col)) {
    console.log(`${table}.${col} exists`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`${table}.${col} added`);
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

  await conn.query(`
    CREATE TABLE IF NOT EXISTS group_albums (
      id VARCHAR(64) NOT NULL,
      group_id VARCHAR(64) NOT NULL,
      title VARCHAR(190) NOT NULL,
      kind VARCHAR(24) NOT NULL DEFAULT 'ADHOC',
      occurred_on DATE NOT NULL,
      location VARCHAR(190) NULL,
      event_id VARCHAR(64) NULL,
      drive_folder_id VARCHAR(128) NULL,
      cover_drive_file_id VARCHAR(128) NULL,
      preview_file_ids JSON NULL,
      created_by_id VARCHAR(64) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX group_albums_group_occurred (group_id, occurred_on)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('group_albums OK');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS pastoral_care_notes (
      id VARCHAR(64) NOT NULL,
      subject_user_id VARCHAR(64) NOT NULL,
      reporter_user_id VARCHAR(64) NOT NULL,
      kind VARCHAR(24) NOT NULL,
      note TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
      expires_at DATETIME(3) NULL,
      drive_folder_id VARCHAR(128) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX pastoral_subject_status (subject_user_id, status),
      INDEX pastoral_status_expires (status, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('pastoral_care_notes OK');

  await addColumn(conn, 'EventProgram', 'archive_folder_id', 'archive_folder_id VARCHAR(128) NULL');
  await addColumn(conn, 'EventProgram', 'preview_file_ids', 'preview_file_ids JSON NULL');
  await addColumn(conn, 'testimonials', 'status', `status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'`);
  await addColumn(conn, 'testimonials', 'inbox_drive_file_id', 'inbox_drive_file_id VARCHAR(128) NULL');
  await addColumn(conn, 'orders', 'invoice_drive_file_id', 'invoice_drive_file_id VARCHAR(128) NULL');
  await addColumn(conn, 'orders', 'payment_proof_drive_file_id', 'payment_proof_drive_file_id VARCHAR(128) NULL');

  await conn.query(`
    UPDATE testimonials SET status = 'PUBLISHED' WHERE is_published = 1 AND (status IS NULL OR status = 'DRAFT')
  `).catch(() => {});

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
