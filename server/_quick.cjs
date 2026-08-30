const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  process.stdout.write('START\n');
  const u = await prisma.user.findFirst({where:{email:'tech@gehc.demo'}});
  process.stdout.write('SA: ' + u.id + '\n');

  const m = await prisma.user.update({
    where: { id: 'usr-jessica-poyoh' },
    data: { giftsTop5: ['Faith'], giftsScores: {Faith: 42}, isBeyonders: true }
  });
  process.stdout.write('Updated: ' + m.id + ' gifts: ' + JSON.stringify(m.giftsTop5) + '\n');

  process.stdout.write('DONE\n');
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
