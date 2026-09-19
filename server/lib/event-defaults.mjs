/**
 * Default event mingguan dari Profil Gereja (satu sumber kebenaran):
 * tempat (nama/alamat gereja), jam ibadah (schedules), dan WA grup default.
 *
 * Bagian pemilih bersifat murni (diuji); pembacaan DB terpisah.
 */

export const FALLBACK_VENUE = 'GMIM Eben Haezer Cikarang';
export const FALLBACK_TIME_START = '13:00';
export const FALLBACK_TIME_END = '15:00';

/** "13:00" / "13.00" / "13:00 WIB" → "13:00"; null bila tak valid. */
export function normalizeTime(value) {
  const s = String(value || '').trim();
  const m = /(\d{1,2})[.:](\d{2})/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Pilih jadwal ibadah dari ChurchProfile.schedules.
 * schedules: [{ label, day, time }] — `time` boleh "13:00" atau "13:00-15:00".
 * Untuk SERVING_DAY/MENTORING_DAY, utamakan label yang menyebut "ibadah"/"pemuda".
 */
export function pickDefaultSchedule(schedules, serviceType) {
  const list = Array.isArray(schedules) ? schedules : [];
  const isWorship = ['MENTORING_DAY', 'SERVING_DAY'].includes(String(serviceType || ''));
  const pick = (rows) => {
    for (const s of rows) {
      const raw = String(s?.time || '');
      const [a, b] = raw.split(/[-–—]/).map((x) => normalizeTime(x));
      const start = a || normalizeTime(raw);
      if (start) return { timeStart: start, timeEnd: b || null };
    }
    return null;
  };
  if (isWorship) {
    // Prioritas: jadwal khusus pemuda → jadwal ibadah umum → apa saja.
    const youth = list.filter((s) => /pemuda|youth|raya|mentoring/i.test(String(s?.label || '')));
    const worship = list.filter((s) => /ibadah/i.test(String(s?.label || '')));
    return pick(youth) || pick(worship) || pick(list) || { timeStart: null, timeEnd: null };
  }
  return pick(list) || { timeStart: null, timeEnd: null };
}

/** Nilai default lengkap dari baris ChurchProfile. */
export function eventDefaultsFromProfile(profile, serviceType) {
  const venue = String(profile?.name || '').trim() || FALLBACK_VENUE;
  const sched = pickDefaultSchedule(profile?.schedules, serviceType);
  return {
    venueName: venue,
    whatsappGroupUrl: String(profile?.whatsappGroupUrl || '').trim() || null,
    timeStart: sched.timeStart || FALLBACK_TIME_START,
    timeEnd: sched.timeEnd || FALLBACK_TIME_END,
  };
}

/** Baca Profil Gereja dari DB lalu hitung default (aman bila DB kosong). */
export async function resolveEventDefaults(prisma, serviceType) {
  if (!prisma) return eventDefaultsFromProfile(null, serviceType);
  try {
    const profile = await prisma.churchProfile.findFirst({
      select: { name: true, schedules: true, whatsappGroupUrl: true },
      orderBy: { updatedAt: 'desc' },
    }).catch(() => null);
    return eventDefaultsFromProfile(profile, serviceType);
  } catch {
    return eventDefaultsFromProfile(null, serviceType);
  }
}
