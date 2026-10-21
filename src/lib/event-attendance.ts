/** Helper absensi mandiri: tautan, token, dan pesan hasil. */

export type AttendanceResult = 'OK' | 'DUPLICATE' | 'EXPIRED' | 'MISMATCH' | 'CLOSED' | 'RATE_LIMITED' | 'UNKNOWN';

/** Tautan halaman absensi (`#/hadir/<slug>`), opsional membawa token QR. */
export function attendanceHash(slug: string, token?: string | null): string {
  const base = `#/hadir/${encodeURIComponent(slug)}`;
  return token ? `${base}?t=${encodeURIComponent(token)}` : base;
}

/** Ambil `t` (token QR) dari hash halaman. */
export function tokenFromHash(hash: string): string | null {
  const q = hash.indexOf('?');
  if (q < 0) return null;
  const token = new URLSearchParams(hash.slice(q + 1)).get('t');
  return token?.trim() || null;
}

/** Token QR event dari panitia: `GEHC-EV|<eventId>|<slot>|<sig12>`. */
export function isAttendanceToken(raw: string): boolean {
  return /^GEHC-EV\|[^|]+\|\d+\|[A-Za-z0-9_-]{12}$/.test(String(raw || '').trim());
}

/** True bila input pengguna berupa PIN 6 digit (bukan token QR). */
export function isAttendancePin(raw: string): boolean {
  return /^\d{6}$/.test(String(raw || '').trim());
}

export function attendanceResultTitle(result: string): string {
  switch (result) {
    case 'OK': return 'Kehadiran tercatat';
    case 'DUPLICATE': return 'Sudah tercatat hadir';
    case 'EXPIRED': return 'QR kedaluwarsa';
    case 'MISMATCH': return 'QR bukan untuk event ini';
    case 'CLOSED': return 'Absensi belum/sudah ditutup';
    case 'RATE_LIMITED': return 'Terlalu banyak percobaan';
    default: return 'Belum bisa dicatat';
  }
}
