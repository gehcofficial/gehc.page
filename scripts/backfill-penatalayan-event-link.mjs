/**
 * Backfill tautan event penatalayan (eventId null → event ibadah tanggal sama).
 *
 * Menyambung ulang baris lama yang dibuat sebelum fix sync eventId:
 * - ServiceSchedule.eventId null (jadwal terisi via approve/fulfill lama),
 * - ServiceRoleRequest.eventId null status PENDING (usulan mentor lama).
 *
 * Aturan sama dengan auto-link server: event SERVING_DAY / MENTORING_DAY /
 * kind UMUM pada tanggal WIB yang sama, first-wins.
 *
 * AMAN: default DRY-RUN (laporan saja). Tambahkan --apply untuk menulis.
 *
 *   node scripts/backfill-penatalayan-event-link.mjs
 *   node scripts/backfill-penatalayan-event-link.mjs --apply
 *   npm run backfill:penatalayan-link:staging   # dry-run staging
 *   npm run backfill:penatalayan-link:prod      # dry-run produksi
 */
import 'dotenv/config';
import { getPrisma } from '../server/db.mjs';
import { resolveWorshipEventByDate } from '../server/lib/service-events.mjs';

const APPLY = process.argv.includes('--apply');
const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

async function main() {
  const [scheds, reqs] = await Promise.all([
    prisma.serviceSchedule.findMany({
      where: { eventId: null },
      select: { id: true, date: true, serviceRoleId: true },
      orderBy: { date: 'asc' },
    }),
    prisma.serviceRoleRequest.findMany({
      where: { eventId: null, status: 'PENDING' },
      select: { id: true, date: true, serviceRoleId: true },
      orderBy: { date: 'asc' },
    }),
  ]);
  const roleIds = [...new Set([...scheds, ...reqs].map((r) => r.serviceRoleId).filter(Boolean))];
  const roleById = new Map(
    (roleIds.length
      ? await prisma.serviceRole
          .findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } })
          .catch(() => [])
      : []
    ).map((r) => [r.id, r.name]),
  );
  console.log(`Jadwal tanpa eventId: ${scheds.length}`);
  console.log(`Request PENDING tanpa eventId: ${reqs.length}`);

  const cache = new Map();
  const resolve = async (day) => {
    if (!cache.has(day)) cache.set(day, await resolveWorshipEventByDate(prisma, day).catch(() => null));
    return cache.get(day);
  };

  const tally = { linked: 0, noEvent: 0 };
  const details = [];
  for (const [kind, rows] of [['schedule', scheds], ['request', reqs]]) {
    for (const r of rows) {
      const day = isoDay(r.date);
      const eventId = await resolve(day);
      if (!eventId) {
        tally.noEvent += 1;
        continue;
      }
      tally.linked += 1;
      if (details.length < 20) details.push(`${kind} ${day} ${roleById.get(r.serviceRoleId) || r.serviceRoleId || ''} → ${eventId}`);
      if (APPLY) {
        if (kind === 'schedule') {
          await prisma.serviceSchedule.update({ where: { id: r.id }, data: { eventId } });
        } else {
          await prisma.serviceRoleRequest.update({ where: { id: r.id }, data: { eventId } });
        }
      }
    }
  }

  console.log('Contoh:', details.length ? `\n  ${details.join('\n  ')}` : '(tidak ada)');
  console.log('Hasil:', JSON.stringify(tally));
  console.log(APPLY ? '✓ Backfill diterapkan.' : 'Dry-run: tidak ada yang diubah. Tambahkan --apply untuk menulis.');
  await prisma.$disconnect().catch(() => {});
}

main().catch(async (e) => {
  console.error('Backfill gagal:', e?.message || e);
  try { await prisma.$disconnect(); } catch { /* abaikan */ }
  process.exit(1);
});
