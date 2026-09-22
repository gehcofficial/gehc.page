/**
 * Backfill workspace divisi untuk event ibadah yang sudah ada.
 * (Event baru sudah otomatis lewat POST /api/events.)
 *
 * AMAN: default DRY-RUN. Tambahkan --apply untuk menulis.
 *   node scripts/ensure-weekly-divisions.mjs            # dry-run (staging)
 *   node scripts/ensure-weekly-divisions.mjs --apply    # apply (staging)
 *   $env:GEHC_ENV='production'; node scripts/ensure-weekly-divisions.mjs   # dry-run prod
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';
import { ensureEventDivisions, isWeeklyWorshipEvent, EVENT_DIVISIONS } from '../server/lib/event-divisions.mjs';

const APPLY = process.argv.includes('--apply');
const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}`);

const events = await prisma.eventProgram.findMany({
  select: { id: true, name: true, kind: true, serviceType: true, eventDate: true, status: true },
});
const targets = events.filter(isWeeklyWorshipEvent);

const plan = [];
for (const ev of targets) {
  const existing = await prisma.eventDivision.findMany({ where: { eventId: ev.id }, select: { division: true } }).catch(() => []);
  const have = new Set(existing.map((e) => String(e.division || '').toUpperCase()));
  const missing = EVENT_DIVISIONS.filter((d) => !have.has(d));
  if (missing.length) plan.push({ ev, missing });
}

console.log(`\nEvent ibadah: ${targets.length} · perlu dilengkapi: ${plan.length}`);
for (const p of plan) {
  console.log(`  + ${p.ev.name} (${String(p.ev.eventDate || '').slice(0, 10)}) → ${p.missing.join(', ')}`);
}

if (!APPLY) {
  console.log('\n(dry-run) Tambahkan --apply untuk menulis.');
  await prisma.$disconnect();
  process.exit(0);
}

let created = 0;
for (const p of plan) {
  const res = await ensureEventDivisions(prisma, p.ev.id, p.missing);
  created += res.created;
}
console.log(`\nSelesai. EventDivision dibuat: ${created}`);
await prisma.$disconnect();
