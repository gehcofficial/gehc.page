/**
 * Audit status geser W3 18 Okt -> 17 Okt 2026.
 *
 * READ-ONLY: hanya SELECT / findMany / count, tidak ada mutasi apa pun.
 * Memeriksa:
 *   1. service_week_overrides untuk 2026-10-17/18 (apakah GESER tercatat?)
 *   2. servingAssignment + eventProgram pada 17 & 18 (sudah pindah atau belum?)
 *   3. Penghuni tanggal 17 (penyebab 409 bila ada)
 *   4. servingWeekChannel 17/18 (grup WA ikut?)
 *   5. worshipSession tertaut event W3
 *   6. contentItem tertaut event W3 (judul masih 18?)
 *
 *   dotenv -e .env.production -- node scripts/audit-geser-w3.mjs
 *   dotenv -e .env.staging -- node scripts/audit-geser-w3.mjs
 */
import 'dotenv/config';
import { getPrisma, getDbLabel } from '../server/db.mjs';
import { wibDateOnly } from '../server/lib/event-venue.mjs';

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);
const range = (iso) => ({ gte: new Date(day(iso).getTime() - 24 * 3600 * 1000), lt: new Date(day(iso).getTime() + 2 * 24 * 3600 * 1000) });
const wib = (v) => { try { return wibDateOnly(v); } catch { return String(v || '').slice(0, 10); } };

async function main() {
  console.log(`Target DB: ${getDbLabel()}`);
  for (const iso of ['2026-10-17', '2026-10-18']) {
    console.log(`\n===== ${iso} =====`);
    const r = range(iso);
    const [assign, events, channels] = await Promise.all([
      prisma.servingAssignment.findMany({
        where: { eventDate: { gte: r.gte, lt: r.lt } },
        include: { responsibleGroup: { select: { name: true } }, hostGroup: { select: { name: true } } },
      }).catch((e) => [{ _err: e.message }]),
      prisma.eventProgram.findMany({
        where: { eventDate: { gte: r.gte, lt: r.lt } },
        select: { id: true, name: true, serviceType: true, eventDate: true, startDate: true, status: true },
      }).catch((e) => [{ _err: e.message }]),
      prisma.servingWeekChannel.findMany({ where: { eventDate: { gte: r.gte, lt: r.lt } } }).catch((e) => [{ _err: e.message }]),
    ]);
    const a = (assign || []).filter((x) => !x._err && wib(x.eventDate) === iso);
    const e = (events || []).filter((x) => !x._err && wib(x.eventDate) === iso);
    const c = (channels || []).filter((x) => !x._err && wib(x.eventDate ?? x.event_date) === iso);
    console.log(`-- servingAssignment (${a.length}):`);
    for (const x of a) console.log(`   ${x.id} idx=${x.cycleIndex} ${x.responsibleGroup?.name || '?'}→${x.hostGroup?.name || '?'} eventId=${x.eventId || '-'}`);
    console.log(`-- eventProgram (${e.length}):`);
    for (const x of e) console.log(`   ${x.id} [${x.serviceType}] [${x.status}] "${x.name}" jam=${x.eventDate ? new Date(x.eventDate).toISOString() : '-'}`);
    console.log(`-- servingWeekChannel (${c.length}):`);
    for (const x of c) console.log(`   ${x.id} status=${x.status} eventId=${x.eventId ?? x.event_id ?? '-'}`);
    if ((assign || []).some((x) => x._err)) console.log(`   ERR assignment: ${assign.find((x) => x._err)._err}`);
    if ((events || []).some((x) => x._err)) console.log(`   ERR events: ${events.find((x) => x._err)._err}`);
  }

  console.log('\n===== overrides 17/18 =====');
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT event_date AS eventDate, `condition`, note, new_event_date AS newEventDate FROM service_week_overrides WHERE event_date IN (?, ?)',
      '2026-10-17', '2026-10-18',
    );
    if (!rows?.length) console.log('   (tidak ada override)');
    for (const x of rows || []) console.log(`   ${wib(x.eventDate)} ${x.condition} -> ${x.newEventDate ? wib(x.newEventDate) : '-'} note=${x.note || '-'}`);
  } catch (e) { console.log(`   ERR: ${e.message}`); }

  // Event W3 = event SERVING_DAY yang namanya mengandung tema W3 di sekitar 17/18.
  console.log('\n===== sesi + konten tertaut event SERVING sekitar 17/18 =====');
  try {
    const r17 = range('2026-10-17'); const r18 = range('2026-10-18');
    const evs = await prisma.eventProgram.findMany({
      where: { OR: [{ eventDate: { gte: r17.gte, lt: r17.lt } }, { eventDate: { gte: r18.gte, lt: r18.lt } }] },
      select: { id: true, name: true, serviceType: true, eventDate: true },
    });
    const serving = (evs || []).filter((x) => ['SERVING_DAY', 'MENTORING_DAY'].includes(String(x.serviceType || '').toUpperCase()));
    for (const ev of serving) {
      console.log(`-- ${ev.id} "${ev.name}" (${wib(ev.eventDate)})`);
      const [sess, cont] = await Promise.all([
        prisma.worshipSession.findMany({ where: { eventId: ev.id }, select: { id: true, slug: true, title: true, sessionDate: true, status: true } }).catch(() => []),
        prisma.contentItem.findMany({ where: { eventId: ev.id }, select: { id: true, title: true, eventDate: true } }).catch(() => []),
      ]);
      for (const s of sess || []) console.log(`   sesi ${s.slug} [${s.status}] tgl=${s.sessionDate ? wib(s.sessionDate) : '-'}`);
      for (const t of cont || []) console.log(`   konten "${t.title}" tgl=${t.eventDate ? wib(t.eventDate) : '-'}`);
      if (!(sess || []).length && !(cont || []).length) console.log('   (tanpa sesi/konten)');
    }
    if (!serving.length) console.log('   (tidak ada event SERVING/MENTORING pada 17/18)');
  } catch (e) { console.log(`   ERR: ${e.message}`); }

  await prisma.$disconnect().catch(() => {});
}

await main();
