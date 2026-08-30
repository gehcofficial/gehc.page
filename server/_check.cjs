require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
async function m() {
  const rc = await p.roleAssignment.groupBy({by:['role'],_count:true});
  rc.forEach(r => console.log(r.role + ': ' + r._count));
  const tc = await p.user.count();
  console.log('Total users: ' + tc);
  const withGifts = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE gifts_top5 IS NOT NULL');
  console.log('Users with gifts: ' + withGifts[0].c);
  await p.$disconnect();
}
m();
