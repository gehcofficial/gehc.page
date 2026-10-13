/**
 * Perbaikan data hantu Family Tree (insiden Nicole, Okt 2026).
 *
 * DEFAULT = DRY-RUN (laporan saja). Tambahkan --apply untuk menulis.
 *   npm run fix:family-tree:prod          # dry-run prod
 *   npm run fix:family-tree:prod:apply    # tulis prod
 *
 * Aksi (hanya yang terdeteksi audit):
 *   1. Orphan ACTIVE@periode-berjalan (Nicole/Echad, Gievara/Metanoia):
 *      bila ada tepat 1 User cocok nama → tautkan userId; bila tidak → HAPUS
 *      baris orphan AKTIF saja (riwayat PAST@2026-06 tidak disentuh).
 *   2. Mismatch User.ALUMNI + roster ACTIVE (Christofel/Kairos):
 *      roster → ALUMNI + alumniDate (selaras dengan status keanggotaan).
 *   3. Drift memberCount (Agape/Hesed/Logos): recount = hitungan ACTIVE.
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';

const APPLY = process.argv.includes('--apply');
const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

async function main() {
  console.log(`Target DB: ${getDbLabel()} — mode: ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (laporan saja)'}`);

  // 1) Orphan ACTIVE pada periode berjalan
  const currents = await prisma.groupBatch.findMany({ where: { isCurrent: true }, select: { groupId: true, period: true } });
  const periodOf = new Map(currents.map((b) => [b.groupId, b.period]));
  const orphans = await prisma.groupMember.findMany({
    where: { userId: null, status: 'ACTIVE' },
    select: { id: true, groupId: true, batchPeriod: true, name: true, familyRole: true, group: { select: { name: true } } },
  });
  const relevant = orphans.filter((m) => m.batchPeriod && m.batchPeriod === periodOf.get(m.groupId));
  console.log(`\n== Orphan ACTIVE@periode-berjalan: ${relevant.length} ==`);
  for (const m of relevant) {
    const candidates = await prisma.user.findMany({
      where: { name: { contains: m.name } },
      select: { id: true, name: true, memberStatus: true },
    });
    const exact = candidates.filter((u) => u.name.toLowerCase().trim() === m.name.toLowerCase().trim());
    if (exact.length === 1) {
      console.log(`- "${m.name}" @${m.group.name}: TAUTKAN userId=${exact[0].id} (${exact[0].name}, ${exact[0].memberStatus})`);
      if (APPLY) await prisma.groupMember.update({ where: { id: m.id }, data: { userId: exact[0].id } });
    } else {
      console.log(`- "${m.name}" @${m.group.name}: HAPUS baris orphan (kandidat User cocok: ${candidates.length})`);
      if (APPLY) {
        await prisma.attendanceRecord.deleteMany({ where: { groupMemberId: m.id } }).catch(() => null);
        await prisma.groupMember.delete({ where: { id: m.id } });
      }
    }
  }

  // 2) Mismatch User non-ACTIVE + roster ACTIVE
  const actives = await prisma.groupMember.findMany({
    where: { status: 'ACTIVE', userId: { not: null } },
    select: { id: true, name: true, groupId: true, batchPeriod: true, user: { select: { memberStatus: true } }, group: { select: { name: true } } },
  });
  const bad = actives.filter((m) => m.user && String(m.user.memberStatus).toUpperCase() === 'ALUMNI');
  console.log(`\n== Roster ACTIVE padahal User ALUMNI: ${bad.length} ==`);
  for (const m of bad) {
    console.log(`- "${m.name}" @${m.group.name}: roster → ALUMNI`);
    if (APPLY) {
      await prisma.groupMember.update({
        where: { id: m.id },
        data: { status: 'ALUMNI', alumniDate: new Date() },
      });
    }
  }

  // 3) Drift memberCount
  const groups = await prisma.group.findMany({ select: { id: true, name: true, memberCount: true } });
  console.log('\n== Drift memberCount ==');
  for (const g of groups) {
    const n = await prisma.groupMember.count({ where: { groupId: g.id, status: 'ACTIVE' } });
    if (n !== g.memberCount) {
      console.log(`- ${g.name}: ${g.memberCount} → ${n}`);
      if (APPLY) await prisma.group.update({ where: { id: g.id }, data: { memberCount: n } });
    }
  }

  if (!APPLY) console.log('\nDry-run: tidak ada yang diubah. Tambahkan --apply untuk menulis.');
  else console.log('\n✓ Selesai. Jalankan audit: npm run audit:family-tree:prod');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Gagal:', e?.message || e);
  try { await prisma.$disconnect(); } catch { /* abaikan */ }
  process.exit(1);
});
