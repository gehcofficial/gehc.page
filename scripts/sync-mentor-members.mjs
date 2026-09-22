// Sinkron baris GroupMember untuk mentor/comentor batch AKTIF.
// Akar masalah: mentor sering hanya punya RoleAssignment (tanpa baris GroupMember),
// sehingga roster/avatar Family Tree tidak sinkron.
//
// AMAN: default DRY-RUN (tidak menulis). Tambahkan --apply untuk menulis.
// Target DB mengikuti server/db.mjs (lokal default = staging; prod via GEHC_ENV=production).
//
// Contoh:
//   node scripts/sync-mentor-members.mjs                       # dry-run (staging)
//   node scripts/sync-mentor-members.mjs --apply               # apply (staging)
//   $env:GEHC_ENV='production'; node scripts/sync-mentor-members.mjs   # dry-run prod
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';
import { genSyncId, refreshGroupCounts } from '../server/lib/member-role-sync.mjs';

const APPLY = process.argv.includes('--apply');
const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi (DATABASE_URL_*).');
  process.exit(1);
}

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}`);

const batches = await prisma.groupBatch.findMany({
  where: { isCurrent: true },
  select: { groupId: true, period: true, mentorUserId: true, comentorUserId: true, mentorName: true, comentorName: true },
});
const groups = await prisma.group.findMany({ select: { id: true, name: true } }).catch(() => []);
const gname = new Map(groups.map((g) => [g.id, g.name]));

const plan = [];
for (const b of batches) {
  const pairs = [
    { userId: b.mentorUserId, role: 'MENTOR', fallbackName: b.mentorName },
    { userId: b.comentorUserId, role: 'COMENTOR', fallbackName: b.comentorName },
  ];
  for (const { userId, role, fallbackName } of pairs) {
    if (!userId) continue;
    const existing = await prisma.groupMember.findFirst({
      where: { groupId: b.groupId, userId, batchPeriod: b.period },
      select: { id: true },
    });
    if (existing) continue;
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    plan.push({ groupId: b.groupId, group: gname.get(b.groupId) || b.groupId, period: b.period, userId, role, name: u?.name || fallbackName || '(tanpa nama)' });
  }
}

console.log(`\nBatch aktif: ${batches.length} · rencana GroupMember baru: ${plan.length}`);
for (const x of plan) console.log(`  + ${x.group} ${x.period} | ${x.role} | ${x.name} (${x.userId})`);

if (!APPLY) {
  console.log('\n(dry-run) Tambahkan --apply untuk menulis.');
  await prisma.$disconnect();
  process.exit(0);
}

let created = 0;
for (const x of plan) {
  try {
    await prisma.groupMember.create({
      data: {
        id: genSyncId('gm'),
        groupId: x.groupId,
        userId: x.userId,
        name: x.name,
        familyRole: x.role,
        status: 'ACTIVE',
        batchPeriod: x.period,
      },
    });
    created += 1;
  } catch (e) {
    console.error(`  gagal ${x.group}/${x.name}: ${e.message}`);
  }
}
await refreshGroupCounts(prisma, [...new Set(plan.map((x) => x.groupId))]);
console.log(`\nSelesai. Dibuat: ${created}`);
await prisma.$disconnect();
