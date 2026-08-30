const {PrismaClient} = require('@prisma/client');
const { createHash } = require('crypto');

const prisma = new PrismaClient();
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

// All mentee names with their IDs (from previous seed run)
const MENTEES = [
  {name:'Jessica Poyoh',id:'usr-jessica-poyoh'},
  {name:'Gemma Montol',id:'usr-gemma-montol'},
  {name:'Riska Sajow',id:'usr-riska-sajow'},
  {name:'Gabriel Lintong',id:'usr-gabriel-lintong'},
  {name:'Kimberly Turambi',id:'usr-kimberly-turambi'},
  {name:'Kevin Budianto',id:'usr-kevin-budianto'},
  {name:'Clay Langi',id:'usr-clay-langi'},
  {name:'Michelle Watung',id:'usr-michelle-watung'},
  {name:'Ario Semet',id:'usr-ario-semet'},
  {name:'Ivanna Pande',id:'usr-ivanna-pande'},
  {name:'Jeremy Walangitan',id:'usr-jeremy-walangitan'},
  {name:'Kimmy Casey Liogu',id:'usr-kimmy-casey'},
  {name:'Timoty Wewengkang',id:'usr-timoty-wewengkang'},
  {name:'Virginia Parera',id:'usr-virginia-parera'},
  {name:'Nicole Naray',id:'usr-nicole-naray'},
  {name:'Chelsea Tjheuw',id:'usr-chelsea-tjheuw'},
  {name:'Daud Lumanauw',id:'usr-daud-lumanauw'},
  {name:'Pnt. Kevin Kamagi',id:'usr-pnt-kevin'},
  {name:'Lucky Losu',id:'usr-lucky-losu'},
  {name:'Shien Siauw',id:'usr-shien-siauw'},
  {name:'Soneta Imanuela',id:'usr-soneta-imanuela'},
  {name:'Lorenzo Ricsamana',id:'usr-lorenzo-ricsamana'},
  {name:'Mega Welan',id:'usr-mega-welan'},
  {name:'Putri Massie',id:'usr-putri-massie'},
  {name:'Nelcy Lodarmase',id:'usr-nelcy-lodarmase'},
  {name:'Marhaen Manus',id:'usr-marhaen-manus'},
  {name:'Aurellia Hillary',id:'usr-aurellia-hillary'},
  {name:'Yohana Doga',id:'usr-yohana-doga'},
  {name:'Akwila Gente',id:'usr-akwila-gente'},
  {name:'Timothy Mewengkang',id:'usr-timothy-mewengkang'},
  {name:'Lovely Pantouw',id:'usr-lovely-pantouw'},
  {name:'Agnes Reimas',id:'usr-agnes-reimas'},
  {name:'Thea Sanger',id:'usr-thea-sanger'},
  {name:'Febrian Evander',id:'usr-febrian-evander'},
  {name:'Avriel Singal',id:'usr-avriel-singal'},
  {name:'Imanuel Yimna Esau',id:'usr-imanuel-yimna'},
  {name:'Jilova Pakasi',id:'usr-jilova-pakasi'},
  {name:'Jeconia Wanget',id:'usr-jeconia-wanget'},
  {name:'Natalie Musak',id:'usr-natalie-musak'},
  {name:'Cia Worung',id:'usr-cia-worung'},
  {name:'Hoky Theos',id:'usr-hoky-theos'},
  {name:'Kezia Joseph',id:'usr-kezia-joseph'},
  {name:'Injilia Oroh',id:'usr-injilia-oroh'},
  {name:'Marshal Maramis',id:'usr-marshal-maramis'},
  {name:'Reywin Rengkuan',id:'usr-reywin-rengkuan'},
  {name:'Angelita Entjaurau',id:'usr-angelita-entjaurau'},
  {name:'Resty Budianto',id:'usr-resty-budianto'},
  {name:'David Pesoth',id:'usr-david-pesoth'},
  {name:'Gievara Bogar',id:'usr-gievara-bogar'},
  {name:'Shanella Mondong',id:'usr-shanella-mondong'},
  {name:'Glenity Siauw',id:'usr-glenity-siauw'},
  {name:'Lingkan Pinontoan',id:'usr-lingkan-pinontoan'},
  {name:'Jonathan Tintingon',id:'usr-jonathan-tintingon'},
  {name:'Yuen Pajow',id:'usr-yuen-pajow'},
  {name:'Jeconia Luwuk',id:'usr-jeconia-luwuk'},
  {name:'Trivena Rattu',id:'usr-trivena-rattu'},
  {name:'Diferd Wuri',id:'usr-diferd-wuri'},
  {name:'Gracia Laura',id:'usr-gracia-laura'},
  {name:'Jacqson Naharia',id:'usr-jacqson-naharia'},
  {name:'Alvandi Saerang',id:'usr-alvandi-saerang'},
];

async function main() {
  // Gift data from Excel
  const XLSX = require('xlsx');
  const wb = XLSX.readFile('D:/AISaerang Life/Services/Youth/Retreat Attendance_GEHC YOUTH 2026.xlsx');
  const giftRaw = XLSX.utils.sheet_to_json(wb.Sheets['GIFT TEST STATUS'], {defval:'',header:1});
  const gm = new Map();
  for (let i=15;i<giftRaw.length;i++) {
    const n=(giftRaw[i][1]||'').toString().trim(), g=(giftRaw[i][3]||'').toString().trim(), s=parseInt(giftRaw[i][4])||0;
    if (n&&g&&s>0) gm.set(n.toLowerCase(),{gift:g,score:s});
  }

  let updated = 0;
  for (const m of MENTEES) {
    const gift = gm.get(m.name.toLowerCase());
    const gd = gift ? { top5:[gift.gift], scores:{[gift.gift]:gift.score} } : genGifts(m.name);
    await prisma.user.update({
      where: { id: m.id },
      data: { giftsTop5: gd.top5, giftsScores: gd.scores, isBeyonders: true }
    });
    updated++;
    if (updated % 10 === 0) process.stdout.write(updated + '/' + MENTEES.length + '\n');
  }
  process.stdout.write('Updated: ' + updated + ' users\n');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
