import { describe, expect, it } from 'vitest';
import { effectiveSessionDay, sessionSlugStem, wibDayKey } from '../../src/lib/effective-date';

describe('wibDayKey: hari kalender WIB', () => {
  it('instant 02:00Z (09:00 WIB) tetap hari yang sama', () => {
    expect(wibDayKey('2026-10-17T02:00:00.000Z')).toBe('2026-10-17');
  });
  it('tengah malam lewat WIB tidak meleset (00:30 WIB = hari itu)', () => {
    expect(wibDayKey('2026-10-16T17:30:00.000Z')).toBe('2026-10-17');
  });
  it('null/invalid → null', () => {
    expect(wibDayKey(null)).toBeNull();
    expect(wibDayKey('bukan-tanggal')).toBeNull();
  });
});

describe('effectiveSessionDay: event dulu, pekan fallback', () => {
  it('ikut tanggal event (geser 18 → 17)', () => {
    expect(effectiveSessionDay('2026-10-17T02:00:00.000Z', '2026-10-18', '2026-10')).toBe('2026-10-17');
  });
  it('tanpa event → tanggal pekan', () => {
    expect(effectiveSessionDay(null, '2026-10-18', '2026-10')).toBe('2026-10-18');
  });
  it('tanpa keduanya → ym', () => {
    expect(effectiveSessionDay(null, null, '2026-10')).toBe('2026-10');
  });
});

describe('sessionSlugStem', () => {
  it('Monolog tanpa suffix pola', () => {
    expect(sessionSlugStem('2026-10-17', 'MONOLOG')).toBe('sesi-2026-10-17');
  });
  it('non-Monolog dengan suffix pola kecil-strip', () => {
    expect(sessionSlugStem('2026-10-17', 'BEDAH_FILM')).toBe('sesi-2026-10-17-bedah-film');
    expect(sessionSlugStem('2026-10-17', 'POST_TO_POST')).toBe('sesi-2026-10-17-post-to-post');
  });
});
