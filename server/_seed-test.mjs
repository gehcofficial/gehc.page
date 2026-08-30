import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const EXCEL = 'D:/AISaerang Life/Services/Youth/Retreat Attendance_GEHC YOUTH 2026.xlsx';

const GIFTS = [
  'Administration','Apostleship','Craftsmanship','Discernment','Evangelism',
  'Exhortation','Faith','Giving','Healing','Hospitality','Intercession',
  'Leadership','Mercy','Miracles','Pastor/Shepherd','Prophecy','Service',
  'Teaching','Tongues and Interpretation','Word of Knowledge','Word of Wisdom','Helps'
];

function genGifts(name) {
  const h = createHash('md5').update(name).digest();
  const used = new Set(); const s = {};
  for (let i = 0; i < 5; i++) {
    let idx; do { idx = h[i*3] % GIFTS.length; } while (used.has(idx));
    used.add(idx); s[GIFTS[idx]] = 10 + (h[i*3+1] % 40);
  }
  const t = Object.entries(s).sort((a,b) => b[1]-a[1]).slice(0,5);
  return { giftsTop5: t.map(([g])=>g), giftsScores: Object.fromEntries(t) };
}

function gender(name) {
  if (name.includes('(G)')) return 'PEREMPUAN';
  const lo = name.toLowerCase();
  return ['putri','jessica','gemma','riska','kimberly','fladyna','nicole','chelsea',
    'virginia','michelle','ivanna','nelcy','aurellia','yohana','akwila','lovely',
    'agnes','thea','jilova','natalie','cia','kezia','syallomitha','injilia',
    'angelita','resty','soneta','mega','trivena','gracia','glenity','shanella',
    'lingkan','julivie','patrisha','milithya','prichel','shien','avriel'
  ].some(p => lo.includes(p)) ? 'PEREMPUAN' : 'LAKI-LAKI';
}

function slug(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

async function main() {
  console.log('Step 1: Parse Excel');
  const wb = XLSX.readFile(EXCEL);

  const data = XLSX.utils.sheet_to_json(wb.Sheets['MATRIKS ABSENSI'], {defval:'',header:1});
  const groups = {}; let cur = '';
  for (const r of data) {
    const c0 = (r[0]||'').toString().trim(), c1 = (r[1]||'').toString().trim();
    if (c0.startsWith('KELOMPOK:')) {
      const m = c0.match(/KELOMPOK:\s*([A-Z]+)\s*\(MENTOR:\s*(.+?)\s*&\s*CO-MENTOR:\s*(.+?)\)/);
      if (m) { cur=m[1]; groups[cur]={mentor:m[2],comentor:m[3],mentees:[]}; }
    } else if (c1.startsWith('Nama Mentee') && cur && c0) groups[cur].mentees.push(c0);
  }
  console.log('  Groups:', Object.keys(groups).join(', '));

  const gd = XLSX.utils.sheet_to_json(wb.Sheets['GIFT TEST STATUS'], {defval:'',header:1});
  const gm = new Map();
  for (let i=15;i<gd.length;i++) {
    const n=(gd[i][1]||'').toString().trim(), g=(gd[i][3]||'').toString().trim(), s=parseInt(gd[i][4])||0;
    if (n&&g&&s>0) gm.set(n.toLowerCase(),{gift:g,score:s});
  }
  console.log('  Gift records:', gm.size);

  console.log('Step 2: DB setup');
  const t = await prisma.tenant.findFirst();
  console.log('  Tenant:', t.id);
  const sa = await prisma.user.findFirst({where:{email:'tech@gehc.demo'}});
  console.log('  Superadmin:', sa.id);

  console.log('Step 3: Load users');
  const users = await prisma.user.findMany({select:{id:true,name:true}});
  const nm = new Map(users.map(u=>[u.name.toLowerCase(),u]));
  console.log('  Users:', users.length);

  function find(n) {
    const lo=n.toLowerCase();
    if (nm.has(lo)) return nm.get(lo);
    for (const [k,u] of nm) {
      if (lo.includes(k)||k.includes(lo)) return u;
      const a=lo.split(/\s+/),b=k.split(/\s+/);
      if (a.length>=2&&b.length>=2&&a[0]===b[0]&&a[a.length-1]===b[b.length-1]) return u;
    }
    return null;
  }

  console.log('Step 4: Create groups');
  const groupIds = {};
  for (const gn of Object.keys(groups)) {
    const gid = `grp-${slug(gn)}`;
    await prisma.group.upsert({
      where:{id:gid},
      create:{id:gid,tenantId:t.id,name:gn,meaning:gn,memberCount:groups[gn].mentees.length+2},
      update:{memberCount:groups[gn].mentees.length+2}
    });
    groupIds[gn] = gid;
    console.log('  Created:', gn);
  }

  let createdUsers = 0, createdRA = 0;
  const totalPeople = Object.values(groups).reduce((s,g) => s + g.mentees.length + 2, 0);
  console.log(`Step 5: Create roles (${totalPeople} people)`);
  let processed = 0;

  for (const [gn, gd] of Object.entries(groups)) {
    const gid = groupIds[gn];
    const entries = [
      [gd.mentor, 'MENTOR', 'MENTOR'],
      [gd.comentor, 'CO_MENTOR', 'CO_MENTOR'],
      ...gd.mentees.map(m => [m.replace(/\s*\(G\)\s*/g,'').trim(), 'MENTEE', 'MENTEE'])
    ];

    for (const [name, role, fr] of entries) {
      processed++;
      let u = find(name);
      if (!u) {
        const uid = `usr-${slug(name)}`;
        try {
          await prisma.user.create({data:{
            id:uid, email:`${slug(name)}@gehc.demo`, name, gender:gender(name),
            accountStatus:'ACTIVE', onboardingStatus:'ACTIVE', isBeyonders:true, authProvider:'LOCAL'
          }});
          createdUsers++;
          u = {id:uid, name};
          nm.set(name.toLowerCase(), u);
        } catch(e) { if(e.code!=='P2002') console.log('  User error:', e.code); u = {id:uid, name}; }
      }

      const rid = `ra-${slug(name)}-${slug(gn)}`;
      try {
        await prisma.roleAssignment.create({data:{
          id:rid, userId:u.id, role, groupId:gid, familyRole:fr, assignedBy:sa.id
        }});
        createdRA++;
      } catch(e) { if(e.code!=='P2002') console.log('  RA error:', e.code, name, role); }

      if (role === 'MENTEE') {
        const gift = gm.get(name.toLowerCase());
        const gData = gift ? {giftsTop5:[gift.gift],giftsScores:{[gift.gift]:gift.score}} : genGifts(name);
        await prisma.user.update({where:{id:u.id},data:{...gData,isBeyonders:true}});
      }

      if (processed % 10 === 0) console.log(`  Progress: ${processed}/${totalPeople}`);
    }
    console.log(`  ${gn}: done (${processed}/${totalPeople})`);
  }

  console.log('\n=== Summary ===');
  console.log(`Created users: ${createdUsers}`);
  console.log(`Created roles: ${createdRA}`);
  const rc = await prisma.roleAssignment.groupBy({by:['role'],_count:true});
  rc.forEach(r => console.log(`  ${r.role}: ${r._count}`));
  const gc = await prisma.user.count({where:{giftsTop5:{not:null}}});
  console.log(`  Users with gifts: ${gc}`);
  console.log('\nDone!');
}

main().catch(e=>{console.error('Fatal:',e);process.exit(1)}).finally(()=>prisma.$disconnect());
