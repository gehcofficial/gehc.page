/**
 * Token desain bersama untuk halaman publik.
 * Tujuan: konsistensi lebar kontainer, padding section, dan palet
 * agar semua section landing berbicara dengan bahasa visual yang sama.
 */
export const THEME = {
  bg: '#FAF9F5',
  band: '#F3F1EC',
  surface: '#FFFFFF',
  ink: '#1B1B1B',
  muted: '#8C8880',
  line: '#D9D7D0',
  dark: '#111111',
  darkFooter: '#151515',
  accent: '#FF416C',
  accent2: '#FF4B2B',
} as const;

/** Kontainer standar seluruh section publik. */
export const CONTAINER = 'max-w-[1200px] mx-auto px-4 sm:px-8';

/** Padding vertikal standar antar-section. */
export const SECTION_PAD = 'py-14 sm:py-20';

/** Radius kartu standar. */
export const CARD_RADIUS = 'rounded-[28px]';
