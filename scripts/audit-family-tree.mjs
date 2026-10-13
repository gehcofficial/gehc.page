/**
 * Audit Family Tree vs roster grup (kasus "Nicole masih tampil padahal sudah tidak ada").
 *
 * READ-ONLY: hanya SELECT, tidak ada --apply, tidak ada mutasi apa pun.
 * Memeriksa untuk tiap rumah:
 *   1. Batch berjalan (isCurrent) + anggota batchPeriod berjalan per status
 *      → non-ACTIVE di batch berjalan = kandidat HANTU pohon (tree harus ACTIVE saja).
 *   2. Baris orphan (userId null) dan batchPeriod null.
 *   3. Mismatch User.memberStatus vs GroupMember.status
 *      (mis. User NONAKTIF tapi roster ACTIVE → ghost; User ACTIVE tapi roster ALUMNI → hilang).
 *   4. Nama sama di >1 grup tanpa penanda MOVED (kasus Veylicia terulang).
 *   5. memberCount vs hitungan ACTIVE.
 *   6. Pencarian khusus: Nicole (dan argumen --name lain).
 *
 *   node scripts/audit-family-tree.mjs [--name nicole]
 *   npm run audit:family-tree:staging   # via .env.staging
 *   npm run audit:family-tree:prod      # via .env.production (read-only)
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';

const NAME_Q = (() => {
  const i = process.argv.indexOf('--name');
  return i >= 0 ? String(process.argv[i + 1] || '').toLowerCase().trim() : 'nicole';
})();

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

const norm = (s) => String(s || '').toLowerCase().trim();

async function main() {
  console.log(`Target DB: ${getDbLabel()}`);
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: {
      batches: { orderBy: { period: 'desc' } },
      members: {
        orderBy: [{ batchPeriod: 'desc' }, { name: 'asc' }],
        include: { user: { select: { id: true, name: true, memberStatus: true } } },
      },
    },
  });

  let ghostTotal = 0;
  let orphanTotal = 0;
  let nullPeriodTotal = 0;
  let mismatchTotal = 0;
  const activeNameIndex = new Map(); // norm name -> [{group, status, period}]

  console.log(`\n== ${groups.length} grup ==`);
  for (const g of groups) {
    const current = (g.batches || []).find((b) => b.isCurrent) || (g.batches || [])[0] || null;
    const period = current?.period || null;
    const inCurrent = (g.members || []).filter((m) => period && m.batchPeriod === period);
    const byStatus = {};
    for (const m of inCurrent) {
      const st = String(m.status || 'ACTIVE').toUpperCase();
      byStatus[st] = (byStatus[st] || 0) + 1;
    }
    const ghosts = inCurrent.filter((m) => ['ALUMNI', 'PAST'].includes(String(m.status || '').toUpperCase()));
    const movedMarks = inCurrent.filter((m) => String(m.status || '').toUpperCase() === 'MOVED');
    const orphans = (g.members || []).filter((m) => !m.userId);
    const nullPeriod = (g.members || []).filter((m) => !m.batchPeriod);
    const mismatches = (g.members || []).filter((m) => {
      const u = m.user;
      if (!u) return false;
      const ms = String(u.memberStatus || 'ACTIVE').toUpperCase();
      const rs = String(m.status || 'ACTIVE').toUpperCase();
      // User tak aktif tapi roster ACTIVE (ghost) ATAU user aktif tapi roster ALUMNI (hilang)
      return (ms !== 'ACTIVE' && rs === 'ACTIVE') || (ms === 'ACTIVE' && rs === 'ALUMNI');
    });
    const activeCount = (g.members || []).filter((m) => String(m.status).toUpperCase() === 'ACTIVE').length;

    ghostTotal += ghosts.length;
    orphanTotal += orphans.length;
    nullPeriodTotal += nullPeriod.length;
    mismatchTotal += mismatches.length;

    for (const m of g.members || []) {
      const k = norm(m.name);
      if (!k) continue;
      if (!activeNameIndex.has(k)) activeNameIndex.set(k, []);
      activeNameIndex.get(k).push({ group: g.name, status: m.status, period: m.batchPeriod });
    }

    const flags = [];
    if (ghosts.length) flags.push(`HANTU:${ghosts.length}`);
    if (movedMarks.length) flags.push(`PINDAH:${movedMarks.length}`);
    if (mismatches.length) flags.push(`MISMATCH:${mismatches.length}`);
    if (orphans.length) flags.push(`ORPHAN:${orphans.length}`);
    if (g.memberCount !== activeCount) flags.push(`COUNT:${g.memberCount}vs${activeCount}`);
    console.log(
      `- ${g.name} [${g.id}] batch=${period || '-'}${current?.isCurrent ? ' (current)' : ''} ` +
        `anggota@${period || '?'}=${JSON.stringify(byStatus)}${flags.length ? ' ⚠ ' + flags.join(' ') : ''}`,
    );
    for (const m of ghosts.slice(0, 15)) {
      console.log(`    · HANTU "${m.name}" status=${m.status} period=${m.batchPeriod} user=${m.user?.name || '-'}(${m.user?.memberStatus || '?'})`);
    }
    if (ghosts.length > 15) console.log(`    … +${ghosts.length - 15} hantu lain`);
    for (const m of movedMarks.slice(0, 10)) {
      console.log(`    · PINDAH "${m.name}" status=MOVED period=${m.batchPeriod} → ${m.movedToGroupId || '?'} (by-design: hanya riwayat, bukan pohon)`);
    }
    for (const m of mismatches.slice(0, 10)) {
      console.log(`    · MISMATCH "${m.name}" roster=${m.status} vs user.memberStatus=${m.user?.memberStatus}`);
    }
    for (const m of orphans.slice(0, 15)) {
      console.log(`    · ORPHAN "${m.name}" status=${m.status} period=${m.batchPeriod || '-'} (tanpa userId — tak terlihat di tab Anggota, TAPI tampil di pohon)`);
    }
    if (orphans.length > 15) console.log(`    … +${orphans.length - 15} orphan lain`);
  }

  // Nama ganda lintas grup tanpa MOVED
  console.log('\n== Nama ACTIVE di >1 grup (tanpa MOVED) ==');
  let dupes = 0;
  for (const [name, rows] of activeNameIndex) {
    const actives = rows.filter((r) => String(r.status).toUpperCase() === 'ACTIVE');
    const groupsHit = [...new Set(actives.map((r) => r.group))];
    if (groupsHit.length > 1) {
      dupes += 1;
      console.log(`- "${name}" → ${actives.map((r) => `${r.group}@${r.period || '?'}`).join(', ')}`);
    }
  }
  if (!dupes) console.log('(tidak ada)');

  // Pencarian nama khusus
  if (NAME_Q) {
    console.log(`\n== Pencarian "${NAME_Q}" di seluruh group_members ==`);
    let found = 0;
    for (const g of groups) {
      for (const m of g.members || []) {
        if (!norm(m.name).includes(NAME_Q)) continue;
        found += 1;
        console.log(
          `- "${m.name}" grup=${g.name} status=${m.status} period=${m.batchPeriod || '-'} ` +
            `userId=${m.userId || 'NULL'} user.memberStatus=${m.user?.memberStatus || '-'} movedTo=${m.movedToGroupId || '-'}`,
        );
      }
    }
    if (!found) console.log('(tidak ditemukan di group_members mana pun — ghost berasal dari cache/fallback bila masih tampil di UI)');
  }

  console.log(
    `\nRINGKASAN: hantu(non-ACTIVE@batch-berjalan)=${ghostTotal} mismatch=${mismatchTotal} ` +
      `orphan(userId-null)=${orphanTotal} batchPeriod-null=${nullPeriodTotal} nama-ganda=${dupes}`,
  );
  console.log('Read-only: tidak ada yang diubah.');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Gagal audit:', e?.message || e);
  try { await prisma.$disconnect(); } catch { /* abaikan */ }
  process.exit(1);
});
