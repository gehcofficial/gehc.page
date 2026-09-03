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

  const sql = fs.readFileSync(
    path.join(__dirname, '../prisma/migrations/15_access_groups/migration.sql'),
    'utf8',
  );
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await conn.query(stmt);
  }
  console.log('access_groups tables ready');
  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
