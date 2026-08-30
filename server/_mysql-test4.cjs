require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  console.log('Connecting to:', url.hostname, url.port);
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 4000,
    user: url.username, password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true }, connectTimeout: 10000,
    waitForConnections: true, connectionLimit: 1,
  });
  console.log('Connected');

  // Test: simple query
  const s1 = Date.now();
  const [r1] = await conn.query('SELECT 1 as x');
  console.log('Q1:', r1[0].x, Date.now()-s1, 'ms');

  // Test: update with parameterized query
  const s2 = Date.now();
  const [r2] = await conn.query(
    'UPDATE users SET is_beyonders = 1 WHERE id = ?',
    ['usr-jessica-poyoh']
  );
  console.log('Q2 (param):', r2.affectedRows, Date.now()-s2, 'ms');

  // Test: 3 sequential updates
  const ids = ['usr-jessica-poyoh', 'usr-gemma-montol', 'usr-riska-sajow'];
  for (const id of ids) {
    const s = Date.now();
    const [r] = await conn.query(
      "UPDATE users SET gifts_top5 = ?, gifts_scores = ?, is_beyonders = 1 WHERE id = ?",
      ['["Faith"]', '{"Faith":42}', id]
    );
    console.log('  Update', id, ':', r.affectedRows, Date.now()-s, 'ms');
  }

  await conn.end();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
