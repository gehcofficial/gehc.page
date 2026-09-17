require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

/**
 * Revert aksi "Tetapkan Mentor" Jurry Tani di Agape (grp-2) periode 2026-09
 * → kembalikan ke Gen0 2026-06 (hanya Prichel sebagai MENTOR).
 * Backup dulu. Idempotent.
 */
const JURRY = 'usr-28aa5217-d0e1-496a-aa82-9b9efef8aaf4';
const PRICHEL = 'usr-d314800e668df231';
const GROUP = 'grp-2';

(async () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: ['error'],
  });

  const dir = path.join(process.cwd(), 'backups', `revert-jurry-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(dir, { recursive: true });

  const ra = await prisma.roleAssignment.findMany({ where: { userId: JURRY, groupId: GROUP } });
  const ur = await prisma.userRole.findMany({ where: { userId: JURRY } });
  const gm = await prisma.groupMember.findMany({ where: { userId: JURRY } });
  const mt = await prisma.mentorTransition.findMany({ where: { incomingUserId: JURRY } });
  fs.writeFileSync(path.join(dir, 'jurry.json'), JSON.stringify({ ra, ur, gm, mt }, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  console.log(`backup → ${dir} (ra:${ra.length} ur:${ur.length} gm:${gm.length} mt:${mt.length})`);

  const delMt = await prisma.mentorTransition.deleteMany({ where: { incomingUserId: JURRY } });
  const delRa = await prisma.roleAssignment.deleteMany({ where: { userId: JURRY, groupId: GROUP } });
  const delUr = await prisma.userRole.deleteMany({ where: { userId: JURRY, groupId: GROUP } });
  const delGm = await prisma.groupMember.deleteMany({ where: { userId: JURRY, groupId: GROUP } });
  console.log(`dihapus: transitions=${delMt.count} roleAssignments=${delRa.count} userRoles=${delUr.count} groupMembers=${delGm.count}`);

  // Pulihkan flag Jurry bila tak ada grup aktif lagi.
  const remainingGroupRoles = await prisma.userRole.count({ where: { userId: JURRY, groupId: { not: null } } });
  if (remainingGroupRoles === 0) {
    await prisma.user.update({ where: { id: JURRY }, data: { isBeyonders: false, isIndividuExplicit: false } }).catch(() => {});
    console.log('flag Jurry dipulihkan (isBeyonders=false)');
  } else {
    console.log(`Jurry masih punya ${remainingGroupRoles} role grup — flag dibiarkan`);
  }

  // Verifikasi Agape.
  const activeMentors = await prisma.roleAssignment.findMany({
    where: { groupId: GROUP, role: 'MENTOR', isActive: true },
    select: { userId: true },
  });
  const members = await prisma.groupMember.groupBy({ by: ['batchPeriod'], where: { groupId: GROUP }, _count: { _all: true } });
  const mtCount = await prisma.mentorTransition.count();
  console.log('verifikasi Agape MENTOR aktif:', activeMentors.map((m) => m.userId).join(', ') || '(tidak ada)');
  console.log('verifikasi member period:', JSON.stringify(members));
  console.log('verifikasi mentor_transitions total:', mtCount);
  console.log('Prichel masih MENTOR aktif:', activeMentors.some((m) => m.userId === PRICHEL));

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
