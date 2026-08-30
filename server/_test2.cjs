const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();

async function test() {
  const sa = await p.user.findFirst({where:{email:'tech@gehc.demo'}});
  console.log('SA:', sa.id);
  
  const users = await p.user.findMany({select:{id:true,name:true}});
  console.log('Users:', users.length);
  
  const nm = new Map(users.map(u=>[u.name.toLowerCase(),u]));
  
  function findUser(n) {
    const lo = n.toLowerCase();
    if (nm.has(lo)) return nm.get(lo);
    for (const [k,u] of nm) {
      if (lo.includes(k) || k.includes(lo)) return u;
    }
    return null;
  }
  
  const names = ['Theodore Kowaas', 'Fladyna Mondoringin', 'Jessica Poyoh', 'Pnt. Kevin Kamagi (G)'];
  for (const n of names) {
    const clean = n.replace(/\s*\(G\)\s*/g,'').trim();
    const u = findUser(clean);
    console.log(clean, '->', u ? u.id : 'NOT FOUND');
  }
  
  // Test raw SQL insert
  const s4 = Date.now();
  await p.$executeRawUnsafe(
    'INSERT IGNORE INTO role_assignments (id, user_id, role, group_id, family_role, assigned_by, is_active, assigned_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
    'ra-test-cjs', 'usr-theodore-kowaas', 'MENTOR', 'grp-shalom', 'MENTOR', 'usr-tech'
  );
  console.log('RA insert:', Date.now()-s4, 'ms');
  
  await p.roleAssignment.deleteMany({where:{id:'ra-test-cjs'}});
  console.log('Cleanup done');
}

test().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
