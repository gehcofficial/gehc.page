/**
 * Kapan tombol "Daftar Kehadiran" tampil di portal Info Event.
 * Aturan kasar di klien; server tetap menegakkan INTERNAL/staf,
 * ARCHIVED, dan peran aktif (register-auth).
 */

export function canShowPortalRegister(input: {
  registered?: boolean;
  status?: string | null;
  isBaku?: boolean;
}): boolean {
  if (input.registered || input.isBaku) return false;
  const st = String(input.status || '').toUpperCase();
  return st !== 'DONE' && st !== 'ARCHIVED';
}
