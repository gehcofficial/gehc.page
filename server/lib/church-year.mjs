/**
 * Kalender gerejawi GMIM — dihitung, bukan tabel per tahun.
 *
 * Semua hari raya bergerak diturunkan dari Paskah lewat algoritma Computus
 * (Anonymous Gregorian / Meeus), jadi otomatis benar untuk tahun berapa pun.
 * Tanggal tetap GMIM dan jemaat GEHC dideklarasikan dengan tahun basis supaya
 * nomor peringatan ("ke-92") ikut terhitung.
 *
 * Tanggal dipakai sebagai hari kalender (tanpa zona waktu) — disimpan ke kolom DATE.
 */

export const TENANT_DEFAULT = 'tenant-youth';

/** 30 September 1934 — GMIM dinyatakan gereja mandiri. */
const GMIM_SYNOD_BASE_YEAR = 1934;
/** 12 Juni 1831 — Riedel & Schwarz tiba di Minahasa. */
const GMIM_PI_BASE_YEAR = 1831;
/** Pemuda GMIM berakar dari PPKM 1926. */
const GMIM_YOUTH_BASE_YEAR = 1926;
/** Komisi Pelayanan Remaja Sinode GMIM. */
const GMIM_TEEN_BASE_YEAR = 1990;
/** Pria Kaum Bapa GMIM. */
const GMIM_PKB_BASE_YEAR = 1962;
/** GMIM Eben Haezer Cikarang dilembagakan 23 Maret 2019. */
export const GEHC_ANNIVERSARY_BASE_YEAR = 2019;
export const GEHC_ANNIVERSARY_MONTH = 3;
export const GEHC_ANNIVERSARY_DAY = 23;

const MS_PER_DAY = 86400000;

/** Tanggal UTC murni supaya aritmetika hari tidak kena DST/offset. */
export function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Computus (Anonymous Gregorian algorithm) — Minggu Paskah kalender Gregorian.
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

/** Adven I = Minggu keempat sebelum Natal (Natal sendiri tidak dihitung). */
export function adventSunday(year, which = 1) {
  const christmas = utcDate(year, 12, 25);
  // Minggu terakhir sebelum/pada 24 Des adalah Adven IV.
  const dow = christmas.getUTCDay();
  const advent4 = addDays(christmas, dow === 0 ? -7 : -dow);
  return addDays(advent4, (which - 4) * 7);
}

/** Hari Minggu ke-n pada satu bulan (1-indexed). */
export function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = utcDate(year, month, 1);
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return addDays(first, shift + (nth - 1) * 7);
}

/** Semua hari Minggu dalam satu bulan — dasar grid rencana bulanan. */
export function sundaysInMonth(year, month) {
  const out = [];
  let d = nthWeekdayOfMonth(year, month, 0, 1);
  while (d.getUTCMonth() === month - 1) {
    out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

export function yearMonthOf(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Baris minggu mana pada grid rencana bulanan yang memuat tanggal ini.
 * Grid memakai hari Minggu sebagai awal minggu; tanggal sebelum Minggu
 * pertama tetap masuk baris 1.
 */
export function weekIndexForDate(date) {
  const sundays = sundaysInMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
  let index = 1;
  for (let i = 0; i < sundays.length; i += 1) {
    if (date.getTime() >= sundays[i].getTime()) index = i + 1;
  }
  return Math.min(index, sundays.length || 1);
}

/**
 * Musim gerejawi dari tanggal. Dipakai untuk mengisi `season` otomatis
 * supaya tidak lagi bergantung pada dropdown manual.
 */
export function deriveSeason(date, year = date.getUTCFullYear()) {
  const easter = easterSunday(year);
  const ashWednesday = addDays(easter, -46);
  const pentecost = addDays(easter, 49);
  const advent1 = adventSunday(year, 1);
  const t = date.getTime();

  if (t >= advent1.getTime() || (date.getUTCMonth() === 0 && date.getUTCDate() <= 6)) return 'NATAL';
  if (t >= ashWednesday.getTime() && t <= pentecost.getTime()) return 'PASKAH';
  if (isGmimAnniversaryWindow(date)) return 'HUT';
  return 'REGULAR';
}

function isGmimAnniversaryWindow(date) {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  if (m === 6 && d === 12) return true;
  if (m === 9 && d === 30) return true;
  if (m === GEHC_ANNIVERSARY_MONTH && d === GEHC_ANNIVERSARY_DAY) return true;
  return false;
}

/**
 * Nomor peringatan. GMIM Bersinode 1934 → 2026 adalah ke-92, jadi selisih
 * tahun langsung (bukan +1).
 */
function ordinal(year, baseYear) {
  return year - baseYear;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/**
 * Hari raya gerejawi yang bergerak mengikuti Paskah.
 */
export function movableFeasts(year) {
  const easter = easterSunday(year);
  return [
    { key: 'RABU_ABU', name: 'Rabu Abu', nameEn: 'Ash Wednesday', date: addDays(easter, -46), level: 'SINODE' },
    { key: 'MINGGU_PALMA', name: 'Minggu Palma', nameEn: 'Palm Sunday', date: addDays(easter, -7), level: 'SINODE' },
    { key: 'KAMIS_PUTIH', name: 'Kamis Putih', nameEn: 'Maundy Thursday', date: addDays(easter, -3), level: 'SINODE' },
    { key: 'JUMAT_AGUNG', name: 'Jumat Agung', nameEn: 'Good Friday', date: addDays(easter, -2), level: 'SINODE' },
    { key: 'PASKAH', name: 'Paskah', nameEn: 'Easter Sunday', date: easter, level: 'SINODE' },
    { key: 'PASKAH_II', name: 'Paskah II', nameEn: 'Easter Monday', date: addDays(easter, 1), level: 'SINODE' },
    { key: 'KENAIKAN', name: 'Kenaikan Yesus Kristus', nameEn: 'Ascension of Christ', date: addDays(easter, 39), level: 'SINODE' },
    { key: 'PENTAKOSTA', name: 'Pentakosta', nameEn: 'Pentecost', date: addDays(easter, 49), level: 'SINODE' },
    { key: 'TRINITATIS', name: 'Minggu Trinitatis', nameEn: 'Trinity Sunday', date: addDays(easter, 56), level: 'SINODE' },
  ];
}

/** Adven I–IV, Natal, dan tutup/buka tahun. */
export function nativityFeasts(year) {
  const out = [];
  for (let i = 1; i <= 4; i += 1) {
    out.push({
      key: `ADVEN_${i}`,
      name: `Adven ${ROMAN[i]}`,
      nameEn: `Advent ${i}`,
      date: adventSunday(year, i),
      level: 'SINODE',
    });
  }
  out.push(
    { key: 'MALAM_NATAL', name: 'Malam Natal', nameEn: 'Christmas Eve', date: utcDate(year, 12, 24), level: 'SINODE' },
    { key: 'NATAL', name: 'Natal', nameEn: 'Christmas Day', date: utcDate(year, 12, 25), level: 'SINODE' },
    { key: 'TUTUP_TAHUN', name: 'Ibadah Tutup Tahun', nameEn: 'Year-End Service', date: utcDate(year, 12, 31), level: 'JEMAAT' },
    { key: 'TAHUN_BARU', name: 'Ibadah Tahun Baru', nameEn: 'New Year Service', date: utcDate(year, 1, 1), level: 'JEMAAT' },
  );
  return out;
}

/**
 * Tanggal tetap GMIM dan kategorial BIPRA.
 * HUT Pemuda menempel ke Paskah II karena perayaan sinodalnya dirangkaikan
 * dengan Selebrasi Paskah.
 */
export function gmimFixedDates(year) {
  const easter = easterSunday(year);
  return [
    {
      key: 'PI_MINAHASA',
      name: `HUT Pekabaran Injil dan Pendidikan Kristen di Tanah Minahasa ke-${ordinal(year, GMIM_PI_BASE_YEAR)}`,
      nameEn: `Gospel Proclamation and Christian Education in Minahasa, ${ordinal(year, GMIM_PI_BASE_YEAR)}th`,
      date: utcDate(year, 6, 12),
      level: 'SINODE',
    },
    {
      key: 'GMIM_BERSINODE',
      name: `HUT GMIM Bersinode ke-${ordinal(year, GMIM_SYNOD_BASE_YEAR)}`,
      nameEn: `GMIM Synod Anniversary, ${ordinal(year, GMIM_SYNOD_BASE_YEAR)}th`,
      date: utcDate(year, 9, 30),
      level: 'SINODE',
    },
    {
      key: 'HUT_PEMUDA',
      name: `HUT Pemuda GMIM ke-${ordinal(year, GMIM_YOUTH_BASE_YEAR)}`,
      nameEn: `GMIM Youth Anniversary, ${ordinal(year, GMIM_YOUTH_BASE_YEAR)}th`,
      date: addDays(easter, 1),
      level: 'SINODE',
    },
    {
      key: 'HUT_REMAJA',
      name: `HUT Komisi Pelayanan Remaja Sinode GMIM ke-${ordinal(year, GMIM_TEEN_BASE_YEAR)}`,
      nameEn: `GMIM Teens Commission Anniversary, ${ordinal(year, GMIM_TEEN_BASE_YEAR)}th`,
      date: nthWeekdayOfMonth(year, 1, 3, 4),
      level: 'SINODE',
    },
    {
      key: 'HUT_PKB',
      name: `HUT Pria Kaum Bapa GMIM ke-${ordinal(year, GMIM_PKB_BASE_YEAR)}`,
      nameEn: `GMIM Men's Fellowship Anniversary, ${ordinal(year, GMIM_PKB_BASE_YEAR)}th`,
      date: utcDate(year, 10, 17),
      level: 'SINODE',
    },
  ];
}

/** Agenda khas jemaat GEHC. */
export function jemaatDates(year) {
  return [
    {
      key: 'HUT_JEMAAT',
      name: `HUT Jemaat GMIM Eben Haezer Cikarang ke-${ordinal(year, GEHC_ANNIVERSARY_BASE_YEAR)}`,
      nameEn: `GMIM Eben Haezer Cikarang Anniversary, ${ordinal(year, GEHC_ANNIVERSARY_BASE_YEAR)}th`,
      date: utcDate(year, GEHC_ANNIVERSARY_MONTH, GEHC_ANNIVERSARY_DAY),
      level: 'JEMAAT',
    },
  ];
}

/**
 * Seluruh entri kalender untuk satu tahun, siap ditulis ke church_calendar_entries.
 */
export function churchYearEntries(year) {
  const rows = [
    ...movableFeasts(year).map((e) => ({ ...e, source: 'LITURGICAL' })),
    ...nativityFeasts(year).map((e) => ({ ...e, source: 'LITURGICAL' })),
    ...gmimFixedDates(year).map((e) => ({ ...e, source: 'GMIM_FIXED' })),
    ...jemaatDates(year).map((e) => ({ ...e, source: 'JEMAAT' })),
  ];

  return rows
    .map((e) => ({
      key: e.key,
      name: e.name,
      nameEn: e.nameEn,
      startDate: toISODate(e.date),
      level: e.level,
      source: e.source,
      season: deriveSeason(e.date, year),
      isPublic: true,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Bentrokan tanggal — dua entri atau lebih pada hari yang sama. */
export function findCollisions(entries) {
  const byDate = new Map();
  for (const e of entries) {
    const list = byDate.get(e.startDate) || [];
    list.push(e);
    byDate.set(e.startDate, list);
  }
  return [...byDate.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([date, list]) => ({ date, entries: list }));
}
