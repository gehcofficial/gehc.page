/**
 * Pemilihan sesi otomatis mengikuti siklus mingguan ideal (kosong → pola →
 * draft → kontrol): preferensi eksplisit dulu (sepanjang masih relevan dengan
 * konteks event/pola aktif), lalu sesi event yang cocok pola pekan. Bila pola
 * pekan diset tapi event belum punya sesi pola itu → kosong (empty-state buat
 * sesi baru), BUKAN sesi pola lama — agar draft/kontrol tiap pekan mulai bersih.
 * Dipakai MentoringControl + SessionDraftTab.
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
  // Tautan langsung (#/mentoring/<slug>/kontrol) menang atas sesi yang
  // sedang terbuka dan atas filter pekan. Kalau tidak, URL sesi lama
  // jatuh ke empty-state "pekan ini" atau ke sesi lain.
  if (o.slug) {
    const wantSlug = String(o.slug).toLowerCase();
    const bySlug = list.find((s) => String(s.slug || '').toLowerCase() === wantSlug);
    if (bySlug) return bySlug.id;
  }
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
        // ada; bila belum ada → kosong (empty-state buat sesi baru pola pekan),
        // bukan sesi lama — sesi lama tetap dibuka manual via daftar/arsip.
        if (o.eventId) {
          const forEvent = list.filter((s) => s.eventId === o.eventId);
          const match = forEvent.find((s) => String(s.pattern?.code || '').toUpperCase() === want);
          return match ? match.id : '';
        }
        return prev.id;
      }
      // Beda event (mis. pindah W2 → W3): abaikan prev, lanjut ke logika bawah.
    }
  }
  if (o.eventId) {
    const forEvent = list.filter((s) => s.eventId === o.eventId);
    if (forEvent.length) {
      if (want) {
        // Ketat pola: tanpa sesi cocok → kosong (buat baru), bukan sesi lama.
        // Tanpa preferPattern → fallback urutan list seperti dulu.
        const match = forEvent.find((s) => String(s.pattern?.code || '').toUpperCase() === want);
        return match ? match.id : '';
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
