require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 4000,
    user: url.username, password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true }, connectTimeout: 10000,
  });
  console.log('Connected');

  // Simple query
  const [rows] = await conn.execute('SELECT id, name FROM users WHERE is_beyonders = 1 LIMIT 60');
  console.log('Got:', rows.length, 'rows');

  // Sequential updates
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const s = Date.now();
    await conn.execute("UPDATE users SET is_beyonders = 1 WHERE id = ?", [rows[i].id]);
    console.log('  Update', i, ':', Date.now()-s, 'ms');
  }

  // Promise.all updates
  const s = Date.now();
  const promises = rows.slice(0, 5).map(r => 
    conn.execute("UPDATE users SET is_beyonders = 1 WHERE id = ?", [r.id])
  );
  await Promise.all(promises);
  console.log('  Parallel 5:', Date.now()-s, 'ms');

  await conn.end();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
