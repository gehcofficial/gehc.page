/**
 * Selaraskan cycleIndex serving_assignments ke expected map (rotasi deterministik).
 */
import { listOverrides } from './service-overrides.mjs';
import { buildExpectedCycleIndexMap } from './serving-week-expectations.mjs';
import { writePlatformAudit } from '../platform-operators.mjs';

function rowIso(row) {
  try {
    return new Date(row.eventDate).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/**
 * Perbaiki baris future non-swap yang cycleIndex-nya tidak selaras expected.
 * @returns {Promise<Array<{ assignmentId: string, eventDate: string, from: number, to: number }>>}
 */
export async function autoHealServingCycleIndexes(prisma, {
  rows,
  expectedByIso,
  overrides,
  todayISO,
  actorId = 'serving-auto-heal',
}) {
  if (!prisma || !rows?.length) return [];
  const healed = [];
  const ovMap = overrides instanceof Map ? overrides : new Map();

  for (const row of rows) {
    if (!row?.id || row.isSwapped) continue;
    const iso = rowIso(row);
    if (!iso || iso < todayISO) continue;
    const ov = ovMap.get(iso);
    if (ov && ['LIBUR', 'ALIH', 'GABUNGAN'].includes(String(ov.condition || '').toUpperCase())) continue;

    let expected = row._expectedCycleIndex ?? expectedByIso?.get(iso);
    if (expected == null) continue;
    const current = Number(row.cycleIndex);
    if (!Number.isInteger(current) || current === expected) continue;

    const fromIdx = current;
    try {
      await prisma.servingAssignment.update({
        where: { id: row.id },
        data: { cycleIndex: expected },
      });
      row.cycleIndex = expected;
      healed.push({ assignmentId: row.id, eventDate: iso, from: fromIdx, to: expected });
      await writePlatformAudit({
        actorType: 'SYSTEM',
        actorId,
        action: 'SERVING_CYCLE_INDEX_AUTO_HEAL',
        targetType: 'SERVING_ASSIGNMENT',
        targetId: row.id,
        meta: { eventDate: iso, from: fromIdx, to: expected },
      });
    } catch (err) {
      console.error('[serving-auto-heal]', row.id, err?.message || err);
    }
  }
  return healed;
}

/** Rebase manual: set cycleIndex = expected untuk semua baris future non-swap dalam rentang. */
export async function rebaseServingFromExpectedMap(prisma, fromDate) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const fromDay = fromDate instanceof Date ? fromDate.toISOString().slice(0, 10) : String(fromDate || todayISO).slice(0, 10);
  const fromDt = new Date(`${fromDay}T00:00:00Z`);
  const toDt = new Date(fromDt);
  toDt.setUTCMonth(toDt.getUTCMonth() + 8);

  const rows = await prisma.servingAssignment.findMany({
    where: { eventDate: { gte: fromDt, lte: toDt } },
    orderBy: { eventDate: 'asc' },
    take: 250,
  });
  const byDate = new Map(rows.map((r) => [rowIso(r), r]));
  const overrides = await listOverrides(prisma, fromDay, toDt.toISOString().slice(0, 10));
  const expectedByIso = await buildExpectedCycleIndexMap(prisma, fromDt, toDt, byDate);
  const healed = await autoHealServingCycleIndexes(prisma, {
    rows,
    expectedByIso,
    overrides,
    todayISO,
    actorId: 'serving-rebase',
  });
  return { updated: healed.length, healed, from: fromDay };
}
