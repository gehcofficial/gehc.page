/**
 * Idempotent: status siklus hidup album bonding kelompok.
 * USULAN (mentee) -> RENCANA (mentor approve) -> SELESAI (otomatis saat foto ada) | BATAL
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

  if (!(await hasColumn(conn, 'group_albums', 'status'))) {
    await conn.query(`ALTER TABLE \`group_albums\` ADD COLUMN status VARCHAR(16) NULL`);
    console.log('group_albums.status added');
  } else {
    console.log('group_albums.status exists');
  }

  // Backfill: yang sudah lewat -> SELESAI, hari ini/depan -> RENCANA (cermin PLANNING/ACTIVE/DONE event)
  const [r1] = await conn.query(
    `UPDATE \`group_albums\` SET status = 'SELESAI' WHERE status IS NULL AND occurred_on < CURDATE()`,
  );
  console.log('backfill SELESAI:', r1.affectedRows);
  const [r2] = await conn.query(
    `UPDATE \`group_albums\` SET status = 'RENCANA' WHERE status IS NULL`,
  );
  console.log('backfill RENCANA:', r2.affectedRows);

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
