import { describe, expect, it } from 'vitest';
import {
  canOpenSegmentPattern,
  noteSlotsFor,
  PATTERN_SEGMENTS,
  segmentForPattern,
  sessionModuleLabel,
  widgetsFor,
} from '../../src/lib/session-engine';
import { classifyPoolRole, composePicks, TESTIMONY_TOTAL } from '../../server/lib/testimony.mjs';
import { cleanRounds, cleanScreening, cleanTeams, ROUND_PHASE_LABEL } from '../../server/lib/session-stage.mjs';

describe('session-engine: registry segmen', () => {
  it('5 pola non-post-to-post punya 3-4 segmen + komitmen terakhir', () => {
    for (const [code, segs] of Object.entries(PATTERN_SEGMENTS)) {
      expect(code).not.toBe('POST_TO_POST');
      expect(segs.length).toBeGreaterThanOrEqual(3);
      expect(segs[segs.length - 1].id).toBe('komitmen');
    }
  });

  it('MONOLOG maju mengikuti status', () => {
    expect(segmentForPattern('MONOLOG', 'DRAFT', false)).toBe('panduan');
    expect(segmentForPattern('MONOLOG', 'RUNNING', false)).toBe('catatan');
    expect(segmentForPattern('MONOLOG', 'RUNNING', true)).toBe('komitmen');
    expect(segmentForPattern('MONOLOG', 'WRAPUP', false)).toBe('komitmen');
    expect(segmentForPattern('MONOLOG', 'CLOSED', false)).toBe('komitmen');
  });

  it('BEDAH_FILM berakhir di komitmen', () => {
    expect(segmentForPattern('BEDAH_FILM', 'WRAPUP', false)).toBe('komitmen');
    expect(segmentForPattern('BEDAH_FILM', 'LIKERT_OPEN', false)).toBe('nonton');
  });

  it('POST_TO_POST mendelegasikan ke alur lama', () => {
    expect(segmentForPattern('POST_TO_POST', 'RUNNING', true)).toBe('kunjungan');
    expect(segmentForPattern('POST_TO_POST', 'WRAPUP', true)).toBe('lesson');
  });

  it('gerbang monoton maju', () => {
    expect(canOpenSegmentPattern('MONOLOG', 'panduan', 'DRAFT', false)).toBe(true);
    expect(canOpenSegmentPattern('MONOLOG', 'komitmen', 'RUNNING', false)).toBe(false);
    expect(canOpenSegmentPattern('MONOLOG', 'komitmen', 'RUNNING', true)).toBe(true);
    expect(canOpenSegmentPattern('DEBAT', 'catatan', 'DRAFT', false)).toBe(false);
  });

  it('slot catatan selalu diakhiri KOMITMEN', () => {
    for (const code of ['MONOLOG', 'DUAL_MONOLOG', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES']) {
      const slots = noteSlotsFor(code);
      expect(slots.length).toBeGreaterThan(1);
      expect(slots[slots.length - 1].key).toBe('KOMITMEN');
    }
  });

  it('label modul baru dikenal', () => {
    expect(sessionModuleLabel('fgd')).toBe('Panduan FGD');
    expect(sessionModuleLabel('testimony')).toBe('Undian kesaksian');
    expect(sessionModuleLabel('rounds')).toBe('Ronde debat');
    expect(TESTIMONY_TOTAL).toBe(4);
  });
});

describe('testimony: klasifikasi peran', () => {
  it('prioritas MENTOR > CO_MENTOR > MENTEE', () => {
    expect(classifyPoolRole([{ role: 'MENTEE' }, { role: 'MENTOR' }])).toBe('MENTOR');
    expect(classifyPoolRole(['CO_MENTOR', 'MENTEE'])).toBe('CO_MENTOR');
    expect(classifyPoolRole(['MENTEE'])).toBe('MENTEE');
    expect(classifyPoolRole(['ALUMNI'])).toBe('OTHER');
    expect(classifyPoolRole([])).toBe('OTHER');
  });
});

describe('testimony: composePicks', () => {
  const pool = [
    { userId: 'm1', name: 'Mentor A', roles: ['MENTOR'] },
    { userId: 'm2', name: 'Mentor B', roles: ['MENTOR'] },
    { userId: 'c1', name: 'Co A', roles: ['CO_MENTOR'] },
    { userId: 'e1', name: 'Mentee 1', roles: ['MENTEE'] },
    { userId: 'e2', name: 'Mentee 2', roles: ['MENTEE'] },
    { userId: 'e3', name: 'Mentee 3', roles: ['MENTEE'] },
  ];

  it('komposisi baku 2 mentee + 1 mentor + 1 co-mentor', () => {
    const picks = composePicks(pool, [], undefined, () => 0);
    expect(picks).toHaveLength(4);
    expect(picks.filter((p) => p.role === 'MENTEE')).toHaveLength(2);
    expect(picks.filter((p) => p.role === 'MENTOR')).toHaveLength(1);
    expect(picks.filter((p) => p.role === 'CO_MENTOR')).toHaveLength(1);
    expect(picks.map((p) => p.slot)).toEqual([1, 2, 3, 4]);
  });

  it('tanpa pengulangan + dilengkapi dari sisa bila peran kurang', () => {
    const small = [
      { userId: 'e1', name: 'Mentee 1', roles: ['MENTEE'] },
      { userId: 'x1', name: 'Lain', roles: ['ALUMNI'] },
    ];
    const picks = composePicks(small, [], undefined, () => 0);
    expect(picks).toHaveLength(2);
    expect(new Set(picks.map((p) => p.userId)).size).toBe(2);
  });

  it('yang sudah terpilih tidak diundi ulang', () => {
    const picks = composePicks(pool, ['e1', 'e2', 'e3'], undefined, () => 0);
    expect(picks.every((p) => !['e1', 'e2', 'e3'].includes(p.userId))).toBe(true);
  });

  it('pool kosong → kosong', () => {
    expect(composePicks([], [])).toEqual([]);
  });
});

describe('session-engine: widget segmen', () => {
  it('setiap segmen punya widget', () => {
    for (const [code, segs] of Object.entries(PATTERN_SEGMENTS)) {
      for (const s of segs) {
        expect(widgetsFor(code, s.id).length).toBeGreaterThan(0);
      }
    }
  });

  it('film: nonton = screening+notes, kesaksian = testimony', () => {
    expect(widgetsFor('BEDAH_FILM', 'nonton')).toEqual(['screening', 'notes']);
    expect(widgetsFor('BEDAH_FILM', 'kesaksian')).toContain('testimony');
  });

  it('debat memakai rounds; kode asing kosong', () => {
    expect(widgetsFor('DEBAT', 'mosi')).toContain('rounds');
    expect(widgetsFor('X', 'y')).toEqual([]);
  });
});

describe('session-stage: validasi', () => {
  it('rounds: batas 5, fase valid, skor non-negatif', () => {
    const out = cleanRounds({
      rounds: Array.from({ length: 7 }, (_, i) => ({ mosi: `M${i}`, pro: 'A', kontra: 'B', proScore: i, kontraScore: -2 })),
      current: 9,
      phase: 'ngawur',
    });
    expect(out.rounds).toHaveLength(5);
    expect(out.current).toBe(4);
    expect(out.phase).toBe('brief');
    expect(out.rounds[0].kontraScore).toBe(0);
    expect(ROUND_PHASE_LABEL.pro).toBe('Pemaparan PRO');
  });

  it('rounds kosong/null → null', () => {
    expect(cleanRounds(null)).toBeNull();
    expect(cleanRounds({})).toEqual({ rounds: [], current: 0, phase: 'brief' });
  });

  it('screening: judul wajib, durasi dibatasi', () => {
    expect(cleanScreening({})).toBeNull();
    expect(cleanScreening({ title: 'Gavin Stone', durationMin: 500 })).toMatchObject({ title: 'Gavin Stone', durationMin: 180 });
  });

  it('teams: batas 8 tim, tanpa nama dibuang', () => {
    const out = cleanTeams({ teams: [{ name: 'Soal', members: ['A'] }, { name: '' }, { name: 'Lapangan' }] });
    expect(out.teams.map((t) => t.name)).toEqual(['Soal', 'Lapangan']);
    expect(cleanTeams(null)).toBeNull();
  });
});
