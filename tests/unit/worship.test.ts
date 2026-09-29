import { describe, it, expect } from 'vitest';
import { normalizeConfig, rankTopics } from '../../server/routes/worship.mjs';
import { fmtClock, parseMentoringHash, isMentoringHash } from '../../src/lib/mentoring';

const CONFIG = normalizeConfig({
  timerSeconds: 1200,
  rankFloors: [2, 1, 3],
  topics: [
    { code: 'HUBUNGAN', label: 'Hubungan' },
    { code: 'PEKERJAAN', label: 'Pekerjaan' },
    { code: 'KELUARGA', label: 'Keluarga' },
  ],
  chipLimit: 3,
});

describe('worship: config & ranking', () => {
  it('normalizeConfig mengisi default aman', () => {
    const d = normalizeConfig(null);
    expect(d.timerSeconds).toBe(1200);
    expect(d.rankFloors).toEqual([2, 1, 3]);
    expect(d.chipLimit).toBe(3);
    expect(d.floors).toHaveLength(3);
  });

  it('rankTopics: kerentanan tertinggi lebih dulu', () => {
    expect(rankTopics({ HUBUNGAN: 3, PEKERJAAN: 9, KELUARGA: 6 }, CONFIG)).toEqual([
      'PEKERJAAN',
      'KELUARGA',
      'HUBUNGAN',
    ]);
  });

  it('rankTopics: seri mengikuti urutan topik di config', () => {
    expect(rankTopics({ HUBUNGAN: 9, PEKERJAAN: 9, KELUARGA: 9 }, CONFIG)).toEqual([
      'HUBUNGAN',
      'PEKERJAAN',
      'KELUARGA',
    ]);
  });
});

describe('mentoring: routing & format', () => {
  it('mengenali hash mentoring + view', () => {
    expect(isMentoringHash('#/mentoring/x')).toBe(true);
    expect(isMentoringHash('#/portal/x')).toBe(false);
    expect(parseMentoringHash('#/mentoring/mentoring-2026-10-04')).toEqual({
      slug: 'mentoring-2026-10-04',
      view: 'peserta',
    });
    expect(parseMentoringHash('#/mentoring/mentoring-2026-10-04/layar')?.view).toBe('layar');
    expect(parseMentoringHash('#/mentoring/mentoring-2026-10-04/kontrol')?.view).toBe('kontrol');
    expect(parseMentoringHash('#/voting')).toBeNull();
  });

  it('fmtClock menit:detik', () => {
    expect(fmtClock(1200)).toBe('20:00');
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(-5)).toBe('00:00');
  });
});
