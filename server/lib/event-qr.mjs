import { buildAttendeeCode, buildCheckInCode } from './check-in-code.mjs';

/**
 * QR per (user, event) tanpa ubah schema:
 * - baris pool milik event ini (sourceEvent cocok) → kode pool;
 * - selain itu baris attendee event ini → kode attendee;
 * - tidak pernah memakai baris pool event lain (satu user bisa ikut banyak event).
 * Return { code, poolEntry } — poolEntry null bila kode dari attendee.
 */
export async function registrationCodeFor(prisma, { eventId, userId, sourceEvent }) {
  if (!userId) return { code: null, poolEntry: null };
  try {
    if (sourceEvent) {
      const pool = await prisma.waitingPool.findFirst({ where: { userId, sourceEvent } });
      if (pool) {
        return { code: buildCheckInCode(pool.id, pool.registeredAt || Date.now()), poolEntry: pool };
      }
    }
    if (eventId) {
      const attendee = await prisma.eventAttendee.findUnique({
        where: { eventId_userId: { eventId, userId } },
      }).catch(() => null);
      if (attendee) {
        return { code: buildAttendeeCode(attendee.id, attendee.registeredAt || Date.now()), poolEntry: null };
      }
    }
  } catch { /* abaikan — pendaftar tanpa QR lebih baik daripada 500 */ }
  return { code: null, poolEntry: null };
}
