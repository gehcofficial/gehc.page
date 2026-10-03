/**
 * Backfill folder Drive + arsip untuk SEMUA event lampau (termasuk ARCHIVED/DONE).
 *
 * Per event:
 *   1. Pastikan 6 EventDivision (LITURGIA..BENZARPR) ada.
 *   2. Buat folder Drive per divisi yang belum punya (createEventFolder).
 *   3. Buat/pastikan folder arsip Marturia + isi archiveFolderId bila kosong.
 *
 * Tidak menyentuh: status event, previewFileIds (kurasi Marturia), konten.
 * Idempotent — aman diulang. Default DRY-RUN; tulis dengan --apply.
 *
 *   node server/_backfill-event-drives.cjs [--apply] [--only=<id1,id2>]
 *   npm run drive:backfill-events[:staging|:prod]
 */
require('dotenv').config();
const crypto = require('node:crypto');

const APPLY = process.argv.includes('--apply');
const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const EVENT_DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];

async function main() {
  const { getPrisma, getDbLabel } = await import('./db.mjs');
  const { createEventFolder } = await import('./gdrive-events.mjs');
  const { ensureEventArchiveFolder } = await import('./lib/drive-ensure.mjs');
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  console.log(`Backfill Drive event → ${getDbLabel()} | mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const events = await prisma.eventProgram.findMany({
    where: ONLY.length ? { id: { in: ONLY } } : {},
    select: { id: true, slug: true, name: true, status: true, eventDate: true, startDate: true, archiveFolderId: true },
    orderBy: { eventDate: 'asc' },
  });
  console.log(`Event: ${events.length}`);

  const stats = { divisions: 0, folders: 0, archives: 0, skipped: 0, failed: 0 };
  for (const ev of events) {
    try {
      const existing = await prisma.eventDivision.findMany({ where: { eventId: ev.id } });
      const have = new Set(existing.map((d) => String(d.division).toUpperCase()));
      const missing = EVENT_DIVISIONS.filter((d) => !have.has(d));
      if (APPLY) {
        for (const div of missing) {
          await prisma.eventDivision.create({
            data: { id: `evd-${crypto.randomUUID()}`, eventId: ev.id, division: div },
          });
          stats.divisions += 1;
        }
      } else if (missing.length) {
        console.log(`- ${ev.name}: kurang divisi ${missing.join(',')}`);
        stats.skipped += 1;
      }

      // Folder Drive per divisi (hanya yang belum punya).
      if (APPLY) {
        const divs = await prisma.eventDivision.findMany({ where: { eventId: ev.id } });
        for (const d of divs) {
          if (d.driveFolderId) continue;
          try {
            const fid = await createEventFolder(ev, String(d.division).toUpperCase());
            if (fid) {
              await prisma.eventDivision.update({ where: { id: d.id }, data: { driveFolderId: fid } });
              stats.folders += 1;
            }
          } catch (e) {
            console.warn(`  ! folder ${d.division} (${ev.slug}): ${e.message}`);
            stats.failed += 1;
          }
        }
      }

      // Folder arsip (agar event lama/arsip tetap muncul + tombol Drive jalan).
      if (!ev.archiveFolderId) {
        if (!APPLY) {
          console.log(`- ${ev.name}: belum punya arsip`);
          stats.skipped += 1;
        } else {
          try {
            const occurred = ev.eventDate || ev.startDate || new Date();
            const iso = new Date(occurred).toISOString().slice(0, 10);
            const { folder } = await ensureEventArchiveFolder(iso, ev.name);
            if (folder?.id) {
              await prisma.eventProgram.update({ where: { id: ev.id }, data: { archiveFolderId: folder.id } });
              stats.archives += 1;
            }
          } catch (e) {
            console.warn(`  ! arsip (${ev.slug}): ${e.message}`);
            stats.failed += 1;
          }
        }
      }
    } catch (e) {
      console.warn(`  ! event ${ev.id}: ${e.message}`);
      stats.failed += 1;
    }
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} selesai:`, JSON.stringify(stats));
  if (!APPLY) console.log('Ulangi dengan --apply untuk menulis.');
}

main().catch((e) => {
  console.error('Gagal:', e?.message || e);
  process.exit(1);
});
