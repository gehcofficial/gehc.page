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

  const cols = [
    ['given_name', 'VARCHAR(80) NULL'],
    ['middle_name', 'VARCHAR(80) NULL'],
    ['family_name', 'VARCHAR(80) NULL'],
    ['church_title', 'VARCHAR(8) NULL'],
    ['academic_titles', 'JSON NULL'],
  ];
  for (const [name, ddl] of cols) {
    const [found] = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?`,
      [name],
    );
    if (!found.length) {
      await conn.query(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`);
      console.log('added', name);
    } else {
      console.log('exists', name);
    }
  }
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
