const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();

async function test() {
  // Check actual column names in role_assignments
  const cols = await p.$queryRawUnsafe("SHOW COLUMNS FROM role_assignments");
  console.log('role_assignments columns:');
  cols.forEach(c => console.log(' ', c.Field, c.Type));
  
  // Check users columns  
  const ucols = await p.$queryRawUnsafe("SHOW COLUMNS FROM users");
  console.log('\nusers columns:');
  ucols.forEach(c => console.log(' ', c.Field, c.Type));
  
  // Check groups columns
  const gcols = await p.$queryRawUnsafe("SHOW COLUMNS FROM groups");
  console.log('\ngroups columns:');
  gcols.forEach(c => console.log(' ', c.Field, c.Type));
}

test().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
