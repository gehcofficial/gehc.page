const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  // Find all mentee users without gifts and update them in batches
  const users = await p.user.findMany({
    where: { giftsTop5: null, isBeyonders: true },
    select: { id: true, name: true, gender: true }
  });
  console.log('Users needing gifts:', users.length);
  
  // Simple batch update
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const h = require('crypto').createHash('md5').update(u.name).digest();
    const ALL = ['Administration','Apostleship','Craftsmanship','Discernment','Evangelism','Exhortation','Faith','Giving','Healing','Hospitality','Intercession','Leadership','Mercy','Miracles','Pastor/Shepherd','Prophecy','Service','Teaching','Tongues and Interpretation','Word of Knowledge','Word of Wisdom','Helps'];
    const used = new Set(); const s = {};
    for (let j = 0; j < 5; j++) { let idx; do { idx = h[j*3] % ALL.length; } while (used.has(idx)); used.add(idx); s[ALL[idx]] = 10 + (h[j*3+1] % 40); }
    const t = Object.entries(s).sort((a,b) => b[1]-a[1]).slice(0,5);
    
    await p.user.update({
      where: { id: u.id },
      data: { giftsTop5: t.map(([g])=>g), giftsScores: Object.fromEntries(t), isBeyonders: true }
    });
    if ((i+1) % 10 === 0) console.log('  ' + (i+1) + '/' + users.length);
  }
  console.log('Gifts updated:', users.length);
}
main().then(()=>p.$disconnect());
