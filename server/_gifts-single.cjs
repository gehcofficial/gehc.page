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
const EXCEL_GIFTS = {
  'jessica poyoh': ['Pastor/Shepherd',9], 'kimberly turambi': ['Leadership',9],
  'kimmy casey liogu': ['Miracles',10], 'putri massie': ['Teaching',7],
  'hoky theos': ['Helps',29], 'jilova pakasi': ['Exhortation',17],
  'natalie musak': ['Intercession',1], 'kezia joseph': ['Evangelism',7],
  'syallomitha mawitjere': ['Faith',47], 'prichel kampong': ['Craftsmanship',18],
  'nelcy lodarmase': ['Discernment',16], 'aurellia hillary': ['Hospitality',16],
  'akwila gente': ['Giving',10], 'timothy mewengkang': ['Apostleship',8],
  'agnes reimas': ['Tongues and Interpretation',1], 'avriel singal': ['Administration',19],
  'imanuel yimna esau': ['Prophecy',6], 'shanella mondong': ['Healing',5],
  'glenity siauw': ['Word of Wisdom',5], 'lingkan pinontoan': ['Giving',10],
  'jonathan tintingon': ['Giving',10], 'yuen pajow': ['Mercy',19],
  'jacqson naharia': ['Word of Knowledge',3], 'mega welan': ['Healing',5],
  'soneta imanuela': ['Teaching',7],
};

const ALL = [
  ['usr-jessica-poyoh','Jessica Poyoh'],['usr-gemma-montol','Gemma Montol'],
  ['usr-riska-sajow','Riska Sajow'],['usr-gabriel-lintong','Gabriel Lintong'],
  ['usr-kimberly-turambi','Kimberly Turambi'],['usr-kevin-budianto','Kevin Budianto'],
  ['usr-clay-langi','Clay Langi'],['usr-michelle-watung','Michelle Watung'],
  ['usr-ario-semet','Ario Semet'],['usr-ivanna-pande','Ivanna Pande'],
  ['usr-jeremy-walangitan','Jeremy Walangitan'],['usr-kimmy-casey','Kimmy Casey Liogu'],
  ['usr-timoty-wewengkang','Timoty Wewengkang'],['usr-virginia-parera','Virginia Parera'],
  ['usr-nicole-naray','Nicole Naray'],['usr-chelsea-tjheuw','Chelsea Tjheuw'],
  ['usr-daud-lumanauw','Daud Lumanauw'],['usr-pnt-kevin','Pnt. Kevin Kamagi'],
  ['usr-lucky-losu','Lucky Losu'],['usr-shien-siauw','Shien Siauw'],
  ['usr-soneta-imanuela','Soneta Imanuela'],['usr-lorenzo-ricsamana','Lorenzo Ricsamana'],
  ['usr-mega-welan','Mega Welan'],['usr-putri-massie','Putri Massie'],
  ['usr-nelcy-lodarmase','Nelcy Lodarmase'],['usr-marhaen-manus','Marhaen Manus'],
  ['usr-aurellia-hillary','Aurellia Hillary'],['usr-yohana-doga','Yohana Doga'],
  ['usr-akwila-gente','Akwila Gente'],['usr-timothy-mewengkang','Timothy Mewengkang'],
  ['usr-lovely-pantouw','Lovely Pantouw'],['usr-agnes-reimas','Agnes Reimas'],
  ['usr-thea-sanger','Thea Sanger'],['usr-febrian-evander','Febrian Evander'],
  ['usr-avriel-singal','Avriel Singal'],['usr-imanuel-yimna','Imanuel Yimna Esau'],
  ['usr-jilova-pakasi','Jilova Pakasi'],['usr-jeconia-wanget','Jeconia Wanget'],
  ['usr-natalie-musak','Natalie Musak'],['usr-cia-worung','Cia Worung'],
  ['usr-hoky-theos','Hoky Theos'],['usr-kezia-joseph','Kezia Joseph'],
  ['usr-injilia-oroh','Injilia Oroh'],['usr-marshal-maramis','Marshal Maramis'],
  ['usr-reywin-rengkuan','Reywin Rengkuan'],['usr-angelita-entjaurau','Angelita Entjaurau'],
  ['usr-resty-budianto','Resty Budianto'],['usr-david-pesoth','David Pesoth'],
  ['usr-gievara-bogar','Gievara Bogar'],['usr-shanella-mondong','Shanella Mondong'],
  ['usr-glenity-siauw','Glenity Siauw'],['usr-lingkan-pinontoan','Lingkan Pinontoan'],
  ['usr-jonathan-tintingon','Jonathan Tintingon'],['usr-yuen-pajow','Yuen Pajow'],
  ['usr-jeconia-luwuk','Jeconia Luwuk'],['usr-trivena-rattu','Trivena Rattu'],
  ['usr-diferd-wuri','Diferd Wuri'],['usr-gracia-laura','Gracia Laura'],
  ['usr-jacqson-naharia','Jacqson Naharia'],['usr-alvandi-saerang','Alvandi Saerang'],
  ['usr-reiner-montolalu','Reiner Montolalu'],['usr-stefanus-tambariki','Stefanus Tambariki'],
  ['usr-jeremiah-mewengkang','Jeremiah Mewengkang'],['usr-prichel-kampong','Prichel Kampong'],
  ['usr-syallomitha-mawitjere','Syallomitha Mawitjere'],['usr-artjuna-timbuleng','Artjuna Timbuleng'],
  ['usr-michel-lonteng','Michel Lonteng'],['usr-mighty-rengkung','Mighty Rengkung'],
  ['usr-zhanon-lausan','Zhanon Lausan'],['usr-farendy-lumintang','Farendy Lumintang'],
  ['usr-holly-kalele','Holly Kalele'],['usr-aditya-wellem','Aditya Wellem'],
  ['usr-krisetia-mamoto','Krisetia Mamoto'],['usr-filipo-karinda','Filipo Karinda'],
  ['usr-christian-lombogia','Christian Lombogia'],['usr-milithya-wuisan','Milithya Wuisan'],
  ['usr-patrisha-lengkey','Patrisha Lengkey'],['usr-fladyna-mondoringin','Fladyna Mondoringin'],
  ['usr-theodore-kowaas','Theodore Kowaas'],['usr-julivie-irot','Julivie Irot'],
];

function esc(v) { return String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  
  // Build one massive CASE WHEN UPDATE for ALL users
  const top5Cases = [];
  const scoresCases = [];
  const ids = [];
  
  for (const [uid, name] of ALL) {
    const lo = name.toLowerCase();
    const gift = EXCEL_GIFTS[lo];
    const gd = gift ? {top5:[gift[0]],scores:{[gift[0]]:gift[1]}} : genGifts(name);
    const top5v = esc(JSON.stringify(gd.top5));
    const scoresv = esc(JSON.stringify(gd.scores));
    top5Cases.push(`WHEN id = '${esc(uid)}' THEN '${top5v}'`);
    scoresCases.push(`WHEN id = '${esc(uid)}' THEN '${scoresv}'`);
    ids.push(`'${esc(uid)}'`);
  }
  
  const sql = `UPDATE users SET gifts_top5 = CASE ${top5Cases.join(' ')} END, gifts_scores = CASE ${scoresCases.join(' ')} END, is_beyonders = 1 WHERE id IN (${ids.join(',')})`;
  
  console.log('SQL length:', sql.length, 'bytes');
  console.log('Users:', ALL.length);
  console.log('Connecting...');
  
  const conn = await mysql.createConnection({
    host: url.hostname, port: parseInt(url.port) || 4000,
    user: url.username, password: url.password,
    database: url.pathname.replace('/',''),
    ssl: { rejectUnauthorized: true },
    connectTimeout: 30000,
  });
  console.log('Connected. Executing bulk update...');
  const s = Date.now();
  const [result] = await conn.query(sql);
  console.log('Affected rows:', result.affectedRows, '(' + (Date.now()-s) + 'ms)');
  
  const [count] = await conn.query('SELECT COUNT(*) as c FROM users WHERE gifts_top5 IS NOT NULL');
  console.log('Users with gifts:', count[0].c);
  await conn.end();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
