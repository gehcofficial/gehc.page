const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  await p.roleAssignment.deleteMany({where:{id:{startsWith:'ra-test'}}});
  await p.group.deleteMany({where:{id:{startsWith:'grp-test'}}});
  console.log('Cleaned test data');
}
main().then(()=>p.$disconnect());
