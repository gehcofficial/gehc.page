require('dotenv').config();
const mysql = require('mysql2/promise');
const { createHash } = require('crypto');

const GIFTS = [
  'Administration','Apostleship','Craftsmanship','Discernment','Evangelism',
  'Exhortation','Faith','Giving','Healing','Hospitality','Intercession',
  'Leadership','Mercy','Miracles','Pastor/Shepherd','Prophecy','Service',
  'Teaching','Tongues and Interpretation','Word of Knowledge','Word of Wisdom','Helps'
];
function genGifts(name) {
  const h = createHash('md5').update(name).digest();
  const used = new Set(); const s = {};
  for (let i = 0; i < 5; i++) { let idx; do { idx = h[i*3] % GIFTS.length; } while (used.has(idx)); used.add(idx); s[GIFTS[idx]] = 10 + (h[i*3+1] % 40); }
  const t = Object.entries(s).sort((a,b) => b[1]-a[1]).slice(0,5);
  return { top5: t.map(([g])=>g), scores: Object.fromEntries(t) };
}

const ALL = [
  ['usr-jessica-poyoh','Jessica Poyoh'],['usr-gemma-montol','Gemma Montol'],
  ['usr-riska-sajow','Riska Sajow'],['usr-gabriel-lintong','Gabriel Lintong'],
  ['usr-kimberly-turambi','Kimberly Turambi'],['usr-kevin-budianto','Kevin Budianto'],
  ['usr-clay-langi','Clay Langi'],['usr-michelle-watung','Michelle Watung'],
  ['usr-ario-semet','Ario Semet'],['usr-ivanna-pande','Ivanna Pande'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 4000,
    user: url.username, password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true },
  });
  console.log('Testing CASE WHEN bulk update for', ALL.length, 'users...');

  const BATCH = 4;
  for (let i = 0; i < ALL.length; i += BATCH) {
    const batch = ALL.slice(i, i + BATCH);
    const ids = batch.map(([uid]) => `'${uid}'`).join(',');
    const top5Cases = batch.map(([uid, name]) => {
      const gd = genGifts(name);
      const v = JSON.stringify(gd.top5).replace(/'/g, "''");
      return `WHEN id = '${uid}' THEN '${v}'`;
    }).join(' ');
    const scoresCases = batch.map(([uid, name]) => {
      const gd = genGifts(name);
      const v = JSON.stringify(gd.scores).replace(/'/g, "''");
      return `WHEN id = '${uid}' THEN '${v}'`;
    }).join(' ');
    const sql = `UPDATE users SET gifts_top5 = CASE ${top5Cases} END, gifts_scores = CASE ${scoresCases} END, is_beyonders = 1 WHERE id IN (${ids})`;
    const s = Date.now();
    try {
      const [r] = await conn.query(sql);
      console.log('  Batch ' + (i/BATCH+1) + ': ' + r.affectedRows + ' rows, ' + (Date.now()-s) + 'ms');
    } catch(e) {
      console.log('  Batch ' + (i/BATCH+1) + ' ERR: ' + e.message.substring(0, 100));
    }
    await sleep(500);
  }

  const [count] = await conn.query('SELECT COUNT(*) as c FROM users WHERE gifts_top5 IS NOT NULL');
  console.log('Users with gifts:', count[0].c);
  await conn.end();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
