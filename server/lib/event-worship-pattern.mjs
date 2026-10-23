/**
 * Pola ibadah dari sesi Didaskalia yang terikat event (atau tanggal).
 * @returns {Promise<string>} kode pola (default CREATIVE_LAB)
 */
export async function resolveWorshipPatternCode(prisma, event) {
  if (!prisma || !event) return 'CREATIVE_LAB';
  const fallback = 'CREATIVE_LAB';
  try {
    if (event.id) {
      const byEvent = await prisma.worshipSession.findFirst({
        where: { eventId: String(event.id) },
        include: { pattern: { select: { code: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      if (byEvent?.pattern?.code) return String(byEvent.pattern.code).toUpperCase();
    }
    if (event.eventDate) {
      const day = new Date(event.eventDate).toISOString().slice(0, 10);
      const byDate = await prisma.worshipSession.findFirst({
        where: { sessionDate: new Date(`${day}T00:00:00.000Z`) },
        include: { pattern: { select: { code: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      if (byDate?.pattern?.code) return String(byDate.pattern.code).toUpperCase();
    }
  } catch {
    return fallback;
  }
  return fallback;
}
