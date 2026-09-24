/**
 * Akses materi Didaskalia berdasarkan PENUGASAN penatalayan.
 *
 * Pemilik: petugas yang ditugaskan (mis. Pembaca Firman) berhak mengakses
 * pembekalan untuk pekan/ibadah tempat ia bertugas — sejak ditugaskan
 * sampai H+7 setelah tanggal tugas.
 */
import { getPrisma } from '../db.mjs';

const AFTER_DAYS = 7;
const BEFORE_DAYS = 45;

function dayUtc(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Minggu (YYYY-MM) + indeks pekan (1..) untuk sebuah tanggal — untuk tautan materi. */
export function weekIndexForDate(iso) {
  const base = dayUtc(iso);
  if (!base) return { yearMonth: '', weekIndex: 1 };
  const sunday = new Date(base);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  const yearMonth = sunday.toISOString().slice(0, 7);
  let idx = 0;
  const cur = new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), 1));
  const target = sunday.toISOString().slice(0, 10);
  while (cur.getUTCMonth() === sunday.getUTCMonth()) {
    if (cur.getUTCDay() === 0) {
      idx += 1;
      if (cur.toISOString().slice(0, 10) === target) break;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return { yearMonth, weekIndex: Math.max(1, idx) };
}

/** Tautan materi pembekalan untuk tanggal penugasan. */
export function pembekalanLink(iso) {
  const { yearMonth, weekIndex } = weekIndexForDate(iso);
  return yearMonth ? `#/materi/pembekalan/${yearMonth}/${weekIndex}` : '#/portal';
}

/**
 * @param {{ id?: string, roles?: Array<{role:string}> }} authUser
 * @param {{ eventId?: string, date?: string }} opts
 */
export async function isAssignedDidaskaliaOfficer(authUser, { eventId, date } = {}) {
  if (!authUser?.id) return false;
  const prisma = getPrisma();
  if (!prisma) return false;
  try {
    const where = {
      userId: authUser.id,
      status: { not: 'CANCELLED' },
      serviceRole: { division: 'DIDASKALIA' },
    };
    if (eventId) where.eventId = eventId;
    const base = dayUtc(date);
    if (base) {
      const from = new Date(base); from.setUTCDate(from.getUTCDate() - BEFORE_DAYS);
      const to = new Date(base); to.setUTCDate(to.getUTCDate() + AFTER_DAYS);
      where.date = { gte: from, lte: to };
    }
    const hit = await prisma.serviceSchedule.findFirst({ where, select: { id: true } });
    return !!hit;
  } catch {
    return false;
  }
}

/** Penugasan DIDASKALIA mendatang dalam jendela (untuk flag UI). */
export async function hasUpcomingDidaskaliaDuty(authUser) {
  if (!authUser?.id) return false;
  const prisma = getPrisma();
  if (!prisma) return false;
  try {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const from = new Date(today); from.setUTCDate(from.getUTCDate() - 14);
    const to = new Date(today); to.setUTCDate(to.getUTCDate() + AFTER_DAYS);
    const hit = await prisma.serviceSchedule.findFirst({
      where: { userId: authUser.id, status: { not: 'CANCELLED' }, serviceRole: { division: 'DIDASKALIA' }, date: { gte: from, lte: to } },
      select: { id: true },
    });
    return !!hit;
  } catch {
    return false;
  }
}
