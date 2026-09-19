/**
 * Materialisasi jadwal serving (baris nyata `serving_assignments`) dari siklus.
 *
 * Dipakai saat event ibadah sudah ada tapi baris penanggung/tuan rumah belum
 * dibuat (mis. event dibuat manual, atau generate dilewati karena tanggal sudah ada).
 * Idempoten: hanya membuat baris yang belum ada; urutan siklus mengikuti
 * `serving_cycle_pairs` (anchor 2026-09-06 → minggu layanan pertama = idx 0).
 */
import { sundaysInMonth } from './church-year.mjs';
import { loadCyclePairs, pairFromList } from './serving-cycle.mjs';

export const BACKFILL_ANCHOR = '2026-09-06';
const SKIP_CONDITIONS = ['GABUNGAN', 'LIBUR', 'ALIH'];

const dayISO = (value) => {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

/**
 * Susun rencana backfill (tanpa menulis apa pun).
 * @returns {{ rows: Array<{date,cycleIndex,eventId,responsibleGroupId,hostGroupId,responsibleName,hostName}>, serviceDays: string[], existing: string[] }}
 */
export async function planServingBackfill(prisma, { from = BACKFILL_ANCHOR, to = null } = {}) {
  const fromDay = dayISO(from) || BACKFILL_ANCHOR;
  const toDay = dayISO(to);
  const events = await prisma.eventProgram
    .findMany({
      where: {
        serviceType: 'SERVING_DAY',
        eventDate: { gte: new Date(`${fromDay}T00:00:00.000Z`), ...(toDay ? { lte: new Date(`${toDay}T00:00:00.000Z`) } : {}) },
      },
      select: { id: true, eventDate: true },
      orderBy: { eventDate: 'asc' },
    })
    .catch(() => []);

  const overrides = await prisma.serviceWeekOverride
    .findMany({ select: { eventDate: true, condition: true } })
    .catch(() => []);
  const skipDays = new Set(
    overrides.filter((o) => SKIP_CONDITIONS.includes(String(o.condition || '').toUpperCase())).map((o) => dayISO(o.eventDate)),
  );

  const existingRows = await prisma.servingAssignment
    .findMany({ select: { eventDate: true } })
    .catch(() => []);
  const existingDays = new Set(existingRows.map((r) => dayISO(r.eventDate)));

  const eventByDay = new Map();
  for (const e of events) {
    const day = dayISO(e.eventDate);
    if (day && !eventByDay.has(day)) eventByDay.set(day, e.id);
  }
  const serviceDays = [...eventByDay.keys()].filter((d) => !skipDays.has(d)).sort();

  const pairs = await loadCyclePairs(prisma, { fresh: true });
  const groups = await prisma.group.findMany({ select: { id: true, name: true } }).catch(() => []);

  const rows = [];
  serviceDays.forEach((day, seq) => {
    if (existingDays.has(day)) return; // sudah ada → jangan diganggu
    const cycleIndex = ((seq % 10) + 10) % 10;
    const pair = pairFromList(pairs, cycleIndex, groups);
    if (!pair.responsibleGroupId || !pair.hostGroupId) return;
    rows.push({
      date: day,
      cycleIndex,
      eventId: eventByDay.get(day) || null,
      responsibleGroupId: pair.responsibleGroupId,
      hostGroupId: pair.hostGroupId,
      responsibleName: pair.responsibleName,
      hostName: pair.hostName,
    });
  });

  return { rows, serviceDays, existing: [...existingDays].sort() };
}

/** Tulis baris yang direncanakan (idempoten per tanggal). */
export async function applyServingBackfill(prisma, rows) {
  let created = 0;
  let skipped = 0;
  for (const r of rows || []) {
    const day = new Date(`${r.date}T00:00:00.000Z`);
    const exists = await prisma.servingAssignment.findFirst({ where: { eventDate: day }, select: { id: true } }).catch(() => null);
    if (exists) { skipped += 1; continue; }
    const id = `sva-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${Math.random().toString(36).slice(2, 4)}`;
    try {
      await prisma.servingAssignment.create({
        data: {
          id,
          eventId: r.eventId || null,
          eventDate: day,
          serviceType: 'SERVING_DAY',
          responsibleGroupId: r.responsibleGroupId,
          hostGroupId: r.hostGroupId,
          cycleIndex: r.cycleIndex,
        },
      });
      created += 1;
    } catch {
      skipped += 1;
    }
  }
  return { created, skipped };
}

/** Daftar minggu layanan (untuk referensi UI) pada satu bulan. */
export function serviceSundaysInMonth(year, month) {
  const list = sundaysInMonth(year, month);
  return list.map((d) => d.toISOString().slice(0, 10));
}
