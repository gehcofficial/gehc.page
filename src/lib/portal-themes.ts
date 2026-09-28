/**
 * D1 — Tema portal per domain/subdomain.
 *
 * Setiap portal (host) punya identitas warna sendiri. Nilai di-apply sebagai
 * CSS variable (`--color-brand`, `--color-brand-end`, `--color-brand-ink`,
 * `--color-brand-soft`) di `document.documentElement`, sehingga seluruh utility
 * Tailwind `*-brand` dan nilai `var(--color-brand)` mengikuti tema portal.
 *
 * Sumber: default di kode (peta di bawah) + override DB (menyusul D3).
 * Host tak dikenal → tema Pemuda (paritas perilaku lama).
 */

import { resolvePortalId, type PortalId } from './portal-profiles';

export type PortalTheme = {
  brand: string;
  brandEnd: string;
  /** Warna teks/ikon di atas latar `brand`. */
  brandInk: string;
  /** Logo portal (opsional; fallback logo GEHC). */
  logo?: string;
};

/** Palet per portal (selaras dengan aksen kartu unit di hub). */
export const PORTAL_THEMES: Record<PortalId, PortalTheme> = {
  jemaat: { brand: '#8A6A1F', brandEnd: '#C8A24A', brandInk: '#FFFFFF' },
  youth: { brand: '#FF416C', brandEnd: '#FF4B2B', brandInk: '#FFFFFF' },
  men: { brand: '#0EA5E9', brandEnd: '#1D4ED8', brandInk: '#FFFFFF' },
  women: { brand: '#EC4899', brandEnd: '#8B5CF6', brandInk: '#FFFFFF' },
  teen: { brand: '#7C3AED', brandEnd: '#DB2777', brandInk: '#FFFFFF' },
  kids: { brand: '#F59E0B', brandEnd: '#EF4444', brandInk: '#FFFFFF' },
  kolom: { brand: '#10B981', brandEnd: '#047857', brandInk: '#FFFFFF' },
  community: { brand: '#6366F1', brandEnd: '#0EA5E9', brandInk: '#FFFFFF' },
};

export function themeForPortal(id: PortalId): PortalTheme {
  return PORTAL_THEMES[id] || PORTAL_THEMES.youth;
}

/** Tema efektif untuk host (+ override `?portal=` non-produksi) & override DB opsional. */
export function resolvePortalTheme(
  host: string,
  search = '',
  override?: Partial<PortalTheme> | null,
): PortalTheme {
  const base = themeForPortal(resolvePortalId(host, search));
  if (!override) return base;
  return {
    brand: override.brand || base.brand,
    brandEnd: override.brandEnd || base.brandEnd,
    brandInk: override.brandInk || base.brandInk,
    logo: override.logo || base.logo,
  };
}

/** Set CSS variable tema pada root element (default `document.documentElement`). */
export function applyPortalTheme(theme: PortalTheme, root?: HTMLElement | null): void {
  const el = root || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el) return;
  el.style.setProperty('--color-brand', theme.brand);
  el.style.setProperty('--color-brand-end', theme.brandEnd);
  el.style.setProperty('--color-brand-ink', theme.brandInk);
  el.style.setProperty('--color-brand-soft', `color-mix(in oklab, ${theme.brand} 12%, white)`);
}

/** Terapkan tema untuk host saat ini (dipanggil sekali di root aplikasi). */
export function applyThemeForHost(host: string, search = ''): PortalTheme {
  const theme = resolvePortalTheme(host, search);
  applyPortalTheme(theme);
  return theme;
}

