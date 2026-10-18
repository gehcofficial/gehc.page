/**
 * Deck slide pre-roll film (BEDAH_FILM) — murni, tanpa React.
 * Dipakai layar proyektor (`FilmPreRoll.tsx`) saat menunggu pemutaran:
 * pembuka ala rumah produksi → cap sensor → info film → himbauan bioskop
 * → pengumuman tambahan dari operator (mis. konsumsi tuan rumah).
 */

export type PreRollIcon =
  | 'clapperboard'
  | 'stamp'
  | 'film'
  | 'volume'
  | 'smartphone'
  | 'popcorn'
  | 'sparkles'
  | 'moon'
  | 'door'
  | 'ticket'
  | 'megaphone';

export type PreRollSlide = {
  id: string;
  kicker: string;
  headline: string;
  sub?: string;
  icon: PreRollIcon;
  /** Animasi cap sensor (masuk membesar + miring, seperti distempel). */
  variant?: 'stamp';
};

/** Batas pengumuman tambahan per sesi (selaras `cleanScreening` di server). */
export const PRE_ROLL_MAX_CUSTOM = 6;
/** Panjang maksimum satu pengumuman tambahan. */
export const PRE_ROLL_MAX_CUSTOM_CHARS = 140;

/**
 * Susun deck pre-roll. Slide pengumuman tambahan disisipkan setelah
 * info konsumsi (sebelum himbauan penutup) agar mengalir seperti
 * blok hiburan→info→penutup pada pre-show bioskop.
 */
export function buildFilmPreRoll(input: {
  title?: string | null;
  durationMin?: number | null;
  customLines?: (string | null | undefined)[] | null;
}): PreRollSlide[] {
  const title = String(input.title || '').trim();
  const durationMin = Math.max(0, Math.round(Number(input.durationMin) || 0));

  const slides: PreRollSlide[] = [
    {
      id: 'pembuka',
      kicker: 'Youth GEHC mempersembahkan',
      headline: 'BEDAH FILM',
      sub: 'Satu film, satu firman, satu malam.',
      icon: 'clapperboard',
    },
    {
      id: 'sensor',
      kicker: 'Benzinema — Lembaga Sensor',
      headline: 'LOLOS SENSOR',
      sub: 'Kategori: semua umur — dilarang mengantuk.',
      icon: 'stamp',
      variant: 'stamp',
    },
  ];

  if (title) {
    slides.push({
      id: 'film',
      kicker: 'Malam ini',
      headline: title,
      sub: durationMin > 0 ? `± ${durationMin} menit — tanpa jeda, tanpa iklan.` : 'Tanpa jeda, tanpa iklan.',
      icon: 'film',
    });
  }

  slides.push(
    {
      id: 'tenang',
      kicker: 'Himbauan',
      headline: 'Harap tenang — lampu meredup',
      sub: 'Biarkan film berbicara — fokus mendengar.',
      icon: 'volume',
    },
    {
      id: 'hp',
      kicker: 'Tetap boleh',
      headline: 'HP boleh dipegang',
      sub: 'Jawab 3 catatan dengan jujur — tiap jawaban ada afirmasi firman untukmu.',
      icon: 'smartphone',
    },
    {
      id: 'konsumsi',
      kicker: 'Info tuan rumah',
      headline: 'Konsumsi dibagikan saat sesi',
      sub: 'Nikmati hidangannya — berisik boleh, mengganggu jangan.',
      icon: 'popcorn',
    },
  );

  const customs = (Array.isArray(input.customLines) ? input.customLines : [])
    .map((line) => String(line ?? '').trim().slice(0, PRE_ROLL_MAX_CUSTOM_CHARS))
    .filter(Boolean)
    .slice(0, PRE_ROLL_MAX_CUSTOM)
    .map((line, i): PreRollSlide => ({
      id: `custom-${i}`,
      kicker: 'Info dari tuan rumah',
      headline: line,
      icon: 'megaphone',
    }));
  slides.push(...customs);

  slides.push(
    {
      id: 'tanpa-jeda',
      kicker: 'Fitur spesial',
      headline: 'Tanpa trailer, tanpa jeda iklan',
      sub: 'Firman bekerja langsung ke hati.',
      icon: 'sparkles',
    },
    {
      id: 'tidur',
      kicker: 'Himbauan',
      headline: 'Dilarang tidur',
      sub: 'Nanti ketinggalan bagian terbaiknya.',
      icon: 'moon',
    },
    {
      id: 'refleksi',
      kicker: 'Pintu keluar',
      headline: 'Keluar lewat pintu refleksi',
      sub: 'Bawa pulang satu kebenaran malam ini.',
      icon: 'door',
    },
    {
      id: 'tiket',
      kicker: 'Selamat menonton',
      headline: 'Semua kursi premium',
      sub: 'Tidak ada tiket yang salah — termasuk kamu.',
      icon: 'ticket',
    },
  );

  return slides;
}
