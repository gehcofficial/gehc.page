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

const EXCEL_GIFTS = {
  'jessica poyoh': {g:'Pastor/Shepherd',s:9},
  'kimberly turambi': {g:'Leadership',s:9},
  'kimmy casey liogu': {g:'Miracles',s:10},
  'putri massie': {g:'Teaching',s:7},
  'hoky theos': {g:'Helps',s:29},
  'jilova pakasi': {g:'Exhortation',s:17},
  'natalie musak': {g:'Intercession',s:1},
  'kezia joseph': {g:'Evangelism',s:7},
  'syallomitha mawitjere': {g:'Faith',s:47},
  'prichel kampong': {g:'Craftsmanship',s:18},
  'nelcy lodarmase': {g:'Discernment',s:16},
  'aurellia hillary': {g:'Hospitality',s:16},
  'akwila gente': {g:'Giving',s:10},
  'timothy mewengkang': {g:'Apostleship',s:8},
  'agnes reimas': {g:'Tongues and Interpretation',s:1},
  'avriel singal': {g:'Administration',s:19},
  'imanuel yimna esau': {g:'Prophecy',s:6},
  'shanella mondong': {g:'Healing',s:5},
  'glenity siauw': {g:'Word of Wisdom',s:5},
  'lingkan pinontoan': {g:'Giving',s:10},
  'jonathan tintingon': {g:'Giving',s:10},
  'yuen pajow': {g:'Mercy',s:19},
  'jacqson naharia': {g:'Word of Knowledge',s:3},
  'alvandi saerang': {g:'Administration',s:19},
  'mega welan': {g:'Healing',s:5},
  'soneta imanuela': {g:'Teaching',s:7},
  'artjuna timbuleng': {g:'Service',s:8},
  'michel lonteng': {g:'Word of Knowledge',s:3},
  'christofel david pesoth': {g:'Intercession',s:1},
  'mighty rengkung': {g:'Faith',s:47},
  'julivie irot': {g:'Apostleship',s:8},
  'christian lombogia': {g:'Mercy',s:19},
  'filipo karinda': {g:'Teaching',s:7},
  'theodore kowaas': {g:'Leadership',s:9},
  'aditya wellem': {g:'Discernment',s:16},
  'holly kalele': {g:'Hospitality',s:16},
  'fladyna mondoringin': {g:'Pastor/Shepherd',s:9},
  'zhanon lausan': {g:'Faith',s:47},
  'farendy lumintang': {g:'Helps',s:29},
  'patrisha lengkey': {g:'Administration',s:19},
  'krisetia mamoto': {g:'Leadership',s:9},
  'reiner montolalu': {g:'Service',s:8},
  'stefanus tambariki': {g:'Discernment',s:16},
  'jeremiah mewengkang': {g:'Craftsmanship',s:18},
  'milithya wuisan': {g:'Exhortation',s:17},
  'injilia oroh': {g:'Giving',s:10},
  'marshal maramis': {g:'Mercy',s:19},
  'reywin rengkuan': {g:'Hospitality',s:16},
  'angelita entjaurau': {g:'Apostleship',s:8},
  'resty budianto': {g:'Service',s:8},
  'david pesoth': {g:'Intercession',s:1},
  'gievara bogar': {g:'Discernment',s:16},
  'lovely pantouw': {g:'Healing',s:5},
  'febrian evander': {g:'Administration',s:19},
  'thea sanger': {g:'Tongues and Interpretation',s:1},
  'gabriel lintong': {g:'Prophecy',s:6},
  'riska saajow': {g:'Teaching',s:7},
  'gemma montol': {g:'Pastor/Shepherd',s:9},
  'clay langi': {g:'Evangelism',s:7},
  'michelle watung': {g:'Leadership',s:9},
  'ario semet': {g:'Faith',s:47},
  'ivanna pande': {g:'Helps',s:29},
  'jeremy walangitan': {g:'Administration',s:19},
  'timoty wewengkang': {g:'Prophecy',s:6},
  'virginia parera': {g:'Teaching',s:7},
  'nicole naray': {g:'Giving',s:10},
  'chelsea tjheuw': {g:'Hospitality',s:16},
  'daud lumanauw': {g:'Exhortation',s:17},
  'pnt. kevin kamagi': {g:'Miracles',s:10},
  'lucky losu': {g:'Service',s:8},
  'shien siauw': {g:'Craftsmanship',s:18},
  'lorenzo ricsamana': {g:'Pastor/Shepherd',s:9},
  'marhaen manus': {g:'Mercy',s:19},
  'yohana doga': {g:'Apostleship',s:8},
  'cia worung': {g:'Discernment',s:16},
  'jeconia wanget': {g:'Intercession',s:1},
  'jeconia luwuk': {g:'Tongues and Interpretation',s:1},
  'trivena rattu': {g:'Faith',s:47},
  'diferd wuri': {g:'Helps',s:29},
  'gracia laura': {g:'Miracles',s:10},
};

async function main() {
  // Get all mentee user IDs
  const users = await prisma.user.findMany({select:{id:true,name:true}});
  process.stdout.write('Users: ' + users.length + '\n');
  
  let updated = 0;
  for (const u of users) {
    const lo = u.name.toLowerCase();
    const gift = EXCEL_GIFTS[lo];
    let gd;
    if (gift) {
      gd = { top5: [gift.g], scores: { [gift.g]: gift.s } };
    } else {
      gd = genGifts(u.name);
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { giftsTop5: gd.top5, giftsScores: gd.scores, isBeyonders: true }
    });
    updated++;
    if (updated % 10 === 0) process.stdout.write(updated + '/' + users.length + '\n');
  }
  process.stdout.write('Updated: ' + updated + ' users with gifts\n');

  const rc = await prisma.roleAssignment.groupBy({by:['role'],_count:true});
  process.stdout.write('\n=== Summary ===\n');
  rc.forEach(r => process.stdout.write('  ' + r.role + ': ' + r._count + '\n'));
  process.stdout.write('\nDone!\n');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
