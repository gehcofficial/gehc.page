const {PrismaClient} = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  // Test 1: Simple query
  const s1 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  process.stdout.write('Q1: ' + (Date.now()-s1) + 'ms\n');

  // Test 2: User find
  const s2 = Date.now();
  const u = await prisma.user.findFirst({where:{email:'tech@gehc.demo'}});
  process.stdout.write('Q2: ' + (Date.now()-s2) + 'ms id=' + u.id + '\n');

  // Test 3: Group upsert
  const s3 = Date.now();
  await prisma.group.upsert({
    where: { id: 'grp-test-speed' },
    create: { id: 'grp-test-speed', tenantId: 'tenant-bapak', name: 'TEST', meaning: 'TEST', memberCount: 0 },
    update: { name: 'TEST' }
  });
  process.stdout.write('Q3: ' + (Date.now()-s3) + 'ms\n');

  // Test 4: User create
  const s4 = Date.now();
  try {
    await prisma.user.create({
      data: { id: 'usr-test-speed', email: 'test-speed@gehc.demo', name: 'Test Speed', gender: 'LAKI-LAKI',
              accountStatus: 'ACTIVE', onboardingStatus: 'ACTIVE', isBeyonders: true, authProvider: 'LOCAL' }
    });
    process.stdout.write('Q4: ' + (Date.now()-s4) + 'ms\n');
  } catch(e) { process.stdout.write('Q4 err: ' + e.code + '\n'); }

  // Test 5: RA create
  const s5 = Date.now();
  try {
    await prisma.roleAssignment.create({
      data: { id: 'ra-test-speed', userId: 'usr-test-speed', role: 'MENTEE', groupId: 'grp-test-speed',
              familyRole: 'MENTEE', assignedBy: u.id, isActive: true }
    });
    process.stdout.write('Q5: ' + (Date.now()-s5) + 'ms\n');
  } catch(e) { process.stdout.write('Q5 err: ' + e.code + '\n'); }

  // Test 6: User update
  const s6 = Date.now();
  await prisma.user.update({
    where: { id: 'usr-test-speed' },
    data: { giftsTop5: ['Faith'], giftsScores: {Faith: 42}, isBeyonders: true }
  });
  process.stdout.write('Q6: ' + (Date.now()-s6) + 'ms\n');

  // Test 7: Consecutive rapid queries (mimics loop)
  const s7 = Date.now();
  for (let i = 0; i < 10; i++) {
    await prisma.$queryRaw`SELECT ${i}`;
  }
  process.stdout.write('Q7 (10 queries): ' + (Date.now()-s7) + 'ms\n');

  // Cleanup
  await prisma.roleAssignment.deleteMany({where:{id:'ra-test-speed'}});
  await prisma.user.deleteMany({where:{id:'usr-test-speed'}});
  await prisma.group.deleteMany({where:{id:'grp-test-speed'}});
  process.stdout.write('Cleanup done\n');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
