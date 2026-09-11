/**
 * Nama event ibadah mingguan dari tema Rencana bulan.
 * Pola: "{prefix}: {Tema} - {DD Mon YYYY}" (ID).
 * Contoh: "Ibadah Pemuda: Hidup Kudus - 06 Sep 2026".
 */

const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

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
