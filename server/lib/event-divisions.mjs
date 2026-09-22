/**
 * Divisi standar event (panca tugas + Benzarpreneurship).
 * Dipakai untuk memastikan tiap event ibadah punya workspace divisi otomatis.
 */
import crypto from 'node:crypto';

export const EVENT_DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];

/**
 * Pastikan baris `EventDivision` ada untuk daftar divisi (idempoten).
 * @returns {{ created: number }}
 */
export async function ensureEventDivisions(prisma, eventId, divisions = EVENT_DIVISIONS) {
  if (!prisma || !eventId) return { created: 0 };
  const existing = await prisma.eventDivision
    .findMany({ where: { eventId }, select: { division: true } })
    .catch(() => []);
  const have = new Set(existing.map((e) => String(e.division || '').toUpperCase()));
  const want = [...new Set(
    (Array.isArray(divisions) ? divisions : [])
      .map((d) => String(d || '').toUpperCase())
      .filter((d) => EVENT_DIVISIONS.includes(d)),
  )];

  let created = 0;
  for (const div of want) {
    if (have.has(div)) continue;
    try {
      await prisma.eventDivision.create({
        data: { id: `evd-${crypto.randomUUID()}`, eventId, division: div },
      });
      created += 1;
    } catch {
      /* balapan duplikat — abaikan */
    }
  }
  return { created };
}

/** Event ibadah mingguan (semua divisi perlu workspace). */
export function isWeeklyWorshipEvent(ev) {
  const kind = String(ev?.kind || '').toUpperCase();
  const serviceType = String(ev?.serviceType || '').toUpperCase();
  return kind === 'UMUM' || serviceType === 'SERVING_DAY' || serviceType === 'MENTORING_DAY';
}
