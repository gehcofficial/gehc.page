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
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='is_individu_explicit'`
    );
    if (!cols.length) {
      await conn.query(`ALTER TABLE users ADD COLUMN is_individu_explicit TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('is_individu_explicit added');
    } else console.log('is_individu_explicit exists');
    await conn.query(`CREATE INDEX idx_users_individu ON users(is_individu_explicit)`).catch(()=>{});
  } finally { await conn.end(); }
  console.log('OK individu-explicit');
})().catch(e=>{ console.error(e.message); process.exit(1); });
