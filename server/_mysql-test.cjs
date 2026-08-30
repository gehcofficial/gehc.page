require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 4000,
    user: url.username,
    password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true }
  });
  console.log('Connected');

  const [rows] = await conn.execute('SELECT id, name FROM users LIMIT 3');
  console.log('Users:', rows.length);
  for (const r of rows) console.log(' ', r.id, r.name);

  const [result] = await conn.execute(
    "UPDATE users SET gifts_top5 = '[\"Faith\"]', gifts_scores = '{\"Faith\":42}', is_beyonders = 1 WHERE id = ?",
    [rows[0].id]
  );
  console.log('Update result:', result.affectedRows);

  await conn.end();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
