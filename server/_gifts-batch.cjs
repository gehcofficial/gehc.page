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

async function updateBatch(ids) {
  const prisma = new PrismaClient();
  try {
    for (const {id, name} of ids) {
      const lo = name.toLowerCase();
      const gift = EXCEL_GIFTS[lo];
      const gd = gift ? {top5:[gift[0]],scores:{[gift[0]]:gift[1]}} : genGifts(name);
      await prisma.user.update({
        where: { id },
        data: { giftsTop5: gd.top5, giftsScores: gd.scores, isBeyonders: true }
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const prisma = new PrismaClient();
  
  // Get mentees without gifts using raw SQL (Prisma can't filter null JSON)
  const mentees = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM users WHERE id IN (SELECT user_id FROM role_assignments WHERE role = 'MENTEE') AND gifts_top5 IS NULL`
  );
  console.log('Mentees without gifts:', mentees.length);
  await prisma.$disconnect();

  // Process in batches of 15 with fresh client each batch
  const BATCH = 15;
  for (let i = 0; i < mentees.length; i += BATCH) {
    const batch = mentees.slice(i, i + BATCH);
    console.log('Batch ' + Math.floor(i/BATCH + 1) + ':', batch.length, 'users');
    await updateBatch(batch);
    console.log('  Done');
  }

  // Verify
  const prisma2 = new PrismaClient();
  const count = await prisma2.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE gifts_top5 IS NOT NULL');
  console.log('\nUsers with gifts:', count[0].c);
  await prisma2.$disconnect();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
