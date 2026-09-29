import { describe, it, expect } from 'vitest';
import { normalizeConfig, rankTopics } from '../../server/routes/worship.mjs';
import {
  canOpenSegment,
  fmtClock,
  isMentoringHash,
  orderedRoute,
  parseMentoringHash,
  segmentFor,
} from '../../src/lib/mentoring';
import { ensureAutoState } from '../../server/routes/worship.mjs';

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

describe('worship: segmen hari-H', () => {
  it('segmentFor mengikuti status + progres', () => {
    expect(segmentFor('DRAFT', false)).toBe('likert');
    expect(segmentFor('LIKERT_OPEN', false)).toBe('likert');
    expect(segmentFor('LIKERT_OPEN', true)).toBe('arah');
    expect(segmentFor('RUNNING', true)).toBe('kunjungan');
    expect(segmentFor('RUNNING', false)).toBe('likert');
    expect(segmentFor('WRAPUP', true)).toBe('lesson');
    expect(segmentFor('CLOSED', true)).toBe('lesson');
  });

  it('canOpenSegment menjaga urutan & kunci', () => {
    expect(canOpenSegment('likert', 'DRAFT', false)).toBe(true);
    expect(canOpenSegment('arah', 'LIKERT_OPEN', false)).toBe(false);
    expect(canOpenSegment('arah', 'LIKERT_OPEN', true)).toBe(true);
    expect(canOpenSegment('kunjungan', 'LIKERT_OPEN', true)).toBe(false);
    expect(canOpenSegment('kunjungan', 'RUNNING', true)).toBe(true);
    expect(canOpenSegment('lesson', 'RUNNING', true)).toBe(false);
    expect(canOpenSegment('lesson', 'WRAPUP', true)).toBe(true);
  });

  it('orderedRoute mengurutkan sesuai rank', () => {
    const rooms = [
      { code: 'C', label: 'c', floor: 3, floorLabel: 'L3', rank: 3, total: 0, count: 0 },
      { code: 'A', label: 'a', floor: 2, floorLabel: 'L2', rank: 1, total: 0, count: 0 },
      { code: 'B', label: 'b', floor: 1, floorLabel: 'L1', rank: 2, total: 0, count: 0 },
    ];
    expect(orderedRoute(rooms).map((r) => r.code)).toEqual(['A', 'B', 'C']);
  });
});

describe('worship: auto-wrapup', () => {
  const stubPrisma = (captured) => ({
    worshipSession: {
      update: async ({ data }) => {
        captured.push(data);
        return { id: 'ws-1', ...data };
      },
    },
  });

  it('belum mengubah status bila waktu belum habis', async () => {
    const captured = [];
    const session = {
      id: 'ws-1',
      status: 'RUNNING',
      startedAt: new Date(),
      config: { timerSeconds: 1200 },
    };
    await ensureAutoState(stubPrisma(captured), session);
    expect(captured).toHaveLength(0);
  });

  it('mengubah ke WRAPUP saat waktu sesi habis', async () => {
    const captured = [];
    const session = {
      id: 'ws-1',
      status: 'RUNNING',
      startedAt: new Date(Date.now() - 21 * 60 * 1000),
      config: { timerSeconds: 1200 },
    };
    const out = await ensureAutoState(stubPrisma(captured), session);
    expect(captured[0].status).toBe('WRAPUP');
    expect(out.status).toBe('WRAPUP');
  });

  it('tidak menyentuh sesi yang belum berjalan', async () => {
    const captured = [];
    await ensureAutoState(stubPrisma(captured), { id: 'x', status: 'LIKERT_OPEN', config: {} });
    expect(captured).toHaveLength(0);
  });
});
