/**
 * Isi draf Bedah Film "The Case for Christ" untuk event 17 Okt 2026
 * (origin week 2026-10/W3, slot 18 Okt digeser → event 17 Okt).
 *
 * Menulis `WorshipSession.config.draft` (setara tombol "Simpan draft").
 * TIDAK membuat Likert/Chip — "Terapkan ke sesi" tetap via UI agar guard
 * DRAFT-kosong tetap berlaku.
 *
 * AMAN: default DRY-RUN. Tambahkan --apply untuk menulis.
 * Abort bila sesi bukan DRAFT atau sudah ada jawaban/item (kecuali --force).
 *
 *   node scripts/fill-bedah-film-case-for-christ.mjs                      # dry-run lokal
 *   dotenv -e .env.staging -- node scripts/fill-bedah-film-case-for-christ.mjs --apply
 *   dotenv -e .env.production -- node scripts/fill-bedah-film-case-for-christ.mjs --apply
 *   node scripts/fill-bedah-film-case-for-christ.mjs --event-date=2026-10-17 --create --apply
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { getPrisma, getDbLabel } from '../server/db.mjs';
import { wibDateOnly } from '../server/lib/event-venue.mjs';
import { CASE_FOR_CHRIST_DRAFT } from '../server/lib/bedah-film-case-for-christ.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const CREATE = args.includes('--create');
const flagVal = (name, fallback = '') => {
  const eq = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!eq) return fallback;
  if (eq.includes('=')) return eq.slice(eq.indexOf('=') + 1) || fallback;
  const next = args[args.indexOf(eq) + 1];
  return next && !next.startsWith('--') ? next : fallback;
};
const EVENT_DATE = flagVal('event-date', '2026-10-17');

if (!/^\d{4}-\d{2}-\d{2}$/.test(EVENT_DATE)) {
  console.error('--event-date harus YYYY-MM-DD.');
  process.exit(1);
}

const prisma = getPrisma();
if (!prisma) {
  console.error('DB belum dikonfigurasi.');
  process.exit(1);
}

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);
const range = (iso) => ({ gte: new Date(day(iso).getTime() - 24 * 3600 * 1000), lt: new Date(day(iso).getTime() + 2 * 24 * 3600 * 1000) });
const wib = (v) => {
  try {
    return wibDateOnly(v);
  } catch {
    return String(v || '').slice(0, 10);
  }
};

console.log(`Target DB : ${getDbLabel()}`);
console.log(`Mode      : ${APPLY ? 'APPLY (menulis config.draft)' : 'DRY-RUN (tidak menulis)'}`);
console.log(`Event     : ${EVENT_DATE} (origin 2026-10/W3)\n`);

const r = range(EVENT_DATE);
const events = await prisma.eventProgram.findMany({
  where: { eventDate: { gte: r.gte, lt: r.lt } },
  select: { id: true, name: true, serviceType: true, eventDate: true },
  orderBy: { eventDate: 'asc' },
});
const onDate = (events || []).filter((e) => wib(e.eventDate) === EVENT_DATE);
if (!onDate.length) {
  console.error(`Tidak ada event pada ${EVENT_DATE}.`);
  await prisma.$disconnect();
  process.exit(1);
}
const event = onDate.find((e) => ['MENTORING_DAY', 'SERVING_DAY'].includes(String(e.serviceType || '').toUpperCase())) || onDate[0];
console.log(`Event: ${event.id} "${event.name}" [${event.serviceType}] jam=${new Date(event.eventDate).toISOString()}`);

const pattern = await prisma.worshipPattern.findUnique({ where: { code: 'BEDAH_FILM' } }).catch(() => null);
if (!pattern) {
  console.error('Pola BEDAH_FILM tidak ditemukan (seed worship belum jalan).');
  await prisma.$disconnect();
  process.exit(1);
}

let sessions = await prisma.worshipSession.findMany({
  where: { eventId: event.id },
  select: { id: true, slug: true, title: true, status: true, sessionDate: true, config: true, patternId: true },
  orderBy: { createdAt: 'desc' },
}).catch(() => []);
sessions = sessions || [];
console.log(`Sesi tertaut event: ${sessions.length}`);
for (const s of sessions) {
  const cur = s?.config?.draft?.film?.['film-title'] || s?.config?.draft?.['film-title'] || '';
  console.log(` - ${s.slug} [${s.status}] tgl=${s.sessionDate ? wib(s.sessionDate) : '-'} film="${String(cur).slice(0, 60)}"`);
}

let target = sessions.find((s) => s.patternId === pattern.id) || sessions[0] || null;
if (!target && !CREATE) {
  console.error('\nBelum ada sesi untuk event ini. Buat dulu via UI (Pola & Sesi → Buat sesi BEDAH_FILM), atau ulangi dengan --create --apply.');
  await prisma.$disconnect();
  process.exit(1);
}
if (!target && CREATE) {
  const slug = `sesi-${EVENT_DATE}-bedah-film`;
  const dup = await prisma.worshipSession.findUnique({ where: { slug } }).catch(() => null);
  if (dup) {
    console.error(`Slug ${slug} sudah dipakai oleh sesi lain.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`\nAkan membuat sesi baru ${slug} (pola BEDAH_FILM).`);
  if (APPLY) {
    target = await prisma.worshipSession.create({
      data: {
        id: `ws-${crypto.randomUUID().slice(0, 8)}`,
        patternId: pattern.id,
        slug,
        title: `Bedah Film — ${event.name}`,
        eventId: event.id,
        tenantId: 'tenant-youth',
        sessionDate: new Date(`${EVENT_DATE}T00:00:00Z`),
        status: 'DRAFT',
        accessCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
        config: { draft: CASE_FOR_CHRIST_DRAFT },
      },
      select: { id: true, slug: true, status: true, config: true },
    });
    console.log(`Dibuat: ${target.slug} [${target.status}] — draf Case for Christ terisi. Lanjut "Terapkan ke sesi" via UI.`);
  } else {
    console.log('DRY-RUN: sesi belum dibuat. Tambahkan --apply untuk membuat.');
  }
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`\nTarget sesi: ${target.slug} [${target.status}]`);
if (String(target.status || '').toUpperCase() !== 'DRAFT' && !FORCE) {
  console.error('Sesi bukan DRAFT — abort agar tak menimpa sesi berjalan. Pakai --force bila memang disengaja.');
  await prisma.$disconnect();
  process.exit(1);
}
const [likertCount, responseCount] = await Promise.all([
  prisma.worshipLikertItem.count({ where: { sessionId: target.id } }).catch(() => 0),
  prisma.worshipLikertResponse.count({ where: { sessionId: target.id } }).catch(() => 0),
]);
console.log(`Likert items: ${likertCount}, responses: ${responseCount}`);
if ((likertCount > 0 || responseCount > 0) && !FORCE) {
  console.error('Sesi sudah berisi soal/jawaban (sudah Diterapkan?) — abort. Pakai --force untuk menimpa draf saja (item tidak diubah).');
  await prisma.$disconnect();
  process.exit(1);
}

const prevTitle = target?.config?.draft?.film?.['film-title'] || '';
console.log(`film-title lama: "${String(prevTitle).slice(0, 80)}"`);
console.log('film-title baru: "The Case for Christ (2017, 112 menit — tayang versi 60–95 menit + jeda diskusi)"');

if (!APPLY) {
  console.log('\nDRY-RUN: tidak ada yang ditulis. Tambahkan --apply untuk mengisi config.draft.');
  await prisma.$disconnect();
  process.exit(0);
}

const nextConfig = { ...((target.config && typeof target.config === 'object') ? target.config : {}), draft: CASE_FOR_CHRIST_DRAFT };
await prisma.worshipSession.update({ where: { id: target.id }, data: { config: nextConfig } });
console.log(`\nOK: config.draft sesi ${target.slug} terisi The Case for Christ. Buka tab Draft → periksa → Simpan tidak perlu (sudah tersimpan) → "Terapkan ke sesi".`);
await prisma.$disconnect();
