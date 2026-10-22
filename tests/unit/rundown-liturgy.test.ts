import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { patternTotalMinutes } from '../../src/lib/worship-patterns';

const require = createRequire(import.meta.url);
const { PATTERNS } = require('../../server/_seed-worship-patterns.cjs') as {
  PATTERNS: Array<{
    code: string;
    defaultDurationMin: number;
    phases: Array<{
      no?: number | null;
      title?: string;
      minutes?: number;
      division?: string;
      track?: 'main' | 'parallel' | null;
      notes?: string;
      segments?: Array<{ key?: string }>;
    }>;
  }>;
};

const byCode = Object.fromEntries(PATTERNS.map((p) => [p.code, p]));

const LITURGY = ['Persembahan & Doa', 'Lagu & Doa Penutup'] as const;

function titles(code: string) {
  return byCode[code].phases.map((p) => String(p.title || ''));
}

describe('rundown liturgi baku', () => {
  it('Mission Sequence memisahkan firman, commissioning, dan liturgi', () => {
    const p = byCode.THREE_SEQUENCES;
    expect(titles('THREE_SEQUENCES')).toEqual([
      'Praise & Worship',
      'Sesi 1 · Snack & Merge',
      'Sesi 2 · Kode Alkitab',
      'Sesi 3 · Mission Room',
      'Presentasi Kelompok',
      'Konklusi',
      'Penutup Sesi · Commissioning & Deklarasi',
      'Persembahan & Doa',
      'Lagu & Doa Penutup',
    ]);
    expect(p.phases.map((row) => row.minutes)).toEqual([10, 10, 15, 30, 20, 10, 10, 10, 5]);
    expect(p.defaultDurationMin).toBe(120);
    expect(patternTotalMinutes(p.phases)).toBe(120);
    const close = p.phases.find((row) => row.title === 'Penutup Sesi · Commissioning & Deklarasi');
    expect(close?.division).toBe('DIDASKALIA');
    expect(close?.notes).toMatch(/penumpangan tangan/i);
    expect(close?.notes).toMatch(/Coram Deo/);
    expect(p.phases.find((row) => row.title === 'Konklusi')?.notes).toMatch(/Firman penutup/);
    expect(p.phases.find((row) => row.title === 'Persembahan & Doa')?.notes || '').not.toMatch(/khotbah/i);
    expect(p.phases.find((row) => row.title === 'Sesi 3 · Mission Room')?.notes).toMatch(/5 tim gabungan/);
    const keys = p.phases.flatMap((row) => (row.segments || []).map((s) => s.key));
    expect(keys).toEqual(expect.arrayContaining(['pembuka', 'firman', 'persembahan']));
  });

  it.each(['MONOLOG', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES', 'CREATIVE_LAB'])(
    '%s menutup blok Didaskalia lalu liturgi 10 + 5',
    (code) => {
      const phases = byCode[code].phases;
      const names = phases.map((row) => String(row.title || ''));
      const offer = names.indexOf(LITURGY[0]);
      const song = names.indexOf(LITURGY[1]);
      expect(song).toBe(offer + 1);
      const offerRow = phases[offer];
      const songRow = phases[song];
      expect(offerRow.minutes).toBe(10);
      expect(songRow.minutes).toBe(5);
      expect(offerRow.division).toBe('LITURGIA');
      expect(songRow.division).toBe('LITURGIA');
      const lastDidaskalia = phases.reduce((at, row, i) => (row.division === 'DIDASKALIA' && row.track !== 'parallel' ? i : at), -1);
      expect(lastDidaskalia).toBeGreaterThanOrEqual(0);
      expect(lastDidaskalia).toBeLessThan(offer);
      expect(patternTotalMinutes(phases)).toBe(byCode[code].defaultDurationMin);
    },
  );

  it('Post-to-Post tidak menambah blok persembahan', () => {
    expect(titles('POST_TO_POST')).not.toContain('Persembahan & Doa');
    expect(byCode.POST_TO_POST.defaultDurationMin).toBe(60);
  });

  it('Debat dan Bedah Film tidak menaruh persembahan sebelum konklusi', () => {
    for (const code of ['DEBAT', 'BEDAH_FILM']) {
      const names = titles(code);
      expect(names.indexOf('Konklusi')).toBeLessThan(names.indexOf('Persembahan & Doa'));
    }
    expect(byCode.DEBAT.defaultDurationMin).toBe(145);
    expect(byCode.BEDAH_FILM.defaultDurationMin).toBe(155);
    expect(byCode.MONOLOG.defaultDurationMin).toBe(125);
    expect(byCode.CREATIVE_LAB.defaultDurationMin).toBe(140);
  });
});
