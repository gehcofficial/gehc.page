/**
 * Nama event ibadah mingguan dari tema Rencana bulan.
 * Pola: "{prefix}: {Tema} - {DD Mon YYYY}" (ID).
 * Contoh: "Ibadah Pemuda: Hidup Kudus - 06 Sep 2026".
 */
import { wibDateOnly } from './event-venue.mjs';

const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const isWorshipLike = (e) =>
  ['MENTORING_DAY', 'SERVING_DAY'].includes(String(e?.serviceType || '')) ||
  String(e?.kind || '').toUpperCase() === 'UMUM';

export function formatSundayID(isoDate) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(isoDate || '');
  const dd = m[3];
  const mon = ID_MONTHS[Number(m[2]) - 1] || m[2];
  return `${dd} ${mon} ${m[1]}`;
}

/** Prefix ibadah dari BIPRA/Kolom terpilih. */
export function servicePrefix(bipra, kolom) {
  const k = String(kolom || '').trim();
  if (k) return `Ibadah ${k}`;
  const b = String(bipra || '').trim() || 'Pemuda';
  return `Ibadah ${b}`;
}

export function servicePrefixByType(bipra, kolom, serviceType) {
  const base = servicePrefix(bipra, kolom);
  if (serviceType === 'MENTORING_DAY') return `${base} Mentoring`;
  if (serviceType === 'SERVING_DAY') return `${base} Raya`;
  return base;
}

export function formatServiceName(prefix, theme, sundayISO) {
  const t = String(theme || '').trim();
  if (!t) return '';
  return `${prefix}: ${t} - ${formatSundayID(sundayISO)}`.slice(0, 160);
}

export function formatServiceNameByType(bipra, kolom, serviceType, theme, sundayISO) {
  const prefix = servicePrefixByType(bipra, kolom, serviceType);
  return formatServiceName(prefix, theme, sundayISO);
}

/**
 * Ganti suffix tanggal ID di akhir nama event: " - 18 Okt 2026" → " - 17 Okt 2026".
 * Dipakai geser sistemik agar pill EVENT, landing, dan judul konten ikut tanggal efektif.
 * Hanya suffix yang cocok pola yang diganti; selain itu nama dikembalikan apa adanya.
 */
export function renameServiceDateSuffix(name, toISO) {
  const s = String(name || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(toISO || ''))) return s;
  const next = formatSundayID(toISO);
  // Pola: " - DD Mon YYYY" di akhir (Mon = Jan..Des). Contoh: "Ibadah Pemuda Raya: Tema - 18 Okt 2026"
  if (/ - \d{2} (Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des) \d{4}$/.test(s)) {
    return s.replace(/ - \d{2} (Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des) \d{4}$/, ` - ${next}`);
  }
  return s;
}

/** Instant UTC untuk eventDate (tengah malam UTC di tanggal Minggu itu). */
export function sundayInstant(sundayISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sundayISO || ''))) return null;
  return new Date(`${sundayISO}T00:00:00Z`);
}

/** Instant WIB 09:00 untuk ibadah (09:00 Asia/Jakarta = 02:00Z) — supaya tidak midnight. */
export function sundayWIBInstant(sundayISO, hour = 9) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sundayISO || ''))) return null;
  const h = String(Math.min(23, Math.max(0, Number(hour) || 9))).padStart(2, '0');
  return new Date(`${sundayISO}T${h}:00:00+07:00`);
}

/**
 * Satu event ibadah (SERVING_DAY / MENTORING_DAY / kind UMUM) pada tanggal WIB tsb.
 * Dipakai auto-tautan penatalayan (usulan & jadwal) agar eventId tidak kosong —
 * semantik sama dengan auto-link POST /api/penatalayan/schedules/bulk.
 * Return eventId atau null.
 */
export async function resolveWorshipEventByDate(prisma, dateISO) {
  const iso = String(dateISO || '').slice(0, 10);
  if (!prisma || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const dayStart = new Date(`${iso}T00:00:00.000Z`);
  const rows = await prisma.eventProgram.findMany({
    where: { eventDate: { gte: new Date(dayStart.getTime() - 86400000), lt: new Date(dayStart.getTime() + 2 * 86400000) } },
    select: { id: true, eventDate: true, serviceType: true, kind: true },
    orderBy: { eventDate: 'asc' },
  }).catch(() => []);
  for (const e of Array.isArray(rows) ? rows : []) {
    if (wibDateOnly(e.eventDate) !== iso) continue;
    if (isWorshipLike(e)) return String(e.id);
  }
  return null;
}
