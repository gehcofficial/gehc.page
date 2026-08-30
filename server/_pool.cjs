const {PrismaClient} = require('@prisma/client');
const { createHash } = require('crypto');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: [{ level: 'error', emit: 'stdout' }]
});

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

async function main() {
  // Test: can we do 100 rapid queries?
  const s = Date.now();
  for (let i = 0; i < 5; i++) {
    const u = await prisma.user.findFirst({where:{email:'tech@gehc.demo'}});
    process.stdout.write('Q' + i + ': ' + (Date.now()-s) + 'ms\n');
  }
  process.stdout.write('Done with test queries\n');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
