/**
 * Visibilitas daftar event (dipakai GET /api/events).
 *
 * Prinsip: KEBERADAAN event ≠ AKSES panel divisi.
 * - Staf (SUPERADMIN/KOMISI/COMMITTEE BOD) → semua event ('full').
 * - Pengguna dengan peran portal valid → semua event tidak-arsip terlihat ('open';
 *   'division' bila divisinya cocok — hanya penanda, bukan penyaring).
 * - Tanpa peran portal (atau anon) → daftar kosong ('none').
 *
 * Panel per-divisi (folder Drive, diskusi, kelola) TETAP dijaga gate-nya
 * masing-masing (requireDivision / canSeeEventDivision / 403 drive).
 */

export const PORTAL_ROLES = [
  'SUPERADMIN',
  'BPMJ',
  'KOMISI',
  'COMMITTEE',
  'MENTOR',
  'CO_MENTOR',
  'MENTEE',
  'ALUMNI',
];

/** True bila salah satu role adalah peran portal valid. */
export function hasPortalRole(roles) {
  const list = Array.isArray(roles) ? roles : [];
  return list.some((r) => PORTAL_ROLES.includes(String(r?.role || r || '').toUpperCase()));
}

/**
 * Akses daftar untuk non-staf (murni, tanpa DB — bisa di-unit-test).
 * Status arsip TIDAK disaring di sini (perilaku lama dipertahankan;
 * klien sudah menyembunyikan ARCHIVED dari penjelajah tanggal).
 * @returns 'division' | 'open' | 'none'
 */
export function memberListAccess({ roles, divisionMatch }) {
  if (!hasPortalRole(roles)) return 'none';
  return divisionMatch ? 'division' : 'open';
}

/** Samakan format divisi sebelum dibandingkan (trim + uppercase). */
export function sameDivision(a, b) {
  const x = String(a || '').trim().toUpperCase();
  const y = String(b || '').trim().toUpperCase();
  return Boolean(x && y && x === y);
}
