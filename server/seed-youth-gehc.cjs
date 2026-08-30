require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const { createHash } = require('crypto');

const prisma = new PrismaClient();
const GIFTS = [
  'Administration','Apostleship','Craftsmanship','Discernment','Evangelism',
  'Exhortation','Faith','Giving','Healing','Hospitality','Intercession',
  'Leadership','Mercy','Miracles','Pastor/Shepherd','Prophecy','Service',
  'Teaching','Tongues and Interpretation','Word of Knowledge','Word of Wisdom','Helps'
];
function genGifts(name) {
  const h = createHash('md5').update(name).digest();
  const used = new Set(); const s = {};
  for (let i = 0; i < 5; i++) { let idx; do { idx = h[i*3] % GIFTS.length; } while (used.has(idx)); used.add(idx); s[GIFTS[idx]] = 10 + (h[i*3+1] % 40); }
  const t = Object.entries(s).sort((a,b) => b[1]-a[1]).slice(0,5);
  return { top5: t.map(([g])=>g), scores: Object.fromEntries(t) };
}

const EXCEL_GIFTS = {
  'jessica poyoh': ['Pastor/Shepherd',9],
  'kimberly turambi': ['Leadership',9],
  'kimmy casey liogu': ['Miracles',10],
  'putri massie': ['Teaching',7],
  'hoky theos': ['Helps',29],
  'jilova pakasi': ['Exhortation',17],
  'natalie musak': ['Intercession',1],
  'kezia joseph': ['Evangelism',7],
  'syallomitha mawitjere': ['Faith',47],
  'prichel kampong': ['Craftsmanship',18],
  'nelcy lodarmase': ['Discernment',16],
  'aurellia hillary': ['Hospitality',16],
  'akwila gente': ['Giving',10],
  'timothy mewengkang': ['Apostleship',8],
  'agnes reimas': ['Tongues and Interpretation',1],
  'avriel singal': ['Administration',19],
  'imanuel yimna esau': ['Prophecy',6],
  'shanella mondong': ['Healing',5],
  'glenity siauw': ['Word of Wisdom',5],
  'lingkan pinontoan': ['Giving',10],
  'jonathan tintingon': ['Giving',10],
  'yuen pajow': ['Mercy',19],
  'jacqson naharia': ['Word of Knowledge',3],
  'mega welan': ['Healing',5],
  'soneta imanuela': ['Teaching',7],
};

async function main() {
  process.stdout.write('DB URL: ' + (process.env.DATABASE_URL ? 'configured' : 'MISSING') + '\n');

  // Phase 1: Groups
  process.stdout.write('\n--- Phase 1: Groups ---\n');
  const groupNames = ['SHALOM','AVODAH','ECHAD','RUACH','HESED','DUNAMIS','AGAPE','KAIROS','METANOIA','LOGOS'];
  for (const gn of groupNames) {
    const gid = 'grp-' + gn.toLowerCase();
    await prisma.group.upsert({
      where: { id: gid },
      create: { id: gid, tenantId: 'tenant-bapak', name: gn, meaning: gn, memberCount: 8 },
      update: { memberCount: 8 }
    });
  }
  process.stdout.write('10 groups OK\n');

  // Phase 2: Users via createMany
  process.stdout.write('\n--- Phase 2: Users ---\n');
  const XLSX = require('xlsx');
  const wb = XLSX.readFile('D:/AISaerang Life/Services/Youth/Retreat Attendance_GEHC YOUTH 2026.xlsx');
  const data = XLSX.utils.sheet_to_json(wb.Sheets['MATRIKS ABSENSI'], {defval:'',header:1});
  const groups = {}; let cur = '';
  for (const r of data) {
    const c0 = (r[0]||'').toString().trim(), c1 = (r[1]||'').toString().trim();
    if (c0.startsWith('KELOMPOK:')) {
      const m = c0.match(/KELOMPOK:\s*([A-Z]+)\s*\(MENTOR:\s*(.+?)\s*&\s*CO-MENTOR:\s*(.+?)\)/);
      if (m) { cur=m[1]; groups[cur]={mentor:m[2],comentor:m[3],mentees:[]}; }
    } else if (c1.startsWith('Nama Mentee') && cur && c0) groups[cur].mentees.push(c0);
  }

  function slug(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function gender(name) {
    if (name.includes('(G)')) return 'PEREMPUAN';
    const lo = name.toLowerCase();
    return ['putri','jessica','gemma','riska','kimberly','fladyna','nicole','chelsea','virginia','michelle','ivanna','nelcy','aurellia','yohana','akwila','lovely','agnes','thea','jilova','natalie','cia','kezia','syallomitha','injilia','angelita','resty','soneta','mega','trivena','gracia','glenity','shanella','lingkan','julivie','patrisha','milithya','prichel','shien','avriel'].some(p => lo.includes(p)) ? 'PEREMPUAN' : 'LAKI-LAKI';
  }

  const allNames = [];
  for (const [gn, gd] of Object.entries(groups)) {
    allNames.push({name: gd.mentor, role: 'MENTOR', fr: 'MENTOR', group: gn});
    allNames.push({name: gd.comentor, role: 'CO_MENTOR', fr: 'CO_MENTOR', group: gn});
    for (const m of gd.mentees) {
      allNames.push({name: m.replace(/\s*\(G\)\s*/g,'').trim(), role: 'MENTEE', fr: 'MENTEE', group: gn});
    }
  }

  const sa = await prisma.user.findFirst({where:{email:'tech@gehc.demo'}});
  const users = await prisma.user.findMany({select:{id:true,name:true}});
  const nm = new Map(users.map(u=>[u.name.toLowerCase(), u]));
  process.stdout.write('Loaded ' + users.length + ' users\n');

  // Create missing users
  const newUsers = [];
  for (const p of allNames) {
    if (!nm.has(p.name.toLowerCase())) {
      const uid = 'usr-' + slug(p.name);
      newUsers.push({ id: uid, email: slug(p.name)+'@gehc.demo', name: p.name, gender: gender(p.name), accountStatus:'ACTIVE', onboardingStatus:'ACTIVE', isBeyonders:true, authProvider:'LOCAL' });
      nm.set(p.name.toLowerCase(), {id:uid, name:p.name});
    }
  }
  if (newUsers.length > 0) {
    await prisma.user.createMany({data: newUsers, skipDuplicates: true});
  }
  process.stdout.write('Created ' + newUsers.length + ' new users\n');

  // Phase 3: Role assignments via createMany
  process.stdout.write('\n--- Phase 3: Role Assignments ---\n');
  const ras = allNames.map(p => {
    const u = nm.get(p.name.toLowerCase());
    return {
      id: 'ra-'+slug(p.name)+'-'+slug(p.group)+'-'+p.role.toLowerCase(),
      userId: u.id, role: p.role, groupId: 'grp-'+slug(p.group),
      familyRole: p.fr, assignedBy: sa.id, isActive: true
    };
  }).filter(r => r.userId);

  await prisma.roleAssignment.createMany({data: ras, skipDuplicates: true});
  process.stdout.write('RAs: ' + ras.length + ' total\n');

  // Phase 4: Gifts (fresh client to avoid pool exhaustion)
  process.stdout.write('\n--- Phase 4: Gifts ---\n');
  await prisma.$disconnect();
  const prisma2 = new PrismaClient();
  let updated = 0;
  const mentees = allNames.filter(p => p.role === 'MENTEE');
  for (const p of mentees) {
    const u = nm.get(p.name.toLowerCase());
    if (!u) continue;
    const gift = EXCEL_GIFTS[p.name.toLowerCase()];
    const gd = gift ? {top5:[gift[0]],scores:{[gift[0]]:gift[1]}} : genGifts(p.name);
    await prisma2.user.update({
      where: { id: u.id },
      data: { giftsTop5: gd.top5, giftsScores: gd.scores, isBeyonders: true }
    });
    updated++;
    if (updated % 10 === 0) process.stdout.write('  ' + updated + '\n');
  }
  await prisma2.$disconnect();
  process.stdout.write('Gifts: ' + updated + ' users\n');

  // Summary
  const rc = await prisma.roleAssignment.groupBy({by:['role'],_count:true});
  process.stdout.write('\n=== Summary ===\n');
  rc.forEach(r => process.stdout.write('  ' + r.role + ': ' + r._count + '\n'));
  process.stdout.write('\nDone!\n');
}

main().catch(e=>{console.error('Fatal:',e);process.exit(1)}).finally(()=>prisma.$disconnect());
