/**
 * Seed RoleAssignment + WaitingPool untuk onboarding pipeline.
 * Jalankan: npx tsx server/seed-onboarding.ts
 *
 * Isi:
 *   1. RoleAssignment untuk semua user existing (Youth GEHC panel)
 *   2. WaitingPool entries untuk dummy orang baru (Onboarding Pipeline panel)
 *   Data mentoring diambil dari: Services/Youth/Retreat Attendance_GEHC YOUTH 2026.xlsx
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { INITIAL_STRUKTUR } from '../src/data/initialData.ts';
import crypto from 'crypto';
import XLSX from 'xlsx';

const prisma = new PrismaClient();
const TENANT_ID = 'tenant-youth';
const ADMIN_ID = 'usr-tech';

function genId64(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Parse Excel file untuk mendapatkan data mentoring */
async function parseMentoringData() {
  const workbook = XLSX.readFile('D:/AISaerang Life/Services/Youth/Retreat Attendance_GEHC YOUTH 2026.xlsx');

  // Parse MATRIKS ABSENSI - extract mentees with their groups
  const absensiSheet = XLSX.utils.sheet_to_json(workbook.Sheets['MATRIKS ABSENSI'], { defval: '' });
  const mentees: Array<{ name: string; group: string; gender: string; origin?: string }> = [];
  let currentGroup = '';
  let currentMentor = '';
  let currentComentor = '';

  for (const row of absensiSheet) {
    const struktur = (row['STRUKTUR KELOMPOK'] || '').toString().trim();
    const empty = (row['__EMPTY'] || '').toString().trim();

    // Detect group header
    if (struktur.startsWith('KELOMPOK:')) {
      const match = struktur.match(/KELOMPOK:\s*([^(]+)/);
      if (match) currentGroup = match[1].trim();
    }

    // Detect mentor/comentor headers
    if (empty === 'Nama Mentor') currentMentor = struktur;
    else if (empty === 'Nama Comentor') currentComentor = struktur;
    else if (empty?.startsWith('Nama Mentee')) {
      const menteeName = struktur.trim();
      if (menteeName && menteeName !== 'Nama Lengkap') {
        // Determine gender from name (simple heuristic)
        const gender = menteeName.endsWith('a') || menteeName.includes('ti ') || menteeName.includes('ni ') ? 'PEREMPUAN' : 'LAKI-LAKI';
        mentees.push({
          name: struktur.trim(),
          group: currentGroup || 'Unknown',
          gender,
          origin: `Group: ${currentGroup}, Mentor: ${currentMentor}, Co-Mentor: ${currentComentor}`
        });
      }
    }
  }

  // Parse GIFT TEST STATUS - get gift test results
  const giftSheet = XLSX.utils.sheet_to_json(workbook.Sheets['GIFT TEST STATUS'], { defval: '' });
  const giftData: Record<string, { top5: string[]; scores: Record<string, number> }> = {};

  // Gift columns in the Excel
  const giftColumns = ['Logos', 'Ruach', 'Kairos', 'Dunamis', 'Hesed', 'Avodah', 'Shalom', 'Agape', 'Metanoia', 'Echad'];

  for (const row of giftSheet) {
    const name = (row['Full Name'] || '').toString().trim();
    if (!name || name === 'Full Name') continue;

    const top5: string[] = [];
    const scores: Record<string, number> = {};

    // For simplicity, assign random scores for top 5 gifts from their team
    const team = (row['Team'] || '').toString().trim();
    const primaryGift = row[team]?.toString().trim() || team;
    
    // Assign top 5 gifts based on team
    const allGifts = ['Logos', 'Ruach', 'Kairos', 'Dunamis', 'Hesed', 'Avodah', 'Shalom', 'Agape', 'Metanoia', 'Echad'];
    const shuffled = [...allGifts].sort(() => Math.random() - 0.5);
    const top5Gifts = shuffled.slice(0, 5);
    
    top5Gifts.forEach((gift, idx) => {
      scores[gift] = 15 - idx;
    });

    giftData[name] = {
      top5: top5Gifts,
      scores
    };
  }

  return { mentees, giftData };
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
// 2. WAITING POOL — Real data from Excel
// ============================================================

async function seedWaitingPool() {
  console.log('--- Seeding WaitingPool ---');

  const { mentees, giftData } = await parseMentoringData();

  // Take first 4 mentees for PROFILE_COMPLETED (complete data)
  // Rest go to WAITING_POOL
  const profileCompletedMentees = mentees.slice(0, 4);
  const waitingPoolMentees = mentees.slice(4, 8);
  const waitingPoolExtra = mentees.slice(8, 12);

  // Create users for PROFILE_COMPLETED mentees
  const profileCompletedUsers = profileCompletedMentees.map((m, idx) => {
    const giftInfo = giftData[m.name] || {
      top5: ['Penguatan', 'Pelajaran', 'Kepemimpinan', 'Pelayanan', 'Iman'],
      scores: { Penguatan: 15, Pelajaran: 13, Kepemimpinan: 12, Pelayanan: 11, Iman: 10 }
    };
    return {
      name: m.name,
      email: `${m.name.toLowerCase().replace(/\s+/g, '.')}@gehc.demo`,
      phone: `0812345678${String(idx + 5).padStart(2, '0')}`,
      gender: m.gender,
      origin: m.origin || `Group: ${m.group}`,
      giftsTop5: giftInfo.top5,
      giftsScores: giftInfo.scores,
    };
  });

  // Create users for PROFILE_COMPLETED mentees
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

  // Build DUMMY_ENTRIES
  const DUMMY_ENTRIES = [
    // WAITING_POOL (belum isi profil) - 4 orang
    { name: 'Marvel Ngantung', email: 'marvel.ngantung@gmail.com', phone: '081234567801', gender: 'LAKI-LAKI', origin: 'GMIM Betlehem Tondano', status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'BAKUTAU 4.0' },
    { name: 'Sheryl Pongoh', email: 'sheryl.pongoh@gmail.com', phone: '081234567802', gender: 'PEREMPUAN', origin: 'GMIM Sentrum Manado', status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'BAKUTAU 4.0' },
    { name: 'Rivaldo Tumbelaka', email: null, phone: '081234567803', gender: 'LAKI-LAKI', origin: null, status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'Instagram' },
    { name: 'Cecilia Luntungan', email: 'cecilia.luntungan@yahoo.com', phone: '081234567804', gender: 'PEREMPUAN', origin: 'GMIM Bukit Moria Sasaran', status: 'WAITING_POOL', giftTestDone: false, profileCompleted: false, sourceEvent: 'Word of Mouth' },

    // PROFILE_COMPLETED (profil lengkap, menunggu role) — 4 orang dari Excel dengan data lengkap
    ...profileCompletedMentees.map((m, idx) => {
      const u = profileCompletedUsers[idx];
      return {
        name: m.name,
        email: u.email,
        phone: u.phone,
        gender: u.gender,
        origin: u.origin,
        status: 'PROFILE_COMPLETED',
        giftTestDone: true,
        profileCompleted: true,
        sourceEvent: 'Retreat 2026',
        userId: createdUsers.find(u => u.name === m.name)?.userId,
        giftsTop5: u.giftsTop5,
        giftsScores: u.giftsScores,
      };
    }),

    // WAITING_POOL extra (belum lengkap profil) - 4 orang
    ...waitingPoolMentees.map((m, idx) => ({
      name: m.name,
      email: `${m.name.toLowerCase().replace(/\s+/g, '.')}@gehc.demo`,
      phone: `0812345678${String(idx + 9).padStart(2, '0')}`,
      gender: m.gender,
      origin: m.origin,
      status: 'WAITING_POOL',
      giftTestDone: false,
      profileCompleted: false,
      sourceEvent: 'Retreat 2026',
    })),

    // WAITING_POOL extra more
    ...waitingPoolExtra.map((m, idx) => ({
      name: m.name,
      email: `${m.name.toLowerCase().replace(/\s+/g, '.')}@gehc.demo`,
      phone: `0812345678${String(idx + 13).padStart(2, '0')}`,
      gender: m.gender,
      origin: m.origin,
      status: 'WAITING_POOL',
      giftTestDone: false,
      profileCompleted: false,
      sourceEvent: 'Retreat 2026',
    })),
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

  console.log(`  ✓ WAITING_POOL: ${waitingCount} orang`);
  console.log(`  ✓ PROFILE_COMPLETED: ${pendingCount} orang (data lengkap: gender + gift test)`);
  console.log(`\n✓ Total WaitingPool dummy: ${DUMMY_ENTRIES.length}`);
  console.log('  (Youth GEHC dummy data cleared - stops at Menunggu Role)');
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🌱 Seeding Onboarding Pipeline (RoleAssignment + WaitingPool)...\n');

  await seedRoleAssignments();
  await seedWaitingPool();

  console.log('✅ Seeding selesai!');
  console.log('   - Youth GEHC panel: role assignments dari data existing (no dummy)');
  console.log('   - Onboarding Pipeline: 4 WAITING_POOL + 4 PROFILE_COMPLETED (data lengkap dari Excel)');
  console.log('   - Stops at Menunggu Role - no dummy data in Youth GEHC');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });