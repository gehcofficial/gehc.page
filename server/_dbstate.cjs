require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const total = await p.user.count();
  const beyonders = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE is_beyonders = 1');
  const withGifts = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM users WHERE gifts_top5 IS NOT NULL');
  const withRoles = await p.roleAssignment.findMany({select:{userId:true}});
  const uniqueUserIds = [...new Set(withRoles.map(r=>r.userId))];
  const g = await p.group.count();
  const ra = await p.roleAssignment.groupBy({by:['role'],_count:true});
  
  console.log('=== DATABASE STATE ===');
  console.log('Total users:', total);
  console.log('is_beyonders=1:', Number(beyonders[0].c));
  console.log('With gifts_top5:', Number(withGifts[0].c));
  console.log('Users with role assignments:', uniqueUserIds.length);
  console.log('Groups:', g);
  ra.forEach(r=>console.log('  '+r.role+':', r._count));
  
  // Users with roles but no gifts
  const noGiftIds = await p.$queryRawUnsafe('SELECT id, name FROM users WHERE gifts_top5 IS NULL ORDER BY name');
  console.log('\nUsers WITHOUT gifts:', noGiftIds.length);
  noGiftIds.slice(0,10).forEach(u=>console.log('  '+u.id+': '+u.name));
  if(noGiftIds.length>10) console.log('  ... and', noGiftIds.length-10, 'more');
  
  await p.$disconnect();
})().catch(e=>{console.error(e.message);process.exit(1)});
