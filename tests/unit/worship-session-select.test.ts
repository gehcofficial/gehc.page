import { describe, expect, it } from 'vitest';
import { preferSession, sessionOptionLabel } from '../../src/lib/worship-session-select';

const FILM = { id: 's-film', slug: 'sesi-film', eventId: 'ev-1', pattern: { code: 'BEDAH_FILM' } };
const MONO = { id: 's-mono', slug: 'sesi-2026-10-11', eventId: 'ev-1', pattern: { code: 'MONOLOG' } };
const OTHER = { id: 's-lain', slug: 'sesi-lain', eventId: 'ev-2', pattern: { code: 'MONOLOG' } };

describe('preferSession: tidak nyangkut di sesi pola lama', () => {
  it('prev relevan (sama event + sama pola) dipertahankan', () => {
    expect(preferSession([FILM, MONO], { prevId: 's-film', eventId: 'ev-1', preferPattern: 'BEDAH_FILM' })).toBe('s-film');
    expect(preferSession([FILM, MONO], { prevId: 's-mono', eventId: 'ev-1' })).toBe('s-mono');
  });

  it('prev beda pola dialihkan ke sesi event yang cocok pola bila ada', () => {
    expect(preferSession([FILM, MONO], { prevId: 's-film', eventId: 'ev-1', preferPattern: 'MONOLOG' })).toBe('s-mono');
  });

  it('prev beda pola → kosong bila belum ada yang cocok (buat sesi baru pola pekan)', () => {
    expect(preferSession([MONO], { prevId: 's-mono', eventId: 'ev-1', preferPattern: 'BEDAH_FILM' })).toBe('');
  });

  it('prev beda event diabaikan (pindah W2 → W3 tidak bawa sesi lama)', () => {
    const rescueW2 = { id: 's-rescue', slug: 'sesi-2026-10-11-rescue-plan', eventId: 'ev-w2', pattern: { code: 'MONOLOG' } };
    // Event W3 belum punya sesi → kosong (empty-state buat baru), bukan sesi W2.
    expect(preferSession([rescueW2], { prevId: 's-rescue', eventId: 'ev-w3', preferPattern: 'BEDAH_FILM' })).toBe('');
    // Event W3 sudah punya sesi film → pilih yang cocok pola.
    const filmW3 = { id: 's-film-w3', slug: 'sesi-2026-10-17-bedah-film', eventId: 'ev-w3', pattern: { code: 'BEDAH_FILM' } };
    expect(preferSession([rescueW2, filmW3], { prevId: 's-rescue', eventId: 'ev-w3', preferPattern: 'BEDAH_FILM' })).toBe('s-film-w3');
  });

  it('event tanpa sesi tidak comot sesi event lain', () => {
    expect(preferSession([OTHER], { eventId: 'ev-1', preferPattern: 'MONOLOG' })).toBe('');
    expect(preferSession([OTHER], { eventId: 'ev-1' })).toBe('');
  });

  it('preferensi pola pekan menang atas urutan list', () => {
    expect(preferSession([FILM, MONO], { eventId: 'ev-1', preferPattern: 'MONOLOG' })).toBe('s-mono');
    expect(preferSession([MONO, FILM], { eventId: 'ev-1', preferPattern: 'BEDAH_FILM' })).toBe('s-film');
  });

  it('tanpa preferPattern: fallback urutan list; dengan pola: kosong bila tak cocok', () => {
    expect(preferSession([FILM, MONO], { eventId: 'ev-1' })).toBe('s-film');
    expect(preferSession([FILM, MONO], { eventId: 'ev-1', preferPattern: 'DEBAT' })).toBe('');
  });

  it('slug eksplisit menang atas preferensi', () => {
    expect(preferSession([FILM, MONO], { slug: 'sesi-film', eventId: 'ev-1', preferPattern: 'MONOLOG' })).toBe('s-film');
  });

  it('tanpa event: sesi pertama; kosong: string kosong', () => {
    expect(preferSession([OTHER, MONO], {})).toBe('s-lain');
    expect(preferSession([], { eventId: 'ev-1', preferPattern: 'MONOLOG' })).toBe('');
  });

  it('pola dibandingkan case-insensitive', () => {
    expect(preferSession([MONO], { eventId: 'ev-1', preferPattern: 'monolog' })).toBe('s-mono');
  });
});

describe('sessionOptionLabel: pola terlihat di dropdown', () => {
  it('format [POLA] judul — status', () => {
    expect(sessionOptionLabel({ title: 'BEDAH_FILM — Ibadah', status: 'DRAFT', pattern: { code: 'bedah_film' } }, 'Belum dibuka'))
      .toBe('[BEDAH_FILM] BEDAH_FILM — Ibadah — Belum dibuka');
    expect(sessionOptionLabel({ slug: 'sesi-x', status: 'CLOSED' }, 'Arsip'))
      .toBe('sesi-x — Arsip');
  });
});
