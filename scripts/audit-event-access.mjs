/**
 * Audit akses daftar event per akun (kasus "Belum ada event" di HP user).
 *
 * Memeriksa rantai yang menentukan visibilitas GET /api/events:
 *   User.roles (8 peran portal) → StrukturMember (userId/email → division)
 *   → EventDivision per event.
 *
 * AMAN: default hanya LAPORAN. Tambahkan --apply untuk menautkan userId
 * pada baris struktur yang emailnya cocok unik (tanpa mengubah division).
 *
 *   node scripts/audit-event-access.mjs                      # laporan global
 *   node scripts/audit-event-access.mjs --email user@x.com    # simulasi 1 akun
 *   node scripts/audit-event-access.mjs --apply               # tautkan userId
 *   npm run audit:event-access:staging                        # laporan staging
 */
import 'dotenv/config';
import { getPrisma } from '../server/db.mjs';

const APPLY = process.argv.includes('--apply');
const ONLY_EMAIL = (() => {
  const i = process.argv.indexOf('--email');
  return i >= 0 ? String(process.argv[i + 1] || '').toLowerCase().trim() : '';
})();

const PORTAL_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'];

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

async function main() {
  const [users, structures, events] = await Promise.all([
    prisma.user.findMany({
      where: { accountStatus: 'ACTIVE' },
      select: { id: true, name: true, email: true, roles: { select: { role: true } } },
    }),
    prisma.strukturMember.findMany({
      select: { id: true, name: true, email: true, userId: true, division: true },
    }),
    prisma.eventProgram.findMany({
      orderBy: { eventDate: 'desc' },
      take: 20,
      select: { id: true, name: true, status: true, eventDate: true, divisions: { select: { division: true } } },
    }),
  ]);

  const withRole = users.filter((u) => (u.roles || []).some((r) => PORTAL_ROLES.includes(String(r.role))));
  const byUserId = new Map(structures.filter((s) => s.userId).map((s) => [s.userId, s]));
  const byEmail = new Map();
  for (const s of structures) {
    const k = String(s.email || '').toLowerCase().trim();
    if (!k) continue;
    if (!byEmail.has(k)) byEmail.set(k, []);
    byEmail.get(k).push(s);
  }

  const linkOf = (u) => byUserId.get(u.id) || (byEmail.get(String(u.email || '').toLowerCase().trim()) || [])[0] || null;
  const targets = ONLY_EMAIL ? withRole.filter((u) => String(u.email || '').toLowerCase() === ONLY_EMAIL) : withRole;

  if (ONLY_EMAIL && !targets.length) {
    console.log(`Akun ${ONLY_EMAIL} tidak ditemukan / tidak aktif / tanpa peran portal.`);
  }

  // 1) Simulasi visibilitas per akun (event non-arsip).
  console.log('== Simulasi visibilitas (20 event terbaru) ==');
  const openEvents = events.filter((e) => String(e.status || '').toUpperCase() !== 'ARCHIVED');
  let shown = 0;
  for (const u of targets.slice(0, 50)) {
    const sm = linkOf(u);
    const div = String(sm?.division || '').toUpperCase();
    const matched = openEvents.filter((e) => (e.divisions || []).some((d) => String(d.division || '').toUpperCase() === div && div));
    const noDivEvents = openEvents.filter((e) => !(e.divisions || []).length).length;
    console.log(`- ${u.name || u.email} [${(u.roles || []).map((r) => r.role).join(',')}] struktur=${sm ? `${sm.division || '(kosong)'}` : 'TIDAK-ADA'} cocok=${matched.length}/${openEvents.length} tanpa-divisi=${noDivEvents}`);
    shown += 1;
  }
  if (targets.length > shown) console.log(`... +${targets.length - shown} akun (batasi dengan --email)`);
  console.log(`Total akun peran portal: ${withRole.length}; event non-arsip: ${openEvents.length}`);

  if (ONLY_EMAIL) {
    await prisma.$disconnect();
    return;
  }

  // 2) Akun tanpa baris struktur.
  const orphanUsers = withRole.filter((u) => !linkOf(u));
  console.log(`\n== Akun tanpa baris struktur: ${orphanUsers.length} ==`);
  for (const u of orphanUsers.slice(0, 30)) {
    console.log(`- ${u.name || '(tanpa nama)'} <${u.email}> [${(u.roles || []).map((r) => r.role).join(',')}]`);
  }

  // 3) Baris struktur tanpa userId yang emailnya cocok satu akun (kandidat taut).
  const candidates = [];
  for (const s of structures) {
    if (s.userId) continue;
    const k = String(s.email || '').toLowerCase().trim();
    if (!k) continue;
    const match = withRole.filter((u) => String(u.email || '').toLowerCase().trim() === k);
    if (match.length === 1) candidates.push({ sm: s, user: match[0] });
  }
  console.log(`\n== Kandidat taut userId (email cocok unik): ${candidates.length} ==`);
  for (const c of candidates.slice(0, 30)) {
    console.log(`- struktur "${c.sm.name}" <${c.sm.email}> → user ${c.user.name || c.user.email} (${c.user.id})`);
  }

  // 4) Event tanpa divisi (tak terlihat sebelum fix, via open fallback sesudahnya).
  const noDiv = events.filter((e) => !(e.divisions || []).length);
  console.log(`\n== Event tanpa divisi (20 terbaru): ${noDiv.length} ==`);
  for (const e of noDiv) {
    console.log(`- ${e.name} [${e.status}] ${e.eventDate ? String(e.eventDate).slice(0, 10) : ''}`);
  }

  // 5) Email ganda (varian kapital) yang mengacaukan pencocokan.
  const seen = new Map();
  const dupes = new Set();
  for (const u of users) {
    const k = String(u.email || '').toLowerCase().trim();
    if (!k) continue;
    if (seen.has(k) && seen.get(k) !== u.email) dupes.add(k);
    seen.set(k, u.email);
  }
  if (dupes.size) {
    console.log(`\n== Email varian kapital: ${dupes.size} ==`);
    for (const k of [...dupes].slice(0, 20)) console.log(`- ${k}`);
  }

  if (APPLY) {
    if (!candidates.length) {
      console.log('\nTidak ada kandidat — tidak ada yang diubah.');
    } else {
      let n = 0;
      for (const c of candidates) {
        await prisma.strukturMember.update({ where: { id: c.sm.id }, data: { userId: c.user.id } });
        n += 1;
      }
      console.log(`\n✓ Tertaut ${n} baris struktur → userId (division tidak diubah).`);
    }
  } else {
    console.log('\nDry-run: tidak ada yang diubah. Tambahkan --apply untuk menautkan userId.');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Gagal audit:', e?.message || e);
  try { await prisma.$disconnect(); } catch { /* abaikan */ }
  process.exit(1);
});
