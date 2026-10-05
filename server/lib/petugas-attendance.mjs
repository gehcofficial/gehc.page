/**
 * Kehadiran otomatis petugas (semua peran ServiceSchedule yang CONFIRMED).
 *
 * - CONFIRMED → upsert EventAttendee (terdaftar) + checkedInAt langsung,
 *   ditandai metadata.autoPetugas (tanpa migrasi skema).
 * - Keluar CONFIRMED (→ SCHEDULED/CANCELLED) → cabut HANYA baris auto:
 *   hapus baris bila didaftarkan oleh auto; bila baris manual, bersihkan
 *   checkedInAt auto kecuali sudah ada scan manual (metadata.manualScan).
 * - Idempoten: baris manual / sudah scan tidak tertimpa.
 */
import crypto from 'node:crypto';

const eaId = () => `ea-${crypto.randomUUID()}`;

const up = (s) => String(s || '').toUpperCase();

/**
 * @param schedule { id, eventId, userId, roleName?, status } — status = TUJUAN
 * @param from status asal
 * @param actorId id pengonfirmasi (dicatat sebagai checkedInById auto)
 * @returns { action }
 */
export async function syncPetugasAttendance(prisma, { schedule, from, actorId }) {
  const to = up(schedule?.status);
  const prev = up(from);
  const eventId = schedule?.eventId || null;
  const userId = schedule?.userId || null;
  if (!eventId || !userId) return { action: 'skipped-no-event' };

  if (to === 'CONFIRMED' && prev !== 'CONFIRMED') {
    const now = new Date();
    const existing = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    const mark = {
      scheduleId: schedule.id,
      role: schedule.roleName || null,
      at: now.toISOString(),
      registeredByAuto: !existing,
    };
    if (!existing) {
      await prisma.eventAttendee.create({
        data: {
          id: eaId(),
          eventId,
          userId,
          checkedInAt: now,
          checkedInById: actorId || null,
          metadata: { autoPetugas: mark },
        },
      });
      return { action: 'auto' };
    }
    if (!existing.checkedInAt) {
      await prisma.eventAttendee.update({
        where: { id: existing.id },
        data: {
          checkedInAt: now,
          checkedInById: actorId || null,
          metadata: { ...((existing.metadata && typeof existing.metadata === 'object') ? existing.metadata : {}), autoPetugas: mark },
        },
      });
      return { action: 'auto-filled' };
    }
    return { action: 'kept-manual' };
  }

  if (prev === 'CONFIRMED' && to !== 'CONFIRMED') {
    const existing = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    const meta = (existing?.metadata && typeof existing.metadata === 'object') ? existing.metadata : {};
    const ap = meta.autoPetugas;
    if (!existing || !ap || ap.scheduleId !== schedule.id) return { action: 'none' };
    const { autoPetugas: _drop, ...rest } = meta;
    if (ap.registeredByAuto && !meta.manualScan) {
      await prisma.eventAttendee.delete({ where: { id: existing.id } });
      return { action: 'revoked' };
    }
    if (meta.manualScan) {
      await prisma.eventAttendee.update({ where: { id: existing.id }, data: { metadata: rest } });
      return { action: 'kept-manual-scan' };
    }
    await prisma.eventAttendee.update({
      where: { id: existing.id },
      data: { checkedInAt: null, checkedInById: null, metadata: rest },
    });
    return { action: 'revoked-hadir' };
  }

  return { action: 'none' };
}
