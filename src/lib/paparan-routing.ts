/**
 * Rute paparan internal pimpinan (#/paparan/<slug>).
 * Murni (tanpa DOM) agar mudah diuji. Slug allowlist — slug di luar
 * daftar ditolak agar URL tebakan tidak membuka halaman.
 */

export type ParsedPaparanHash = {
  slug: string;
  path: string;
};

/** Paparan yang terdaftar. Tambah slug baru di sini + endpoint API + deck. */
export const PAPARAN_SLUGS = ['bpmj-2026-10'] as const;

export type PaparanSlug = (typeof PAPARAN_SLUGS)[number];

/** `#/paparan/...` → parsed (null bila bukan rute paparan terdaftar). */
export function parsePaparanHash(hash: string): ParsedPaparanHash | null {
  const raw = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = raw.split('/').filter(Boolean);
  if (parts[0] !== 'paparan') return null;
  const slug = String(parts[1] || '').toLowerCase();
  if (!(PAPARAN_SLUGS as readonly string[]).includes(slug)) return null;
  return { slug, path: `#/paparan/${slug}` };
}

export function isPaparanHash(hash: string): boolean {
  return parsePaparanHash(hash) !== null;
}

export function paparanHashPath(slug: string): string {
  return `#/paparan/${String(slug || '').toLowerCase()}`;
}
