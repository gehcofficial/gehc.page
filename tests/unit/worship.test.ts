import { describe, it, expect } from 'vitest';
import { convertSessionPattern, ensureAutoClosed, normalizeConfig, rankTopics } from '../../server/routes/worship.mjs';
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

  it('normalizeConfig meneruskan venueId + capacity per slot', () => {
    const d = normalizeConfig({
      floors: [
        { floor: 1, label: 'Lt 1', venueId: 'wv-1', capacity: 40 },
        { floor: 2, label: 'Teras Kiri', venueId: 'wv-5', capacity: 25 },
        { floor: 3, label: 'Teras Kanan', venueId: 'wv-4', capacity: 20 },
      ],
      rankFloors: [1, 2, 3],
    });
    expect(d.floors[0]).toMatchObject({ floor: 1, venueId: 'wv-1', capacity: 40 });
    expect(d.floors[1]).toMatchObject({ floor: 2, venueId: 'wv-5', capacity: 25 });
    expect(d.rankFloors).toEqual([1, 2, 3]);
  });

  it('normalizeConfig default venue kosong (kompatibel sesi lama)', () => {
    const d = normalizeConfig({ floors: [{ floor: 1, label: 'Lantai 1' }] });
    expect(d.floors[0].venueId).toBeNull();
    expect(d.floors[0].capacity).toBe(0);
  });

  it('normalizeConfig non-Post-to-Post mengosongkan topics/affirmations (POV per pola)', () => {
    const d = normalizeConfig(
      {
        topics: [{ code: 'HUBUNGAN', label: 'Hubungan' }],
        affirmations: { HUBUNGAN: ['a'] },
        floors: [
          { floor: 1, label: 'Lt 1' },
          { floor: 2, label: 'Lt 2' },
          { floor: 3, label: 'Lt 3' },
        ],
      },
      'BEDAH_FILM',
    );
    expect(d.topics).toEqual([]);
    expect(d.affirmations).toEqual({});
    expect(rankTopics({ HUBUNGAN: 9 }, d)).toEqual([]);
  });

  it('normalizeConfig Post-to-Post mempertahankan topics', () => {
    const d = normalizeConfig(
      { topics: [{ code: 'HUBUNGAN', label: 'Hubungan' }] },
      'POST_TO_POST',
    );
    expect(d.topics.map((t) => t.code)).toEqual(['HUBUNGAN']);
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
      { code: 'C', label: 'c', floor: 3, floorLabel: 'L3', capacity: 0, isFull: false, rank: 3, total: 0, count: 0 },
      { code: 'A', label: 'a', floor: 2, floorLabel: 'L2', capacity: 0, isFull: false, rank: 1, total: 0, count: 0 },
      { code: 'B', label: 'b', floor: 1, floorLabel: 'L1', capacity: 0, isFull: false, rank: 2, total: 0, count: 0 },
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

describe('worship: auto-closed', () => {
  const stubPrisma = (captured) => ({
    worshipSession: {
      update: async ({ data }) => {
        captured.push(data);
        return { id: 'ws-1', ...data };
      },
    },
  });

  it('CLOSED otomatis untuk sesi lewat tanggal yang masih berjalan', async () => {
    const captured = [];
    const out = await ensureAutoClosed(stubPrisma(captured), {
      id: 'ws-1',
      status: 'WRAPUP',
      sessionDate: '2026-09-01T00:00:00.000Z',
    });
    expect(captured[0].status).toBe('CLOSED');
    expect(out.status).toBe('CLOSED');
  });

  it('tidak menyentuh DRAFT dan sesi hari ini', async () => {
    const captured = [];
    await ensureAutoClosed(stubPrisma(captured), {
      id: 'ws-1',
      status: 'DRAFT',
      sessionDate: '2026-09-01T00:00:00.000Z',
    });
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString();
    await ensureAutoClosed(stubPrisma(captured), {
      id: 'ws-2',
      status: 'RUNNING',
      sessionDate: today,
    });
    expect(captured).toHaveLength(0);
  });
});

describe('worship: convert-pattern', () => {
  const baseSession = {
    id: 'ws-1',
    slug: 'sesi-2026-10-11',
    status: 'DRAFT',
    config: { timerSeconds: 1500, draft: { film: { 'film-title': 'X' } } },
  };
  const stubPrisma = (over: { full?: boolean; resp?: number } = {}) => ({
    worshipSession: {
      findUnique: async ({ where }) => {
        if (where.id === 'ws-1' || where.slug === 'sesi-2026-10-11') {
          if (over.full) return { ...baseSession, pattern: { code: 'BEDAH_FILM' } };
          return { ...baseSession };
        }
        return null;
      },
      update: async ({ data }) => ({ ...baseSession, ...data }),
    },
    worshipPattern: {
      findUnique: async ({ where }) =>
        where.code === 'MONOLOG' ? { id: 'wp-mono', code: 'MONOLOG' } : null,
    },
    worshipLikertResponse: { count: async () => over.resp ?? 0, deleteMany: async () => ({}) },
    worshipChipVote: { count: async () => 0, deleteMany: async () => ({}) },
    worshipNote: { count: async () => 0 },
    worshipLikertItem: { findMany: async () => [], deleteMany: async () => ({}) },
    worshipChip: { findMany: async () => [], deleteMany: async () => ({}) },
    $transaction: async (ops) => ops,
  });

  it('mengalihkan BEDAH_FILM → MONOLOG, slug tetap, draft dibuang', async () => {
    const out = await convertSessionPattern(stubPrisma({ full: true }), 'sesi-2026-10-11', 'MONOLOG');
    expect(out).toMatchObject({ from: 'BEDAH_FILM', to: 'MONOLOG', slug: 'sesi-2026-10-11' });
  });

  it('menolak sesi non-DRAFT dan pola sama', async () => {
    await expect(convertSessionPattern(stubPrisma({ full: true }), 'nope', 'MONOLOG')).rejects.toMatchObject({ status: 404 });
    const running = stubPrisma({ full: true });
    running.worshipSession.findUnique = async () => ({ ...baseSession, status: 'RUNNING', pattern: { code: 'BEDAH_FILM' } });
    await expect(convertSessionPattern(running, 'ws-1', 'MONOLOG')).rejects.toMatchObject({ status: 409 });
    await expect(convertSessionPattern(stubPrisma({ full: true }), 'ws-1', 'BEDAH_FILM')).rejects.toMatchObject({ status: 400 });
  });

  it('menolak bila sudah ada data peserta', async () => {
    await expect(convertSessionPattern(stubPrisma({ full: true, resp: 3 }), 'ws-1', 'MONOLOG')).rejects.toMatchObject({ status: 409 });
  });

  it('menolak pola tujuan tak dikenal', async () => {
    await expect(convertSessionPattern(stubPrisma({ full: true }), 'ws-1', 'NOPE')).rejects.toMatchObject({ status: 400 });
  });
});
