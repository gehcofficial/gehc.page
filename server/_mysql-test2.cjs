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
    ssl: { rejectUnauthorized: true },
    connectTimeout: 10000,
  });
  console.log('Connected');

  // Test: SELECT 5 mentees
  const [rows] = await conn.execute('SELECT id, name FROM users LIMIT 5');
  console.log('Got rows:', rows.length);
  for (const r of rows) console.log('  ', r.id, r.name);

  // Test: single UPDATE
  const [result] = await conn.execute(
    "UPDATE users SET is_beyonders = 1 WHERE id = ?",
    [rows[0].id]
  );
  console.log('Single update:', result.affectedRows);

  // Test: 5 parallel updates
  const promises = rows.map(r => 
    conn.execute("UPDATE users SET is_beyonders = 1 WHERE id = ?", [r.id])
  );
  const results = await Promise.all(promises);
  console.log('Parallel updates:', results.length, 'ok');

  await conn.end();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
