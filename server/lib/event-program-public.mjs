/** Kolom yang dipakai Info Event / halaman publik — tanpa indeks Drive arsip. */
export const EVENT_PROGRAM_PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  eventDate: true,
  venueName: true,
  locationDetail: true,
  mapUrl: true,
  mapEmbedQuery: true,
  whatsappGroupUrl: true,
};

export async function findEventProgramPublic(prisma, where) {
  try {
    return await prisma.eventProgram.findUnique({
      where,
      select: EVENT_PROGRAM_PUBLIC_SELECT,
    });
  } catch (err) {
    console.warn('[event-program] public lookup failed:', err?.message);
    return null;
  }
}
