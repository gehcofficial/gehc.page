require('dotenv').config();
const mysql = require('mysql2/promise');
const { createHash } = require('crypto');

const ALL_G = ['Administration','Apostleship','Craftsmanship','Discernment','Evangelism','Exhortation','Faith','Giving','Healing','Hospitality','Intercession','Leadership','Mercy','Miracles','Pastor/Shepherd','Prophecy','Service','Teaching','Tongues and Interpretation','Word of Knowledge','Word of Wisdom','Helps'];

function genGifts(name) {
  const h = createHash('md5').update(name).digest();
  const used = new Set(); const s = {};
  for (let i = 0; i < 5; i++) { let idx; do { idx = h[i*3] % ALL_G.length; } while (used.has(idx)); used.add(idx); s[ALL_G[idx]] = 10 + (h[i*3+1] % 40); }
  const t = Object.entries(s).sort((a,b) => b[1]-a[1]).slice(0,5);
  return { top5: t.map(([g])=>g), scores: Object.fromEntries(t) };
}

const IDS = [
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
  console.log('Connected. Testing', IDS.length, 'with 3-param queries...');

  for (let i = 0; i < IDS.length; i++) {
    const uid = IDS[i];
    const gd = genGifts(uid);
    const top5 = JSON.stringify(gd.top5);
    const scores = JSON.stringify(gd.scores);
    const s = Date.now();
    try {
      const [r] = await conn.query(
        'UPDATE users SET gifts_top5 = ?, gifts_scores = ?, is_beyonders = 1 WHERE id = ?',
        [top5, scores, uid]
      );
      console.log('  ' + (i+1) + '/' + IDS.length + ' ' + uid + ': ' + r.affectedRows + ' row, ' + (Date.now()-s) + 'ms');
    } catch(e) {
      console.log('  ' + (i+1) + '/' + IDS.length + ' ERR: ' + e.message.substring(0, 100));
      break;
    }
  }

  await conn.end();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
