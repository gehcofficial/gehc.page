require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_token'`,
  );
  if (!cols.length) {
    const sql = fs.readFileSync(
      path.join(__dirname, '../prisma/migrations/16_password_reset/migration.sql'),
      'utf8',
    );
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      try {
        await conn.query(stmt);
      } catch (e) {
        if (!String(e.message).includes('Duplicate')) throw e;
      }
    }
    console.log('users.reset_token columns ready');
  } else {
    console.log('users.reset_token exists');
  }
  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
