require('dotenv').config();
const mysql = require('mysql2/promise');
const { createHash } = require('crypto');

const ALL = [
  ['usr-jessica-poyoh','Jessica Poyoh'],['usr-gemma-montol','Gemma Montol'],
  ['usr-riska-sajow','Riska Sajow'],['usr-gabriel-lintong','Gabriel Lintong'],
  ['usr-kimberly-turambi','Kimberly Turambi'],['usr-kevin-budianto','Kevin Budianto'],
  ['usr-clay-langi','Clay Langi'],['usr-michelle-watung','Michelle Watung'],
  ['usr-ario-semet','Ario Semet'],['usr-ivanna-pande','Ivanna Pande'],
];

function genGifts(name) {
  const h = createHash('md5').update(name).digest();
  const ALL_G = ['Administration','Apostleship','Craftsmanship','Discernment','Evangelism','Exhortation','Faith','Giving','Healing','Hospitality','Intercession','Leadership','Mercy','Miracles','Pastor/Shepherd','Prophecy','Service','Teaching','Tongues and Interpretation','Word of Knowledge','Word of Wisdom','Helps'];
  const used = new Set(); const s = {};
  for (let i = 0; i < 5; i++) { let idx; do { idx = h[i*3] % ALL_G.length; } while (used.has(idx)); used.add(idx); s[ALL_G[idx]] = 10 + (h[i*3+1] % 40); }
  const t = Object.entries(s).sort((a,b) => b[1]-a[1]).slice(0,5);
  return { top5: t.map(([g])=>g), scores: Object.fromEntries(t) };
}

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 4000,
    user: url.username, password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true },
  });
  console.log('Connected. Testing', ALL.length, 'users...');

  for (const [uid, name] of ALL) {
    const gd = genGifts(name);
    const top5 = JSON.stringify(gd.top5);
    const scores = JSON.stringify(gd.scores);
    console.log(uid, '→', top5.substring(0, 40) + '...');
    const s = Date.now();
    const [r] = await conn.query(
      'UPDATE users SET gifts_top5 = ?, gifts_scores = ?, is_beyonders = 1 WHERE id = ?',
      [top5, scores, uid]
    );
    console.log('  →', r.affectedRows, 'row, ' + (Date.now()-s) + 'ms');
  }

  const [count] = await conn.query('SELECT COUNT(*) as c FROM users WHERE gifts_top5 IS NOT NULL');
  console.log('\nUsers with gifts:', count[0].c);
  await conn.end();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
