/**
 * Token desain bersama untuk halaman publik.
 * Tujuan: konsistensi lebar kontainer, padding section, dan palet
 * agar semua section landing berbicara dengan bahasa visual yang sama.
 */
/**
 * Design tokens — prefer Tailwind `@theme` utilities (`bg-page`, `text-ink`, `text-brand`).
 * Legacy hex map kept for components not yet migrated.
 */
export const THEME = {
  bg: 'var(--color-page, #FAF9F5)',
  band: '#F3F1EC',
  surface: '#FFFFFF',
  ink: 'var(--color-ink, #1B1B1B)',
  muted: 'var(--color-muted, #8C8880)',
  line: 'var(--color-line, #D9D7D0)',
  dark: '#111111',
  darkFooter: '#151515',
  accent: 'var(--color-brand, #FF416C)',
  accent2: 'var(--color-brand-end, #FF4B2B)',
} as const;

/** Kontainer standar seluruh section publik. */
export const CONTAINER = 'max-w-[1200px] mx-auto px-4 sm:px-8';

/** Padding vertikal standar antar-section. */
export const SECTION_PAD = 'py-14 sm:py-20';

/** Radius kartu standar. */
export const CARD_RADIUS = 'rounded-[28px]';
