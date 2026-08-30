#!/usr/bin/env node
/**
 * seed-youth-gehc.mjs — Ultra-fast seed using raw SQL
 */

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
  return { top5: t.map(([g])=>g), scores: Object.fromEntries(t) };
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
function esc(s) { return String(s).replace(/'/g, "''"); }

// Parse Excel
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

const gd = XLSX.utils.sheet_to_json(wb.Sheets['GIFT TEST STATUS'], {defval:'',header:1});
const gm = new Map();
for (let i=15;i<gd.length;i++) {
  const n=(gd[i][1]||'').toString().trim(), g=(gd[i][3]||'').toString().trim(), s=parseInt(gd[i][4])||0;
  if (n&&g&&s>0) gm.set(n.toLowerCase(),{gift:g,score:s});
}

console.log(`Groups: ${Object.keys(groups).length}, Gifts: ${gm.size}`);

const sa = await prisma.user.findFirst({where:{email:'tech@gehc.demo'}});

// Load existing users
const users = await prisma.user.findMany({select:{id:true,name:true}});
const nm = new Map(users.map(u=>[u.name.toLowerCase(),u]));

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

// Collect all users and RAs
const userSQL = [];
const raSQL = [];
const updateSQL = [];
const allEntries = [];

for (const [gn, gd] of Object.entries(groups)) {
  const gid = `grp-${slug(gn)}`;
  const entries = [
    [gd.mentor, 'MENTOR', 'MENTOR'],
    [gd.comentor, 'CO_MENTOR', 'CO_MENTOR'],
    ...gd.mentees.map(m => [m.replace(/\s*\(G\)\s*/g,'').trim(), 'MENTEE', 'MENTEE'])
  ];

  for (const [name, role, fr] of entries) {
    const cleanName = name;
    let u = find(cleanName);
    if (!u) {
      const uid = `usr-${slug(cleanName)}`;
      const g = gender(cleanName);
      userSQL.push(`INSERT IGNORE INTO users (id, email, name, gender, account_status, onboarding_status, is_beyonders, auth_provider, created_at) VALUES ('${esc(uid)}', '${esc(slug(cleanName))}@gehc.demo', '${esc(cleanName)}', '${esc(g)}', 'ACTIVE', 'ACTIVE', 1, 'LOCAL', NOW())`);
      u = {id:uid, name:cleanName};
      nm.set(cleanName.toLowerCase(), u);
    }

    const rid = `ra-${slug(cleanName)}-${slug(gn)}-${role.toLowerCase()}`;
    raSQL.push(`INSERT IGNORE INTO role_assignments (id, user_id, role, group_id, family_role, assigned_by, is_active, assigned_at) VALUES ('${esc(rid)}', '${esc(u.id)}', '${esc(role)}', '${esc(gid)}', '${esc(fr)}', '${esc(sa.id)}', 1, NOW())`);

    if (role === 'MENTEE') {
      const gift = gm.get(cleanName.toLowerCase());
      const gd2 = gift ? genGiftsFromExcel(gift) : genGifts(cleanName);
      const top5 = JSON.stringify(gd2.top5);
      const scores = JSON.stringify(gd2.scores);
      updateSQL.push(`UPDATE users SET gifts_top5 = '${esc(top5)}', gifts_scores = '${esc(scores)}', is_beyonders = 1 WHERE id = '${esc(u.id)}'`);
    }
  }
}

function genGiftsFromExcel(g) {
  return { top5: [g.gift], scores: { [g.gift]: g.score } };
}

// Execute batch SQL
console.log(`\nInserting ${userSQL.length} users...`);
for (const sql of userSQL) {
  await prisma.$executeRawUnsafe(sql);
}
console.log(`Inserting ${raSQL.length} role assignments...`);
for (const sql of raSQL) {
  await prisma.$executeRawUnsafe(sql);
}
console.log(`Updating ${updateSQL.length} users with gifts...`);
for (const sql of updateSQL) {
  await prisma.$executeRawUnsafe(sql);
}

// Summary
const rc = await prisma.roleAssignment.groupBy({by:['role'],_count:true});
console.log('\n=== Summary ===');
rc.forEach(r => console.log(`  ${r.role}: ${r._count}`));
const gc = await prisma.user.count({where:{giftsTop5:{not:null}}});
console.log(`  Users with gifts: ${gc}`);
console.log('\nDone!');
await prisma.$disconnect();
