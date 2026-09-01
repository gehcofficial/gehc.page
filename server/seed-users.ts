/**
 * Seed akun dummy STAGING v2 — PANTATUGAS edition.
 *
 * - Akun dummy berbasis PERAN (email = nama peran), nama personal menyusul.
 * - Hierarki: Komisi → Tim Kerja/Penopang → 5 Pantatugas → Sub-divisi.
 * - Demo multi-role/rangkap jabatan: Ketua Komisi juga MENTOR grup demo.
 * - Menyinkronkan tabel struktur_members dari INITIAL_STRUKTUR (replace-all).
 * - Idempotent: aman dijalankan berulang; akun placeholder lama dibersihkan.
 *
 * Jalankan: npm run db:seed-users:staging
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { INITIAL_STRUKTUR } from '../src/data/initialData.ts';

const prisma = new PrismaClient();
const TENANT = 'tenant-youth';
const DOMAIN = '@gehc.demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123';

type RoleName =
  | 'SUPERADMIN'
  | 'BPMJ'
  | 'KOMISI'
  | 'COMMITTEE'
  | 'MENTOR'
  | 'CO_MENTOR'
  | 'MENTEE'
  | 'ALUMNI';

function avatarFor(seed: string): string {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1b1b1b`;
}

/** Hash scrypt "salt:hash" — format identik dengan server/auth.mjs */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Buat/perbarui akun placeholder per-peran + pastikan punya password demo. Mengembalikan userId. */
async function upsertRoleAccount(localId: string, displayName: string, emailLocalPart: string) {
  const email = `${emailLocalPart}${DOMAIN}`;
  let user = await prisma.user.upsert({
    where: { email },
    create: { id: localId, email, name: displayName, avatar: avatarFor(displayName) },
    update: { name: displayName },
  });
  if (!user.passwordHash) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(DEMO_PASSWORD) },
    });
  }
  return user;
}

/** Hapus relasi FK sebelum user placeholder di-delete (org/role assignments, dll.). */
async function purgePlaceholderUser(userId: string) {
  await prisma.orgAssignment.deleteMany({
    where: { OR: [{ userId }, { assignedBy: userId }] },
  });
  await prisma.roleAssignment.deleteMany({
    where: { OR: [{ userId }, { assignedBy: userId }] },
  });
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.waitingPool.deleteMany({ where: { userId } });
  await prisma.monitoringRecord.deleteMany({ where: { mentorId: userId } });
  await prisma.mentorTransition.deleteMany({
    where: {
      OR: [{ outgoingUserId: userId }, { incomingUserId: userId }, { createdById: userId }],
    },
  });
  await prisma.attendanceRecord.updateMany({
    where: { recordedById: userId },
    data: { recordedById: null },
  });
  await prisma.user.delete({ where: { id: userId } });
}

/** Tambah role ke akun (multi-role: tidak menghapus role lain). */
async function addRole(userId: string, role: RoleName, groupId?: string | null) {
  const existing = await prisma.userRole.findFirst({
    where: { userId, tenantId: TENANT, role },
  });
  if (existing) {
    if (groupId !== undefined) {
      await prisma.userRole.update({ where: { id: existing.id }, data: { groupId: groupId ?? null } });
    }
    return;
  }
  await prisma.userRole.create({ data: { userId, tenantId: TENANT, role, groupId: groupId ?? null } });
}

async function main() {
  console.log('Menyemai akun dummy staging (pantatugas edition)…');

  // ---------- 0. Bersihkan akun placeholder lama (@gehc.demo tanpa relasi grup) ----------
  const placeholders = await prisma.user.findMany({
    where: { email: { endsWith: DOMAIN } },
    include: { _count: { select: { groupMembers: true } } },
  });
  let purged = 0;
  for (const u of placeholders) {
    if (u._count.groupMembers > 0) continue; // mentor/mentee nyata — jangan sentuh
    await purgePlaceholderUser(u.id);
    purged++;
  }
  console.log(`✓ pembersihan: ${purged} akun placeholder lama dihapus`);

  // ---------- 1. SUPERADMIN ----------
  await addRole((await upsertRoleAccount('usr-tech', 'Tim Tech GEHC', 'tech')).id, 'SUPERADMIN');

  // ---------- 2. BPMJ — Badan Pekerja Majelis Jemaat (nama asli, payung tertinggi) ----------
  const bpmjAccounts: Array<[string, string, string]> = [
    ['usr-meyke-poluan', 'Pdt Meyke Poluan Sth Mpdk', 'meyke.poluan'],
    ['usr-veky-lengkong', 'Pnt Veky Lengkong', 'veky.lengkong'],
    ['usr-noldy-wanget', 'Pnt Noldy Wanget', 'noldy.wanget'],
    ['usr-nofri-raco', 'Pnt Nofri Raco', 'nofri.raco'],
    ['usr-selfi-lumbu', 'Dkn Selfi Lumbu', 'selfi.lumbu'],
    ['usr-bonny-rondonuwu', 'Dkn Bonny Rondonuwu', 'bonny.rondonuwu'],
  ];
  for (const [id, name, slug] of bpmjAccounts) {
    const u = await upsertRoleAccount(id, name, slug);
    await addRole(u.id, 'BPMJ');
  }
  console.log(`✓ BPMJ: ${bpmjAccounts.length} akun (Ketua: Pdt Meyke Poluan)`);

  // ---------- 3. Komisi Pemuda — dipimpin Penatua Pemuda (periode 5 tahun) ----------
  const komisiAccounts: Array<[string, string, string]> = [
    ['usr-stevania-hadinda', 'Pnt Stevania Hadinda', 'stevania.hadinda'],   // Chairperson
    ['usr-kevin-moniaga', 'Kevin Moniaga', 'kevin.moniaga'],                 // Wakil Ketua
    ['usr-glenity-siauw', 'Glenity Siauw', 'glenity.siauw'],                 // Sekretaris (rangkap mentee Metanoia)
    ['usr-rendy-lumintang', 'Rendy Lumintang', 'rendy.lumintang'],           // Bendahara
  ];
  for (const [id, name, slug] of komisiAccounts) {
    const u = await upsertRoleAccount(id, name, slug);
    await addRole(u.id, 'KOMISI');
  }

  // Demo rangkap jabatan: Ketua Komisi juga MENTOR grup pertama (role saja).
  const ketuaKomisi = await prisma.user.findUnique({ where: { email: `stevania.hadinda${DOMAIN}` } });
  if (!ketuaKomisi) throw new Error('Akun Ketua Komisi (Stevania) gagal dibuat.');
  const firstGroup = await prisma.group.findFirst({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  if (firstGroup) {
    await addRole(ketuaKomisi.id, 'MENTOR', firstGroup.id);
    console.log(`✓ multi-role demo: ${ketuaKomisi.email} = KOMISI + MENTOR (${firstGroup.name})`);
  }
  console.log(`✓ Komisi: ${komisiAccounts.length} akun (Ketua: Pnt Stevania Hadinda)`);

  // ---------- 4. BOD Tim Kerja + PIC divisi retreat (COMMITTEE) ----------
  // Tim Kerja membawahi 5 Panca Tugas + Benzarpreneurship di bawah Komisi.
  const committeeAccounts: Array<[string, string, string]> = [
    ['usr-theodore-kowaas', 'Theodore Beckham Milano Kowaas', 'theodore.kowaas'],  // Ketua Tim Kerja
    ['usr-zhanon-lausan', 'Zhanon Varelie Lausan', 'zhanon.lausan'],               // Sekretaris Tim Kerja
    ['usr-milithya-wuisan', 'Milithya Christy Kerin Wuisan', 'milithya.wuisan'],   // Bendahara Tim Kerja
    // PIC divisi retreat:
    ['usr-krisetia-mamoto', 'Krisetia Mamoto', 'krisetia.mamoto'],            // Acara / Penopang
    ['usr-fladyna-mondoringin', 'Fladyna Mondoringin', 'fladyna.mondoringin'], // Usaha Dana
    ['usr-holly-kalele', 'Holly Kalele', 'holly.kalele'],                     // Ibadah / Liturgia
    ['usr-prichel-kampong', 'Prichel Kampong', 'prichel.kampong'],            // Logistik / Diakonia
    ['usr-gievara-bogar', 'Gievara Bogar', 'gievara.bogar'],                  // MTDD / Marturia
    ['usr-artjuna-timbuleng', 'Artjuna Timbuleng', 'artjuna.timbuleng'],      // Konsumsi / Diakonia
    // Main Speaker / Pembekal DIDASKALIA (rangkap mentee):
    ['usr-putri-massie', 'Putri Massie', 'putri.massie'],                     // Main Speaker + mentee Ruach
    ['usr-alvandi-saerang', 'Alvandi Saerang', 'alvandi.saerang'],            // Main Speaker + mentee Logos
  ];
  for (const [id, name, slug] of committeeAccounts) {
    const u = await upsertRoleAccount(id, name, slug);
    await addRole(u.id, 'COMMITTEE');
  }
  console.log(`✓ COMMITTEE: ${committeeAccounts.length} akun (Tim Kerja BOD: Theodore/Zhanon/Milithya + 6 PIC)`);

  // Demote: KOMISI lama milik Tim Kerja BOD dicabut (kini COMMITTEE).
  // Glenity tetap KOMISI (Sekretaris) — multi-role dengan MENTEE Metanoia.
  const demoted = await prisma.userRole.deleteMany({
    where: {
      role: 'KOMISI',
      user: { email: { in: [`theodore.kowaas${DOMAIN}`, `zhanon.lausan${DOMAIN}`, `milithya.wuisan${DOMAIN}`] } },
    },
  });
  if (demoted.count) console.log(`✓ demote: ${demoted.count} role KOMISI lama dicabut dari BOD Tim Kerja`);

  // ---------- 5. Mentor/Co-Mentor/Mentee/Alumni dari data grup ----------
  const batches = await prisma.groupBatch.findMany();
  let mentors = 0;
  for (const b of batches) {
    for (const [name, role] of [
      [b.mentorName, 'MENTOR'],
      [b.comentorName, 'CO_MENTOR'],
    ] as Array<[string | null, RoleName]>) {
      if (!name) continue;
      const slug = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 2).join('.');
      const u = await prisma.user.upsert({
        where: { email: `${slug}${DOMAIN}` },
        create: { id: `usr-${slug.replace(/\./g, '-')}`, email: `${slug}${DOMAIN}`, name, avatar: avatarFor(name) },
        update: {},
      });
      await addRole(u.id, role, b.groupId);
      const gm = await prisma.groupMember.findFirst({ where: { groupId: b.groupId, name, familyRole: role === 'MENTOR' ? 'MENTOR' : 'COMENTOR' } });
      if (gm && !gm.userId) await prisma.groupMember.update({ where: { id: gm.id }, data: { userId: u.id } });
      role === 'MENTOR' ? mentors++ : null;
    }
  }

  const activeMembers = await prisma.groupMember.findMany({ where: { status: 'ACTIVE', familyRole: 'MENTEE' }, include: { group: true } });
  let mentees = 0;
  for (const m of activeMembers) {
    const slug = m.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 2).join('.') || `anggota-${m.id.slice(-6)}`;
    const u = await prisma.user.upsert({
      where: { email: `${slug}${DOMAIN}` },
      create: { id: `usr-${slug.replace(/\./g, '-')}`, email: `${slug}${DOMAIN}`, name: m.name, avatar: avatarFor(m.name) },
      update: {},
    });
    await addRole(u.id, 'MENTEE', m.groupId);
    if (!m.userId) await prisma.groupMember.update({ where: { id: m.id }, data: { userId: u.id } });
    mentees++;
  }

  // ---------- 6. Sinkronkan tabel struktur_members dari INITIAL_STRUKTUR ----------
  const incomingIds = INITIAL_STRUKTUR.map((s) => s.id);
  for (const [i, s] of INITIAL_STRUKTUR.entries()) {
    const data = {
      name: s.name,
      position: s.position || null,
      division: s.division || null,
      subdivision: s.subdivision || null,
      period: s.period || null,
      photoUrl: s.photoUrl || null,
      bio: s.bio || null,
      phone: s.phone || null,
      email: s.email || null,
      sortOrder: s.order ?? i,
      isOpenRole: Boolean(s.isOpenRole),
    };
    await prisma.strukturMember.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data });
  }
  const removedStruktur = await prisma.strukturMember.deleteMany({
    where: { id: { notIn: incomingIds } },
  });

  // ---------- 7. Sinkronkan konten ACTIVITY (cth. BAKU TAU 4.0) ----------
  const { INITIAL_CONTENT } = await import('../src/data/initialData.ts');
  for (const c of INITIAL_CONTENT.filter((x) => x.type === 'ACTIVITY')) {
    const data = {
      tenantId: c.tenant_id,
      type: 'ACTIVITY' as const,
      title: c.title,
      subtitle: c.subtitle ?? null,
      body: c.body ?? null,
      category: c.category ?? null,
      publishedAt: c.published_at ? new Date(c.published_at) : null,
      eventDate: (c as any).event_date ? new Date((c as any).event_date) : null,
      locationDetail: (c as any).location_detail ?? null,
      isFeaturedEvent: Boolean((c as any).is_featured_event),
      isPublished: c.is_published,
      author: c.author ?? null,
      bannerUrl: c.bannerUrl ?? null,
      tags: c.tags ?? undefined,
    };
    await prisma.contentItem.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
  }
  console.log(`✓ konten ACTIVITY tersinkron: ${INITIAL_CONTENT.filter((x) => x.type === 'ACTIVITY').length} entri`);

  // ---------- 8. Demo birthDate untuk HUT/BIPRA testing ----------
  const birthDateSamples: Array<[string, string, string]> = [
    ['stevania.hadinda', '1995-03-15', 'PEMUDA'],
    ['kevin.moniaga', '1998-07-22', 'PEMUDA'],
    ['theodore.kowaas', '1994-11-08', 'PEMUDA'],
    ['meyke.poluan', '1975-05-12', 'BAPAK'],
    ['glenity.siauw', '2001-09-03', 'PEMUDA'],
    ['putri.massie', '2003-04-18', 'REMAJA'],
  ];
  let birthDatesSet = 0;
  for (const [slug, birthDate, bipra] of birthDateSamples) {
    const updated = await prisma.user.updateMany({
      where: { email: `${slug}${DOMAIN}` },
      data: { birthDate: new Date(birthDate), bipra },
    });
    birthDatesSet += updated.count;
  }
  console.log(`✓ birthDate demo: ${birthDatesSet} akun @gehc.demo`);

  const totalUsers = await prisma.user.count();
  const totalRoles = await prisma.userRole.count();
  const totalStruktur = await prisma.strukturMember.count();
  console.log(`✓ users: ${totalUsers} | user_roles: ${totalRoles} (multi-role aktif)`);
  console.log(`✓ struktur_members tersinkron: ${INITIAL_STRUKTUR.length} entri (hapus ${removedStruktur.count} lama) → total ${totalStruktur}`);
  console.log(`✓ mentor batch diproses: ${mentors}, mentee ter-link: ${mentees}`);
  console.log(`ℹ️  Login Google tetap pakai email asli; SUPERADMIN_EMAILS otomatis mendapat role SUPERADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
