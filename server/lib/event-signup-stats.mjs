/**
 * Statistik pendaftaran generik per event.
 * Sumber: waiting_pool (sourceEvent = nama event, termasuk counter tanpa akun)
 * + event_attendees (pendaftar login). Dedupe per userId.
 */

/** Nama sumber waiting_pool untuk sebuah event (sejajar BAKU_TAU_SOURCE_EVENT). */
export function sourceEventOf(event) {
  return String(event?.name || '').trim();
}

export async function eventSignupStats(prisma, event) {
  const source = sourceEventOf(event);
  try {
    const [pools, attendees] = await Promise.all([
      source
        ? prisma.waitingPool.findMany({
            where: { sourceEvent: source },
            select: { userId: true, eventCheckedInAt: true },
          })
        : [],
      prisma.eventAttendee.findMany({
        where: { eventId: event.id },
        select: { userId: true, checkedInAt: true },
      }).catch(() => []),
    ]);
    const poolUserIds = new Set(pools.map((p) => p.userId).filter(Boolean));
    const extraAttendees = attendees.filter((a) => !poolUserIds.has(a.userId));
    const allUserIds = new Set([...poolUserIds, ...attendees.map((a) => a.userId)]);
    const checkedIn =
      pools.filter((p) => p.eventCheckedInAt).length +
      extraAttendees.filter((a) => a.checkedInAt).length;
    return {
      registered: pools.length + extraAttendees.length,
      withAccount: allUserIds.size,
      checkedIn,
    };
  } catch {
    return { registered: 0, withAccount: 0, checkedIn: 0 };
  }
}
