/**
 * Ekspektasi rotasi serving (Minggu grid) — dipakai GET assignments & resolver caption.
 */
import { sundaysInMonth } from './church-year.mjs';
import { listOverrides } from './service-overrides.mjs';
import { BACKFILL_ANCHOR } from './serving-backfill.mjs';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Minggu GESER yang sudah dipindah ke tanggal lain tetap menghabiskan satu slot rotasi 10 grup.
 */
export function geserConsumesRotationSlot(override, movedAssignment) {
  if (!override || String(override.condition || '').toUpperCase() !== 'GESER') return false;
  if (!override.newEventDate || !movedAssignment) return false;
  return true;
}

function toDateOnly(d) {
  if (!d) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  const s = String(d).slice(0, 10);
  return ISO_RE.test(s) ? s : null;
}

/** Minggu serving (bukan W1 mentoring) dalam rentang from–to. */
export function collectServingSundaysInRange(from, to) {
  const fromDay = toDateOnly(from);
  const toDay = toDateOnly(to);
  if (!fromDay || !toDay) return [];
  const fromDt = new Date(`${fromDay}T00:00:00Z`);
  const toDt = new Date(`${toDay}T00:00:00Z`);
  const start = new Date(Date.UTC(fromDt.getUTCFullYear(), fromDt.getUTCMonth(), 1));
  const end = new Date(Date.UTC(toDt.getUTCFullYear(), toDt.getUTCMonth(), 1));
  const sundays = [];
  for (let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1; y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth() + 1); ) {
    for (const s of sundaysInMonth(y, m)) sundays.push(s);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (sundays.length > 80) break;
  }
  return sundays
    .filter((d) => {
      const iso = d.toISOString().slice(0, 10);
      const dt = new Date(`${iso}T00:00:00Z`);
      if (dt < fromDt || dt > toDt) return false;
      const mo = dt.getUTCMonth() + 1;
      const yr = dt.getUTCFullYear();
      const first = sundaysInMonth(yr, mo)[0];
      if (first && dt.getTime() === first.getTime()) return false;
      return true;
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

export function isServingGridSunday(iso) {
  if (!ISO_RE.test(String(iso || '').slice(0, 10))) return false;
  const day = String(iso).slice(0, 10);
  const dt = new Date(`${day}T00:00:00Z`);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const first = sundaysInMonth(y, m)[0];
  if (first && first.toISOString().slice(0, 10) === day) return false;
  return sundaysInMonth(y, m).some((s) => s.toISOString().slice(0, 10) === day);
}

/**
 * Map Minggu grid (YYYY-MM-DD) → expected cycleIndex 0..9.
 * @param {Map<string, object>} byDate — servingAssignment rows keyed by eventDate ISO
 */
export async function buildExpectedCycleIndexMap(prisma, from, to, byDate) {
  const map = new Map();
  if (!prisma) return map;
  const fromDay = toDateOnly(from);
  const toDay = toDateOnly(to);
  if (!fromDay || !toDay) return map;

  const fromDt = new Date(`${fromDay}T00:00:00Z`);
  const toDt = new Date(`${toDay}T00:00:00Z`);
  let baseIdx = 0;
  try {
    baseIdx = await prisma.servingAssignment.count({ where: { eventDate: { lt: fromDt } } });
  } catch { /* ignore */ }

  const servingSundays = collectServingSundaysInRange(fromDt, toDt);
  const overrides = await listOverrides(prisma, fromDay, toDay);

  let seq = 0;
  for (const s of servingSundays) {
    const iso = s.toISOString().slice(0, 10);
    const ov = overrides.get(iso);
    if (ov) {
      if (ov.condition === 'GESER' && ov.newEventDate) {
        const moved = byDate.get(ov.newEventDate);
        if (moved) {
          map.set(iso, (baseIdx + seq) % 10);
          if (geserConsumesRotationSlot(ov, moved)) seq += 1;
          continue;
        }
        continue;
      }
      continue;
    }
    map.set(iso, (baseIdx + seq) % 10);
    seq += 1;
  }
  return map;
}

/**
 * Read-only: cycle index untuk satu Minggu serving grid (selaras GET serving-assignments).
 * @returns {Promise<number|null>} null jika bukan minggu serving atau di luar rentang
 */
export async function expectedCycleIndexForServingSunday(prisma, gridDateISO) {
  const grid = toDateOnly(gridDateISO);
  if (!grid || !prisma || !isServingGridSunday(grid)) return null;
  const anchor = toDateOnly(BACKFILL_ANCHOR) || '2026-09-06';
  const fromDt = new Date(`${anchor}T00:00:00Z`);
  const toDt = new Date(`${grid}T00:00:00Z`);
  if (toDt < fromDt) return null;

  const rows = await prisma.servingAssignment
    .findMany({
      where: { eventDate: { gte: fromDt, lte: toDt } },
      select: { eventDate: true, cycleIndex: true, isSwapped: true },
    })
    .catch(() => []);
  const byDate = new Map(rows.map((r) => [new Date(r.eventDate).toISOString().slice(0, 10), r]));
  const map = await buildExpectedCycleIndexMap(prisma, fromDt, toDt, byDate);
  return map.has(grid) ? map.get(grid) : null;
}
