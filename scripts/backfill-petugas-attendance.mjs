/**
 * Backfill kehadiran otomatis petugas (CONFIRMED → terdaftar + hadir).
 *
 * Memproses penugasan ServiceSchedule berstatus CONFIRMED yang punya eventId:
 * membuat baris EventAttendee + checkedInAt yang belum ada (bertanda
 * metadata.autoPetugas). Baris manual / sudah scan tidak disentuh.
 *
 * AMAN: default DRY-RUN (laporan saja). Tambahkan --apply untuk menulis.
 *
 *   node scripts/backfill-petugas-attendance.mjs
 *   node scripts/backfill-petugas-attendance.mjs --apply
 *   npm run backfill:petugas-attendance:staging   # dry-run staging
 */
import 'dotenv/config';
import { getPrisma } from '../server/db.mjs';
import { syncPetugasAttendance } from '../server/lib/petugas-attendance.mjs';

const APPLY = process.argv.includes('--apply');

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

async function main() {
  const rows = await prisma.serviceSchedule.findMany({
    where: { status: 'CONFIRMED', eventId: { not: null } },
    select: {
      id: true, eventId: true, userId: true,
      serviceRole: { select: { name: true } },
    },
  });
  console.log(`Penugasan CONFIRMED ber-event: ${rows.length}`);

  const tally = {};
  for (const r of rows) {
    const out = APPLY
      ? await syncPetugasAttendance(prisma, {
          schedule: { id: r.id, eventId: r.eventId, userId: r.userId, roleName: r.serviceRole?.name || null, status: 'CONFIRMED' },
          from: 'SCHEDULED',
          actorId: 'system-backfill',
        }).catch((e) => ({ action: `error: ${e?.message || e}` }))
      : await (async () => {
          const existing = await prisma.eventAttendee.findUnique({
            where: { eventId_userId: { eventId: r.eventId, userId: r.userId } },
          });
          if (!existing) return { action: 'would-auto' };
          if (!existing.checkedInAt) return { action: 'would-auto-filled' };
          return { action: 'kept-manual' };
        })();
    tally[out.action] = (tally[out.action] || 0) + 1;
  }

  console.log('Hasil:', JSON.stringify(tally));
  console.log(APPLY ? '✓ Backfill diterapkan.' : 'Dry-run: tidak ada yang diubah. Tambahkan --apply untuk menulis.');
  await prisma.$disconnect().catch(() => {});
}

main().catch(async (e) => {
  console.error('Backfill gagal:', e?.message || e);
  try { await prisma.$disconnect(); } catch { /* abaikan */ }
  process.exit(1);
});
