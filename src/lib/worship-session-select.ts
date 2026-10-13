/**
 * Pemilihan sesi otomatis: preferensi eksplisit dulu (sepanjang masih relevan
 * dengan konteks event/pola aktif), lalu pola pekan, lalu urutan list.
 * Dipakai MentoringControl + SessionDraftTab agar kontrol tidak nyangkut di
 * sesi pola lama (mis. judul film basi padahal pekan MONOLOG) atau sesi pekan
 * lain (mis. sesi Rescue Plan W2 masih terpilih setelah pindah ke event W3).
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
  const want = String(o.preferPattern || '').toUpperCase();
  if (o.prevId) {
    const prev = list.find((s) => s.id === o.prevId);
    if (prev) {
      // Seleksi lama hanya relevan bila masih satu event dengan konteks aktif.
      // Tanpa filter event, atau event sama → hormati seperti dulu.
      const sameEvent = !o.eventId || (prev.eventId ?? null) === o.eventId;
      if (sameEvent) {
        if (!want) return prev.id;
        const prevPattern = String(prev.pattern?.code || '').toUpperCase();
        if (prevPattern === want) return prev.id;
        // Pola prev beda dari pola pekan: pilih sesi event yang cocok pola bila
        // ada (agar tidak nyangkut di sesi lama); bila belum ada, pertahankan
        // pilihan eksplisit agar banner mismatch + CTA buat/alihkan yang bicara.
        if (o.eventId) {
          const forEvent = list.filter((s) => s.eventId === o.eventId);
          const match = forEvent.find((s) => String(s.pattern?.code || '').toUpperCase() === want);
          if (match) return match.id;
        }
        return prev.id;
      }
      // Beda event (mis. pindah W2 → W3): abaikan prev, lanjut ke logika bawah.
    }
  }
  if (o.slug) {
    const bySlug = list.find((s) => s.slug === o.slug);
    if (bySlug) return bySlug.id;
  }
  if (o.eventId) {
    const forEvent = list.filter((s) => s.eventId === o.eventId);
    if (forEvent.length) {
      if (want) {
        const match = forEvent.find((s) => String(s.pattern?.code || '').toUpperCase() === want);
        if (match) return match.id;
      }
      return forEvent[0].id;
    }
    // Event difilter tapi belum punya sesi — jangan comot sesi event lain
    // (mis. sesi Rescue Plan W2 tampil di draft event W3). Kosong = empty-state
    // buat sesi baru pola pekan.
    return '';
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
