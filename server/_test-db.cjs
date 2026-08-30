const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.user.findFirst().then(r => {
  console.log('OK:', r.id, r.name);
  return p.$disconnect();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
