require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
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

function slug(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const prisma = new PrismaClient();
  process.stdout.write('Connected. Updating ' + ALL.length + ' users...\n');

  // Build updates
  const updates = ALL.map(([uid, name]) => {
    const lo = name.toLowerCase();
    const gift = EXCEL_GIFTS[lo];
    const gd = gift ? {top5:[gift[0]],scores:{[gift[0]]:gift[1]}} : genGifts(name);
    return { uid, top5: gd.top5, scores: gd.scores };
  });

  // Use a single CASE WHEN UPDATE — but split into batches of 4 users to stay under TiDB query limit
  const BATCH = 4;
  let ok = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    
    // Build a single CASE WHEN UPDATE for each field
    const ids = batch.map(u => u.uid);
    const idPlaceholders = ids.map(id => `'${id}'`).join(',');
    
    // Build CASE for gifts_top5
    const top5Cases = batch.map(u => {
      const v = JSON.stringify(u.top5).replace(/'/g, "''");
      return `WHEN id = '${u.uid}' THEN '${v}'`;
    }).join(' ');
    
    // Build CASE for gifts_scores
    const scoresCases = batch.map(u => {
      const v = JSON.stringify(u.scores).replace(/'/g, "''");
      return `WHEN id = '${u.uid}' THEN '${v}'`;
    }).join(' ');

    const sql = `
      UPDATE users 
      SET gifts_top5 = CASE ${top5Cases} END,
          gifts_scores = CASE ${scoresCases} END,
          is_beyonders = 1
      WHERE id IN (${idPlaceholders})
    `;
    
    const s = Date.now();
    try {
      await prisma.$executeRawUnsafe(sql);
      ok += batch.length;
      process.stdout.write('  ' + ok + '/' + updates.length + ' (' + (Date.now()-s) + 'ms)\n');
    } catch(e) {
      process.stdout.write('  ERR at ' + ok + ': ' + e.message.substring(0, 100) + '\n');
    }
    
    // Disconnect and reconnect for each batch to avoid pool exhaustion
    await prisma.$disconnect();
    if (i + BATCH < updates.length) {
      await sleep(2000); // Wait for TiDB Cloud connection reset
    }
  }

  // Verify
  const prisma2 = new PrismaClient();
  const count = await prisma2.user.count({ where: { giftsTop5: { not: null } } });
  process.stdout.write('\nUsers with gifts: ' + count + '\n');
  await prisma2.$disconnect();
  process.stdout.write('Done!\n');
}

main().catch(e=>{console.error('Fatal:',e);process.exit(1)});
