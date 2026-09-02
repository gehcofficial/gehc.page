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

  async function hasColumn(name) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
      [name],
    );
    return rows.length > 0;
  }

  async function hasIndex(name) {
    const [rows] = await conn.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = ?`,
      [name],
    );
    return rows.length > 0;
  }

  if (!(await hasColumn('login_username'))) {
    await conn.query('ALTER TABLE users ADD COLUMN login_username VARCHAR(40) NULL');
    console.log('users.login_username added');
  } else {
    console.log('users.login_username already exists');
  }

  if (!(await hasColumn('onboarding_path'))) {
    await conn.query(
      "ALTER TABLE users ADD COLUMN onboarding_path VARCHAR(16) NOT NULL DEFAULT 'ORGANIC'",
    );
    console.log('users.onboarding_path added');
  } else {
    console.log('users.onboarding_path already exists');
  }

  if (!(await hasColumn('username_changed_at'))) {
    await conn.query('ALTER TABLE users ADD COLUMN username_changed_at DATETIME(3) NULL');
    console.log('users.username_changed_at added');
  } else {
    console.log('users.username_changed_at already exists');
  }

  if (!(await hasIndex('users_login_username_key'))) {
    await conn.query('CREATE UNIQUE INDEX users_login_username_key ON users(login_username)');
    console.log('users_login_username_key index added');
  } else {
    console.log('users_login_username_key already exists');
  }

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
