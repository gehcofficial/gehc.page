const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  process.stdout.write('Step 1\n');
  const sa = await prisma.user.findFirst({where:{email:'tech@gehc.demo'}});
  process.stdout.write('Step 2: ' + sa.id + '\n');
  
  const groups = ['SHALOM','AVODAH','ECHAD','RUACH','HESED','DUNAMIS','AGAPE','KAIROS','METANOIA','LOGOS'];
  
  for (let i = 0; i < groups.length; i++) {
    const gn = groups[i];
    const slug = gn.toLowerCase();
    const gid = 'grp-' + slug;
    process.stdout.write('  Creating group ' + gn + '...\n');
    
    await prisma.group.upsert({
      where: { id: gid },
      create: { id: gid, tenantId: 'tenant-bapak', name: gn, meaning: gn, memberCount: 8 },
      update: { memberCount: 8 }
    });
    process.stdout.write('  Group ' + gn + ' OK\n');

    process.stdout.write('  Creating RA for ' + gn + '...\n');
    try {
      await prisma.roleAssignment.create({
        data: {
          id: 'ra-test-' + slug,
          userId: 'usr-theodore-kowaas',
          role: 'MENTOR',
          groupId: gid,
          familyRole: 'MENTOR',
          assignedBy: sa.id,
          isActive: true
        }
      });
      process.stdout.write('  RA ' + gn + ' OK\n');
    } catch(e) {
      process.stdout.write('  RA ' + gn + ' ERR: ' + e.code + '\n');
    }
  }
  
  process.stdout.write('ALL DONE\n');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
