/**
 * P5 — Kas unit otomatis + ekspor laporan (murni, mudah diuji).
 */

/** Katalog akun kas standar jemaat (idempoten saat pembuatan). */
export const UNIT_ACCOUNTS = [
  { code: 'KAS-JEMAAT', name: 'Kas Jemaat', unit: 'JEMAAT', kind: 'KAS_GEREJA' },
  { code: 'KAS-PEMUDA', name: 'Kas Pemuda', unit: 'PEMUDA', kind: 'KAS_UNIT' },
  { code: 'KAS-REMAJA', name: 'Kas Remaja', unit: 'REMAJA', kind: 'KAS_UNIT' },
  { code: 'KAS-ANAK', name: 'Kas Anak', unit: 'ANAK', kind: 'KAS_UNIT' },
  { code: 'KAS-BAPAK', name: 'Kas Kaum Bapa', unit: 'BAPAK', kind: 'KAS_UNIT' },
  { code: 'KAS-IBU', name: 'Kas Kaum Ibu', unit: 'IBU', kind: 'KAS_UNIT' },
  { code: 'KAS-KOLOM', name: 'Kas Kolom', unit: 'KOLOM', kind: 'KAS_UNIT' },
  { code: 'KAS-KOMUNITAS', name: 'Kas Komunitas', unit: 'KOMUNITAS', kind: 'KAS_UNIT' },
  { code: 'PETTY-BZP', name: 'Petty Cash BZP', unit: 'PEMUDA', kind: 'PETTY_CASH' },
];

export const BZP_PETTY_CODE = 'PETTY-BZP';

/** Escape satu sel CSV (RFC 4180 sederhana). */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Baris CSV dari daftar objek + kolom [{key,label}]. */
export function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = (rows || []).map((r) => columns.map((c) => csvCell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

/** Rentang bulan YYYY-MM → { from, to } (to eksklusif: awal bulan berikutnya). */
export function monthRange(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  const now = new Date();
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const month = m ? Number(m[2]) - 1 : now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1));
  return { from, to, ym: `${year}-${String(month + 1).padStart(2, '0')}` };
}
