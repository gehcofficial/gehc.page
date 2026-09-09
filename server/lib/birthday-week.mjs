/**
 * Ulang tahun Senin–Minggu (WIB).
 * Semua perbandingan memakai kunci hari YYYY-MM-DD WIB agar batas
 * tengah malam benar (UTC bisa salah sehari pada 00–07 WIB).
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86400000;

export function wibDayKey(d) {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayWibKey(now = new Date()) {
  return wibDayKey(now);
}

function addDaysKey(dayKey, delta) {
  const t = Date.parse(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(t)) return '';
  return new Date(t + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Senin dari minggu yang memuat dayKey (Senin–Minggu). */
export function mondayOfWeek(dayKey) {
  const t = Date.parse(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(t)) return '';
  // getUTCDay: 0=Minggu..6=Sabtu → offset ke Senin.
  const dow = new Date(t).getUTCDay();
  return addDaysKey(dayKey, dow === 0 ? -6 : 1 - dow);
}

/** Daftar 7 kunci MM-DD dalam minggu Senin–Minggu + peta ke offset dari Senin. */
function weekMonthDays(mondayKey) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(mondayKey, i);
    if (key) out.push({ mmdd: key.slice(5), offset: i });
  }
  return out;
}

/**
 * Apakah (bulan, tanggal) lahir jatuh di minggu ini?
 * 29 Feb dirayakan 28 Feb pada tahun non-kabisat.
 * Return offset hari dari Senin (0–6) atau -1.
 */
export function birthdayOffsetInWeek(month, day, mondayKey) {
  const m = Number(month);
  const d = Number(day);
  if (!m || !d) return -1;
  const want = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  for (const w of weekMonthDays(mondayKey)) {
    if (w.mmdd === want) return w.offset;
    if (want === '02-29' && w.mmdd === '02-28') return w.offset;
  }
  return -1;
}

export const DEFAULT_BIRTHDAY_CAPTION =
  'Selamat ulang tahun, {nama}! Tuhan Yesus memberkati di usia {umur} tahun. 🎉';

/** Render caption: {nama} → nama depan, {umur} → umur. */
export function renderBirthdayCaption(caption, { name = '', age = null } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'Jemaat';
  return String(caption || DEFAULT_BIRTHDAY_CAPTION)
    .split('{nama}').join(first)
    .split('{umur}').join(age === null || age === undefined ? '–' : String(age));
}

/**
 * Daftar ulang tahun minggu berjalan dari baris user {id,name,avatar,birthDate}.
 * Return { birthdays: [{...daysToBirthday}], weekStart, weekEnd, todayCount }.
 */
export function birthdaysThisWeek(users, now = new Date()) {
  const today = todayWibKey(now);
  if (!today) return { birthdays: [], weekStart: '', weekEnd: '', todayCount: 0 };
  const monday = mondayOfWeek(today);
  const todayOffset = weekMonthDays(monday).find((w) => {
    const key = addDaysKey(monday, w.offset);
    return key === today;
  })?.offset ?? 0;
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  const td = Number(today.slice(8, 10));
  const list = [];
  for (const u of users || []) {
    const b = u.birthDate ? new Date(u.birthDate) : null;
    if (!b || Number.isNaN(b.getTime())) continue;
    // birthDate tersimpan sebagai tanggal (UTC) — ambil komponen UTC-nya.
    const off = birthdayOffsetInWeek(b.getUTCMonth() + 1, b.getUTCDate(), monday);
    if (off < 0) continue;
    // Umur yang genap di tahun berjalan.
    const by = b.getUTCFullYear();
    const bm = b.getUTCMonth() + 1;
    const bd = b.getUTCDate();
    let age = ty - by;
    if (tm < bm || (tm === bm && td < bd)) age -= 1;
    list.push({
      id: u.id,
      name: u.name,
      avatar: u.avatar || null,
      birthDate: b.toISOString().slice(0, 10),
      age: age >= 0 ? age : null,
      daysToBirthday: off - todayOffset,
    });
  }
  list.sort((a, b) => a.daysToBirthday - b.daysToBirthday || String(a.name).localeCompare(String(b.name)));
  return {
    birthdays: list.slice(0, 24),
    weekStart: monday,
    weekEnd: addDaysKey(monday, 6),
    todayCount: list.filter((x) => x.daysToBirthday === 0).length,
  };
}
