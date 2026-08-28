/**
 * Seed RoleAssignment + WaitingPool untuk onboarding pipeline.
 * Jalankan: npx tsx server/seed-onboarding.ts
 *
 * Isi:
 *   1. RoleAssignment untuk semua user existing (Youth GEHC panel)
 *   2. WaitingPool entries untuk dummy orang baru (Onboarding Pipeline panel)
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { INITIAL_STRUKTUR } from '../src/data/initialData.ts';
import crypto from 'crypto';

const prisma = new PrismaClient();
const TENANT_ID = 'tenant-youth';
const ADMIN_ID = 'usr-tech';

function genId64(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================
// 1. ROLE ASSIGNMENTS — Mirror existing UserRole data
// ============================================================

async function seedRoleAssignments() {
  console.log('--- Seeding RoleAssignments ---');
  let count = 0;

  // SUPERADMIN
  const superadmin = await prisma.user.findUnique({ where: { id: 'usr-tech' } });
  if (superadmin) {
    await prisma.roleAssignment.upsert({
      where: { id: 'ra-superadmin-tech' },
      create: {
        id: 'ra-superadmin-tech',
        userId: 'usr-tech',
        role: 'SUPERADMIN',
        assignedBy: 'usr-tech',
        note: 'Superadmin utama',
      },
      update: {},
    });
    count++;
    console.log('  ✓ SUPERADMIN: Tim Tech GEHC');
  }

  // BPMJ — map from INITIAL_STRUKTUR division=BPMJ
  const bpmjMembers = INITIAL_STRUKTUR.filter((s) => s.division === 'BPMJ');
  for (const s of bpmjMembers) {
    const user = await prisma.user.findFirst({ where: { name: s.name } });
    if (!user) { console.log(`  ⚠ Skip BPMJ "${s.name}" — user not found`); continue; }
    const raId = `ra-${user.id}-bpmj`;
    await prisma.roleAssignment.upsert({
      where: { id: raId },
      create: {
        id: raId,
        userId: user.id,
        role: 'BPMJ',
        position: s.position || null,
        assignedBy: ADMIN_ID,
      },
      update: { position: s.position || null },
    });
    count++;
  }
  console.log(`  ✓ BPMJ: ${bpmjMembers.length} anggota`);

  // KOMISI — map from INITIAL_STRUKTUR division=KOMISI
  const komisiMembers = INITIAL_STRUKTUR.filter((s) => s.division === 'KOMISI');
  for (const s of komisiMembers) {
    const user = await prisma.user.findFirst({ where: { name: s.name } });
    if (!user) { console.log(`  ⚠ Skip KOMISI "${s.name}" — user not found`); continue; }
    const raId = `ra-${user.id}-komisi`;
    await prisma.roleAssignment.upsert({
      where: { id: raId },
      create: {
        id: raId,
        userId: user.id,
        role: 'KOMISI',
        position: s.position || null,
        assignedBy: ADMIN_ID,
      },
      update: { position: s.position || null },
    });
    count++;
  }
  console.log(`  ✓ KOMISI: ${komisiMembers.length} anggota`);

  // COMMITTEE — map from INITIAL_STRUKTUR division=TIMKERJA or has PIC role in seed-users
  const COMMITTEE_MAP: Array<{ userId: string; name: string; position: string; division: string; subdivision?: string }> = [
    { userId: 'usr-theodore-kowaas', name: 'Theodore Beckham Milano Kowaas', position: 'Ketua Tim Kerja', division: 'TIMKERJA' },
    { userId: 'usr-zhanon-lausan', name: 'Zhanon Varelie Lausan', position: 'Sekretaris Tim Kerja', division: 'TIMKERJA' },
    { userId: 'usr-milithya-wuisan', name: 'Milithya Christy Kerin Wuisan', position: 'Bendahara Tim Kerja', division: 'TIMKERJA' },
    { userId: 'usr-krisetia-mamoto', name: 'Krisetia Mamoto', position: 'PIC Acara & Rundown', division: 'KOINONIA', subdivision: 'Program Persekutuan' },
    { userId: 'usr-fladyna-mondoringin', name: 'Fladyna Mondoringin', position: 'Kepala Benzarpreneurship', division: 'BENZARPR' },
    { userId: 'usr-holly-kalele', name: 'Holly Kalele', position: 'PIC Ibadah', division: 'LITURGIA', subdivision: 'Liturgi & Musik' },
    { userId: 'usr-prichel-kampong', name: 'Prichel Kampong', position: 'PIC Logistik', division: 'DIAKONIA', subdivision: 'Logistik & Akomodasi' },
    { userId: 'usr-gievara-bogar', name: 'Gievara Bogar', position: 'PIC MTDD', division: 'MARTURIA', subdivision: 'Desain & Publikasi' },
    { userId: 'usr-artjuna-timbuleng', name: 'Artjuna Timbuleng', position: 'PIC Konsumsi', division: 'DIAKONIA', subdivision: 'Konsumsi' },
    { userId: 'usr-putri-massie', name: 'Putri Massie', position: 'Main Speaker', division: 'DIDASKALIA', subdivision: 'Kurikulum & Pembekalan' },
    { userId: 'usr-alvandi-saerang', name: 'Alvandi Saerang', position: 'Main Speaker', division: 'DIDASKALIA', subdivision: 'Kurikulum & Pembekalan' },
  ];

  for (const c of COMMITTEE_MAP) {
    const user = await prisma.user.findUnique({ where: { id: c.userId } });
    if (!user) { console.log(`  ⚠ Skip COMMITTEE "${c.userId}" — user not found`); continue; }
    const raId = `ra-${c.userId}-committee`;
    await prisma.roleAssignment.upsert({
      where: { id: raId },
      create: {
        id: raId,
        userId: user.id,
        role: 'COMMITTEE',
        position: c.position,
        division: c.division,
        subdivision: c.subdivision || null,
        assignedBy: ADMIN_ID,
      },
      update: { position: c.position, division: c.division, subdivision: c.subdivision || null },
    });
    count++;
  }
  console.log(`  ✓ COMMITTEE: ${COMMITTEE_MAP.length} anggota`);

  // MENTOR / CO_MENTOR from group_batches
  const batches = await prisma.groupBatch.findMany({ include: { group: true } });
  let mentorCount = 0;
  let comentorCount = 0;

  for (const b of batches) {
    // Mentor
    if (b.mentorName) {
      const user = await prisma.user.findFirst({ where: { name: b.mentorName } });
      if (user) {
        const raId = `ra-${user.id}-mentor-${b.groupId}`;
        await prisma.roleAssignment.upsert({
          where: { id: raId },
          create: {
            id: raId,
            userId: user.id,
            role: 'MENTOR',
            groupId: b.groupId,
            familyRole: 'MENTOR',
            assignedBy: ADMIN_ID,
            note: `Mentor ${b.group.name} — ${b.period}`,
          },
          update: {},
        });
        mentorCount++;
      }
    }

    // Co-Mentor
    if (b.comentorName) {
      const user = await prisma.user.findFirst({ where: { name: b.comentorName } });
      if (user) {
        const raId = `ra-${user.id}-comentor-${b.groupId}`;
        await prisma.roleAssignment.upsert({
          where: { id: raId },
          create: {
            id: raId,
            userId: user.id,
            role: 'MENTOR',
            groupId: b.groupId,
            familyRole: 'COMENTOR',
            assignedBy: ADMIN_ID,
            note: `Co-Mentor ${b.group.name} — ${b.period}`,
          },
          update: {},
        });
        comentorCount++;
      }
    }
  }
  console.log(`  ✓ MENTOR: ${mentorCount} | CO_MENTOR: ${comentorCount}`);

  // MENTEE from group_members
  const activeMentees = await prisma.groupMember.findMany({
    where: { status: 'ACTIVE', familyRole: 'MENTEE' },
    include: { group: true },
  });
  let menteeCount = 0;

  for (const m of activeMentees) {
    if (!m.userId) continue;
    const raId = `ra-${m.userId}-mentee-${m.groupId}`;
    await prisma.roleAssignment.upsert({
      where: { id: raId },
      create: {
        id: raId,
        userId: m.userId,
        role: 'MENTEE',
        groupId: m.groupId,
        familyRole: 'MENTEE',
        assignedBy: ADMIN_ID,
        note: `Mentee ${m.group.name}`,
      },
      update: {},
    });
    menteeCount++;
  }
  console.log(`  ✓ MENTEE: ${menteeCount}`);

  console.log(`\n✓ Total RoleAssignments: ${count + mentorCount + comentorCount + menteeCount}\n`);
}

// ============================================================
// 2. WAITING POOL — Dummy orang baru
// ============================================================

async function seedWaitingPool() {
  console.log('--- Seeding WaitingPool ---');

  // First, create users for PROFILE_COMPLETED entries
  const profileCompletedUsers = [
    { name: 'Joshua Wenas', email: 'joshua.wenas@gmail.com', phone: '081234567805', gender: 'LAKI-LAKI', origin: 'GMIM Philadelphobia Manado', giftsTop5: ['PENGAJARAN', 'HIKMAT', 'KEPEMIMPINAN', 'ADMINISTRASI', 'IMAN'], giftsScores: { PENGAJARAN: 14, HIKMAT: 13, KEPEMIMPINAN: 12, ADMINISTRASI: 11, IMAN: 10 } },
    { name: 'Metha Kaligis', email: 'metha.kaligis@gmail.com', phone: '081234567806', gender: 'PEREMPUAN', origin: 'GMIM Tatelu', giftsTop5: ['PENGUATAN', 'PELAYANAN', 'KASIH_KARUNIA', 'PERSEPSI', 'PENGETAHUAN'], giftsScores: { PENGUATAN: 15, PELAYANAN: 13, KASIH_KARUNIA: 12, PERSEPSI: 11, PENGETAHUAN: 10 } },
    { name: 'Christo Pandelaki', email: 'christo.pandelaki@outlook.com', phone: '081234567807', gender: 'LAKI-LAKI', origin: 'GMIM Syalom Ranotana', giftsTop5: ['EVANGELISME', 'PENGUATAN', 'NUBUAT', 'HIKMAT', 'KEPEMIMPINAN'], giftsScores: { EVANGELISME: 14, PENGUATAN: 13, NUBUAT: 12, HIKMAT: 11, KEPEMIMPINAN: 10 } },
    { name: 'Gracella Tairas', email: 'gracella.tairas@gmail.com', phone: '081234567808', gender: 'PEREMPUAN', origin: 'GMIM Getsemani Tikala', giftsTop5: ['PENGUATAN', 'PENGAJARAN', 'PELAYANAN', 'KASIH_KARUNIA', 'IMAN'], giftsScores: { PENGUATAN: 15, PENGAJARAN: 13, PELAYANAN: 12, KASIH_KARUNIA: 11, IMAN: 10 } },
  ];

  // Create or get users
  const createdUsers = [];
  for (const u of profileCompletedUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        id: genId64(),
        email: u.email,
        name: u.name,
        phone: u.phone,
        gender: u.gender,
        avatar: null,
        accountStatus: 'ACTIVE',
        onboardingStatus: 'PENDING',
        isBeyonders: false,
        giftsTop5: u.giftsTop5,
        giftsScores: u.giftsScores,
        origin: u.origin,
      },
      update: {
        name: u.name,
        phone: u.phone,
        gender: u.gender,
        giftsTop5: u.giftsTop5,
        giftsScores: u.giftsScores,
        onboardingStatus: 'PENDING',
      },
    });
    createdUsers.push({ ...u, userId: user.id });
  }

  const DUMMY_ENTRIES = [
    // WAITING_POOL (belum isi profil)
    { name: 'Marvel Ngantung', email: 'marvel.ngantung@gmail.com', phone: '081234567801', gender: 'LAKI-LAKI', origin: 'GMIM Betlehem Tondano', status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'BAKUTAU 4.0' },
    { name: 'Sheryl Pongoh', email: 'sheryl.pongoh@gmail.com', phone: '081234567802', gender: 'PEREMPUAN', origin: 'GMIM Sentrum Manado', status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'BAKUTAU 4.0' },
    { name: 'Rivaldo Tumbelaka', email: null, phone: '081234567803', gender: 'LAKI-LAKI', origin: null, status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'Instagram' },
    { name: 'Cecilia Luntungan', email: 'cecilia.luntungan@yahoo.com', phone: '081234567804', gender: 'PEREMPUAN', origin: 'GMIM Bukit Moria Sasaran', status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'Word of Mouth' },

    // PROFILE_COMPLETED (profil lengkap, menunggu role) — dengan gift test data untuk Jethro Placement Review
    { name: 'Joshua Wenas', email: 'joshua.wenas@gmail.com', phone: '081234567805', gender: 'LAKI-LAKI', origin: 'GMIM Philadelphobia Manado', status: 'PROFILE_COMPLETED', giftTestDone: true, profileCompleted: true, sourceEvent: 'BAKUTAU 4.0', userId: createdUsers.find(u => u.name === 'Joshua Wenas')?.userId, giftsTop5: ['PENGAJARAN', 'HIKMAT', 'KEPEMIMPINAN', 'ADMINISTRASI', 'IMAN'], giftsScores: { PENGAJARAN: 14, HIKMAT: 13, KEPEMIMPINAN: 12, ADMINISTRASI: 11, IMAN: 10 } },
    { name: 'Metha Kaligis', email: 'metha.kaligis@gmail.com', phone: '081234567806', gender: 'PEREMPUAN', origin: 'GMIM Tatelu', status: 'PROFILE_COMPLETED', giftTestDone: true, profileCompleted: true, sourceEvent: 'BAKUTAU 4.0', userId: createdUsers.find(u => u.name === 'Metha Kaligis')?.userId, giftsTop5: ['PENGUATAN', 'PELAYANAN', 'KASIH_KARUNIA', 'PERSEPSI', 'PENGETAHUAN'], giftsScores: { PENGUATAN: 15, PELAYANAN: 13, KASIH_KARUNIA: 12, PERSEPSI: 11, PENGETAHUAN: 10 } },
    { name: 'Christo Pandelaki', email: 'christo.pandelaki@outlook.com', phone: '081234567807', gender: 'LAKI-LAKI', origin: 'GMIM Syalom Ranotana', status: 'PROFILE_COMPLETED', giftTestDone: true, profileCompleted: true, sourceEvent: 'Instagram', userId: createdUsers.find(u => u.name === 'Christo Pandelaki')?.userId, giftsTop5: ['EVANGELISME', 'PENGUATAN', 'NUBUAT', 'HIKMAT', 'KEPEMIMPINAN'], giftsScores: { EVANGELISME: 14, PENGUATAN: 13, NUBUAT: 12, HIKMAT: 11, KEPEMIMPINAN: 10 } },
    { name: 'Gracella Tairas', email: 'gracella.tairas@gmail.com', phone: '081234567808', gender: 'PEREMPUAN', origin: 'GMIM Getsemani Tikala', status: 'PROFILE_COMPLETED', giftTestDone: true, profileCompleted: true, sourceEvent: 'Friend', userId: createdUsers.find(u => u.name === 'Gracella Tairas')?.userId, giftsTop5: ['PENGUATAN', 'PENGAJARAN', 'PELAYANAN', 'KASIH_KARUNIA', 'IMAN'], giftsScores: { PENGUATAN: 15, PENGAJARAN: 13, PELAYANAN: 12, KASIH_KARUNIA: 11, IMAN: 10 } },

    // ROLE_ASSIGNED (sudah dapat role)
    { name: 'Davi Kondoy', email: 'davi.kondoy@gmail.com', phone: '081234567809', gender: 'LAKI-LAKI', origin: 'GMIM Bukit Zuriahabad', status: 'ROLE_ASSIGNED', giftTestDone: true, profileCompleted: true, sourceEvent: 'BAKUTAU 4.0' },
    { name: 'Valencia Wurarah', email: 'valencia.wurarah@gmail.com', phone: '081234567810', gender: 'PEREMPUAN', origin: 'GMIM Sentrum Amurang', status: 'ROLE_ASSIGNED', giftTestDone: true, profileCompleted: true, sourceEvent: 'BAKUTAU 4.0' },
  ];

  for (let i = 0; i < DUMMY_ENTRIES.length; i++) {
    const e = DUMMY_ENTRIES[i];
    const id = `wp-dummy-${i + 1}`;
    const registeredAt = new Date(Date.now() - (30 - i * 3) * 24 * 60 * 60 * 1000);

    await prisma.waitingPool.upsert({
      where: { id },
      create: {
        id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        gender: e.gender,
        origin: e.origin,
        status: e.status,
        giftTestDone: e.giftTestDone,
        profileCompleted: e.profileCompleted,
        profileCompletedAt: e.profileCompleted ? new Date(Date.now() - (20 - i) * 24 * 60 * 60 * 1000) : null,
        sourceEvent: e.sourceEvent,
        giftsTop5: e.giftsTop5 || null,
        giftsScores: e.giftsScores || null,
        registeredAt,
      },
      update: {
        name: e.name,
        email: e.email,
        phone: e.phone,
        gender: e.gender,
        origin: e.origin,
        status: e.status,
        giftTestDone: e.giftTestDone,
        profileCompleted: e.profileCompleted,
        profileCompletedAt: e.profileCompleted ? new Date(Date.now() - (20 - i) * 24 * 60 * 60 * 1000) : null,
        sourceEvent: e.sourceEvent,
        giftsTop5: e.giftsTop5 || null,
        giftsScores: e.giftsScores || null,
        userId: e.userId || null,
      },
    });
  }

  const waitingCount = DUMMY_ENTRIES.filter((e) => e.status === 'WAITING_POOL').length;
  const pendingCount = DUMMY_ENTRIES.filter((e) => e.status === 'PROFILE_COMPLETED').length;
  const assignedCount = DUMMY_ENTRIES.filter((e) => e.status === 'ROLE_ASSIGNED').length;

  console.log(`  ✓ WAITING_POOL: ${waitingCount} orang`);
  console.log(`  ✓ PROFILE_COMPLETED: ${pendingCount} orang`);
  console.log(`  ✓ ROLE_ASSIGNED: ${assignedCount} orang`);
  console.log(`\n✓ Total WaitingPool dummy: ${DUMMY_ENTRIES.length}\n`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🌱 Seeding Onboarding Pipeline (RoleAssignment + WaitingPool)...\n');

  await seedRoleAssignments();
  await seedWaitingPool();

  console.log('✅ Seeding selesai!');
  console.log('   - Youth GEHC panel: role assignments dari data existing');
  console.log('   - Onboarding Pipeline: 10 dummy entries');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
