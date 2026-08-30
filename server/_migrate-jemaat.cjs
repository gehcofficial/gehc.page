require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const u = new URL(url.replace('sslaccept=strict', 'ssl-mode=REQUIRED'));
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
    multipleStatements: true,
  });

  const [[tables]] = await conn.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'kolom'"
  );
  if (Number(tables.c) > 0) {
    console.log('kolom table already exists — skip create');
  } else {
    const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/6_jemaat_directory/migration.sql'), 'utf8');
    await conn.query(sql);
    console.log('jemaat directory migration applied');
  }

  const [cols] = await conn.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name IN ('bipra','google_sub','kolom_id','link_status')"
  );
  console.log('users columns:', cols.map((r) => r.COLUMN_NAME || r.column_name).join(', '));
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
