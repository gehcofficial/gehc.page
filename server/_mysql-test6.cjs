require('dotenv').config();
const mysql = require('mysql2/promise');

const ALL = [
  'usr-jessica-poyoh','usr-gemma-montol','usr-riska-sajow','usr-gabriel-lintong',
  'usr-kimberly-turambi','usr-kevin-budianto','usr-clay-langi','usr-michelle-watung',
  'usr-ario-semet','usr-ivanna-pande','usr-jeremy-walangitan','usr-kimmy-casey',
  'usr-timoty-wewengkang','usr-virginia-parera','usr-nicole-naray','usr-chelsea-tjheuw',
  'usr-daud-lumanauw','usr-pnt-kevin','usr-lucky-losu','usr-shien-siauw',
];

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 4000,
    user: url.username, password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true },
  });
  await conn.query('SET SESSION wait_timeout = 28800');
  console.log('Connected. Testing', ALL.length, 'users with DIFFERENT rows...');

  for (const uid of ALL) {
    const s = Date.now();
    const [r] = await conn.query(
      'UPDATE users SET gifts_top5 = ?, is_beyonders = 1 WHERE id = ?',
      ['["Faith"]', uid]
    );
    console.log('  ' + uid + ':', r.affectedRows, 'row, ' + (Date.now()-s) + 'ms');
  }

  const [count] = await conn.query('SELECT COUNT(*) as c FROM users WHERE gifts_top5 IS NOT NULL');
  console.log('\nUsers with gifts:', count[0].c);
  await conn.end();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
