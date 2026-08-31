require('dotenv').config();
const mysql = require('mysql2/promise');

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
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birth_date'`,
  );
  if (cols.length === 0) {
    await conn.query(`ALTER TABLE users ADD COLUMN birth_date DATE NULL`);
    console.log('users.birth_date added');
  } else {
    console.log('users.birth_date already exists');
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
