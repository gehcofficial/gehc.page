import { describe, expect, it } from 'vitest';
import { preferSession, sessionOptionLabel } from '../../src/lib/worship-session-select';

const FILM = { id: 's-film', slug: 'sesi-film', eventId: 'ev-1', pattern: { code: 'BEDAH_FILM' } };
const MONO = { id: 's-mono', slug: 'sesi-2026-10-11', eventId: 'ev-1', pattern: { code: 'MONOLOG' } };
const OTHER = { id: 's-lain', slug: 'sesi-lain', eventId: 'ev-2', pattern: { code: 'MONOLOG' } };

describe('preferSession: tidak nyangkut di sesi pola lama', () => {
  it('prev valid dipertahankan', () => {
    expect(preferSession([FILM, MONO], { prevId: 's-film', eventId: 'ev-1', preferPattern: 'MONOLOG' })).toBe('s-film');
  });

  it('preferensi pola pekan menang atas urutan list', () => {
    expect(preferSession([FILM, MONO], { eventId: 'ev-1', preferPattern: 'MONOLOG' })).toBe('s-mono');
    expect(preferSession([MONO, FILM], { eventId: 'ev-1', preferPattern: 'BEDAH_FILM' })).toBe('s-film');
  });

  it('fallback urutan list bila tak ada yang cocok pola', () => {
    expect(preferSession([FILM, MONO], { eventId: 'ev-1', preferPattern: 'DEBAT' })).toBe('s-film');
    expect(preferSession([FILM, MONO], { eventId: 'ev-1' })).toBe('s-film');
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
