/**
 * Pemilihan sesi otomatis: preferensi eksplisit dulu, lalu pola pekan,
 * lalu urutan list. Dipakai MentoringControl + SessionDraftTab agar kontrol
 * tidak nyangkut di sesi pola lama (mis. judul film basi padahal pekan MONOLOG).
 */

export type SessionLite = {
  id: string;
  slug?: string | null;
  eventId?: string | null;
  pattern?: { code?: string | null } | null;
};

export function preferSession(
  list: SessionLite[],
  opts: { prevId?: string | null; slug?: string | null; eventId?: string | null; preferPattern?: string | null },
): string {
  const o = opts || {};
  if (o.prevId && list.some((s) => s.id === o.prevId)) return o.prevId as string;
  if (o.slug) {
    const bySlug = list.find((s) => s.slug === o.slug);
    if (bySlug) return bySlug.id;
  }
  if (o.eventId) {
    const forEvent = list.filter((s) => s.eventId === o.eventId);
    if (forEvent.length) {
      const want = String(o.preferPattern || '').toUpperCase();
      if (want) {
        const match = forEvent.find((s) => String(s.pattern?.code || '').toUpperCase() === want);
        if (match) return match.id;
      }
      return forEvent[0].id;
    }
  }
  return list[0]?.id || '';
}

/** Label opsi dropdown: "[POLA] judul — status" agar pola basi terlihat. */
export function sessionOptionLabel(s: { id?: string | null; title?: string | null; slug?: string | null; status?: string | null; pattern?: { code?: string | null } | null }, statusLabel?: string): string {
  const code = String(s.pattern?.code || '').toUpperCase();
  const name = s.title || s.slug || s.id;
  const st = statusLabel ?? String(s.status || '');
  return `${code ? `[${code}] ` : ''}${name} — ${st}`;
}
