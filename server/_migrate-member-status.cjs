require('dotenv').config();
const mysql = require('mysql2/promise');

// Tambah kolom users.member_status ENUM('ACTIVE','ALUMNI','NONAKTIF').
// Idempotent: aman dijalankan berulang; memperlebar enum bila sudah ada.
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

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'member_status'`,
  );

  if (!cols.length) {
    await conn.query(
      `ALTER TABLE users ADD COLUMN member_status ENUM('ACTIVE','ALUMNI','NONAKTIF') NOT NULL DEFAULT 'ACTIVE'`,
    );
    await conn.query(`ALTER TABLE users ADD INDEX users_member_status_idx (member_status)`).catch(() => {});
    console.log('users.member_status added');
  } else {
    const type = String(cols[0].COLUMN_TYPE || '');
    if (!type.includes('ALUMNI') || !type.includes('NONAKTIF')) {
      await conn.query(
        `ALTER TABLE users MODIFY COLUMN member_status ENUM('ACTIVE','ALUMNI','NONAKTIF') NOT NULL DEFAULT 'ACTIVE'`,
      );
      console.log('users.member_status widened');
    } else {
      console.log('users.member_status exists');
    }
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
