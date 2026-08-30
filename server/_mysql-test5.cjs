require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  
  // Try with longer connect timeout and idle timeout
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 4000,
    user: url.username, password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true },
    connectTimeout: 30000,
    insecureAuth: true,
  });
  
  // Set session variables for stability
  await conn.query('SET SESSION wait_timeout = 28800');
  await conn.query('SET SESSION interactive_timeout = 28800');
  
  console.log('Connected. Testing 10 sequential updates...');

  for (let i = 0; i < 10; i++) {
    const s = Date.now();
    const [r] = await conn.query(
      "UPDATE users SET is_beyonders = 1 WHERE id = 'usr-jessica-poyoh'"
    );
    console.log('  Q' + i + ':', r.affectedRows, Date.now()-s, 'ms');
  }

  console.log('Now testing JSON update...');
  const [r] = await conn.query(
    "UPDATE users SET gifts_top5 = ?, gifts_scores = ?, is_beyonders = 1 WHERE id = ?",
    ['["Faith","Helps"]', '{"Faith":42,"Helps":29}', 'usr-jessica-poyoh']
  );
  console.log('JSON update:', r.affectedRows, 'rows');

  await conn.end();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
