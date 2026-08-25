/**
 * Seed absensi 8 minggu terakhir + kondisi pemicu engine:
 *  - Grup pertama (urut nama) di-top-up jadi 10/10 dengan 2 mentee kehadiran 100% → pemicu MITOSIS
 *  - Satu mentee tiap grup absen 5 minggu terakhir → pemicu IDLE_FLAG
 * Jalankan: npm run db:seed:attendance:staging
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WEEKS = 8;

/** PRNG deterministik agar hasil seed konsisten */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

type Status = 'HADIR' | 'IZIN' | 'SAKIT' | 'TANPA_KABAR';

async function upsertAttendance(
  groupId: string,
  memberId: string,
  date: Date,
  status: Status
) {
  await prisma.attendanceRecord.upsert({
    where: { groupMemberId_date: { groupMemberId: memberId, date } },
    create: { id: `att-${memberId}-${date.toISOString().slice(0, 10)}`, groupId, groupMemberId: memberId, date, status },
    update: { status },
  });
}

async function main() {
  console.log('Menyemai absensi 8 minggu terakhir…');
  const year = String(new Date().getFullYear());
  const groups = await prisma.group.findMany({
    include: { members: true },
    orderBy: { name: 'asc' },
  });
  if (!groups.length) throw new Error('Belum ada grup — jalankan db:seed dulu.');

  const dates: Date[] = [];
  for (let i = 0; i < WEEKS; i++) {
    const d = new Date(Date.now() - i * 7 * 86400_000);
    d.setUTCHours(0, 0, 0, 0);
    dates.push(d);
  }
  const [oldest3, recent5] = [dates.slice().reverse().slice(0, 3), dates.slice(0, 5)];

  // --- Demo mitosis: grup pertama dipastikan penuh 10/10 ---
  const full = groups[0];
  let active = await prisma.groupMember.findMany({ where: { groupId: full.id, status: 'ACTIVE' } });
  let newcomerNo = 1;
  while (active.length < 10) {
    await prisma.groupMember.create({
      data: {
        id: `gm-${full.id}-new-${newcomerNo}`,
        groupId: full.id,
        name: `Newcomer ${full.name} ${newcomerNo}`,
        familyRole: 'MENTEE',
        status: 'ACTIVE',
        batchPeriod: year,
        joinedDate: new Date(),
      },
    });
    newcomerNo += 1;
    active = await prisma.groupMember.findMany({ where: { groupId: full.id, status: 'ACTIVE' } });
  }
  await prisma.group.update({ where: { id: full.id }, data: { memberCount: 10 } });

  const rand = lcg(20260824);

  for (const g of groups) {
    const members = await prisma.groupMember.findMany({ where: { groupId: g.id, status: 'ACTIVE' } });
    const mentees = members
      .filter((m) => m.familyRole === 'MENTEE')
      .sort((a, b) => a.name.localeCompare(b.name));
    const idleVictim = mentees[mentees.length - 1]; // satu anggota menunjukkan pola idle
    const isDemoFullGroup = g.id === full.id;

    for (const m of members) {
      const isTopPerformer =
        isDemoFullGroup && ['MENTEE'].includes(m.familyRole) && mentees.slice(0, 2).some((c) => c.id === m.id);

      for (let wi = 0; wi < WEEKS; wi++) {
        const date = dates[wi];
        let status: Status;
        if (idleVictim && m.id === idleVictim.id) {
          status = recent5.includes(date) ? 'TANPA_KABAR' : 'HADIR';
        } else if (isTopPerformer) {
          status = 'HADIR'; // kandidat promote — kehadiran 100%
        } else {
          const r = rand();
          status = r < 0.82 ? 'HADIR' : r < 0.9 ? 'IZIN' : r < 0.96 ? 'SAKIT' : 'TANPA_KABAR';
        }
        await upsertAttendance(g.id, m.id, date, status);
      }
    }
  }

  console.log(`✓ absensi ${WEEKS} minggu × semua grup aktif tersimpan`);
  console.log(`✓ ${full.name} dipastikan 10/10 (2 mentee kehadiran 100% sebagai kandidat promote)`);
  console.log('✓ tiap grup punya 1 contoh anggota idle 5 minggu (pemicu IDLE_FLAG)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
