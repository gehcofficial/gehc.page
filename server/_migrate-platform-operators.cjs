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
    path.join(__dirname, '../prisma/migrations/17_platform_operators/migration.sql'),
    'utf8',
  );
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    try {
      await conn.query(stmt);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('skip (exists):', stmt.slice(0, 60));
        continue;
      }
      throw e;
    }
  }
  console.log('platform_operators tables ready');
  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
