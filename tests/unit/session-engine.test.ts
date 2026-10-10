import { describe, expect, it } from 'vitest';
import {
  canOpenSegmentPattern,
  isQuestionOpen,
  MERGED_PATTERN_ALIAS,
  MONOLOG_QUESTION_KEYS,
  noteSlotsFor,
  PATTERN_SEGMENTS,
  resolvePatternCode,
  segmentForPattern,
  sessionModuleLabel,
  widgetsFor,
} from '../../src/lib/session-engine';
import { classifyPoolRole, composePicks, mergeManualPicks, TESTIMONY_NEED_MONOLOG, TESTIMONY_TOTAL } from '../../server/lib/testimony.mjs';
import { cleanFgd, cleanPhase, cleanRounds, cleanScreening, cleanSong, cleanTeams, MONOLOG_PHASE_SECONDS, ROUND_PHASE_LABEL } from '../../server/lib/session-stage.mjs';

describe('session-engine: registry segmen', () => {
  it('pola non-post-to-post punya 3+ segmen (MONOLOG berakhir di penutup)', () => {
    for (const [code, segs] of Object.entries(PATTERN_SEGMENTS)) {
      expect(code).not.toBe('POST_TO_POST');
      expect(segs.length).toBeGreaterThanOrEqual(3);
      expect(segs[segs.length - 1].id).toBe(code === 'MONOLOG' ? 'penutup' : 'komitmen');
    }
  });

  it('MONOLOG maju mengikuti status + fase (F1 20/F2 25/F3 10/Closing 5)', () => {
    expect(segmentForPattern('MONOLOG', 'DRAFT', false)).toBe('sambutan');
    expect(segmentForPattern('MONOLOG', 'RUNNING', false)).toBe('lagu');
    expect(segmentForPattern('MONOLOG', 'RUNNING', true)).toBe('lagu');
    expect(segmentForPattern('MONOLOG', 'RUNNING', false, { phaseName: 'F1' })).toBe('lagu');
    expect(segmentForPattern('MONOLOG', 'RUNNING', false, { phaseName: 'F2' })).toBe('catatan');
    expect(segmentForPattern('MONOLOG', 'RUNNING', true, { phaseName: 'F2' })).toBe('catatan');
    expect(segmentForPattern('MONOLOG', 'WRAPUP', false)).toBe('satu-kata');
    expect(segmentForPattern('MONOLOG', 'WRAPUP', false, { phaseName: 'F3' })).toBe('satu-kata');
    expect(segmentForPattern('MONOLOG', 'WRAPUP', false, { phaseName: 'CLOSING' })).toBe('penutup');
    expect(segmentForPattern('MONOLOG', 'CLOSED', false)).toBe('penutup');
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
    expect(canOpenSegmentPattern('MONOLOG', 'sambutan', 'DRAFT', false)).toBe(true);
    expect(canOpenSegmentPattern('MONOLOG', 'penutup', 'RUNNING', false)).toBe(false);
    expect(canOpenSegmentPattern('MONOLOG', 'catatan', 'RUNNING', false)).toBe(false);
    expect(canOpenSegmentPattern('MONOLOG', 'catatan', 'RUNNING', false, { phaseName: 'F2' })).toBe(true);
    expect(canOpenSegmentPattern('MONOLOG', 'satu-kata', 'WRAPUP', false)).toBe(true);
    expect(canOpenSegmentPattern('MONOLOG', 'penutup', 'WRAPUP', false, { phaseName: 'CLOSING' })).toBe(true);
    expect(canOpenSegmentPattern('MONOLOG', 'penutup', 'WRAPUP', false, { phaseName: 'F3' })).toBe(false);
    expect(canOpenSegmentPattern('DEBAT', 'catatan', 'DRAFT', false)).toBe(false);
  });

  it('slot catatan selalu diakhiri KOMITMEN', () => {
    for (const code of ['MONOLOG', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES']) {
      const slots = noteSlotsFor(code);
      expect(slots.length).toBeGreaterThan(1);
      expect(slots[slots.length - 1].key).toBe('KOMITMEN');
    }
  });

  it('DUAL_MONOLOG dilebur ke MONOLOG (alias + slot gabungan)', () => {
    expect(MERGED_PATTERN_ALIAS.DUAL_MONOLOG).toBe('MONOLOG');
    expect(resolvePatternCode('DUAL_MONOLOG')).toBe('MONOLOG');
    expect(resolvePatternCode('MONOLOG')).toBe('MONOLOG');
    const slots = noteSlotsFor('DUAL_MONOLOG').map((s) => s.key);
    expect(slots).toEqual(noteSlotsFor('MONOLOG').map((s) => s.key));
    expect(slots).not.toContain('SATU-KATA');
    expect(slots).toContain('DEEP-Q1');
    expect(segmentForPattern('DUAL_MONOLOG', 'RUNNING', false)).toBe(segmentForPattern('MONOLOG', 'RUNNING', false));
  });

  it('MONOLOG gabungan 5 segmen: sambutan + lagu + diskusi + lesson + penutup', () => {
    expect(PATTERN_SEGMENTS.MONOLOG.map((s) => s.id)).toEqual(['sambutan', 'lagu', 'catatan', 'satu-kata', 'penutup']);
    expect(PATTERN_SEGMENTS.MONOLOG[0].label).toBe('Sambutan');
    expect(widgetsFor('MONOLOG', 'sambutan')).toEqual(['welcome']);
    expect(PATTERN_SEGMENTS.MONOLOG[3].label).toBe('Lesson Learned');
    expect(PATTERN_SEGMENTS.MONOLOG[4].label).toBe('Penutup');
    expect(widgetsFor('MONOLOG', 'penutup')).toEqual(['testimony', 'notes', 'download']);
    expect(widgetsFor('MONOLOG', 'lagu')).toContain('song');
    expect(widgetsFor('MONOLOG', 'lagu')).toContain('notes');
    expect(widgetsFor('MONOLOG', 'satu-kata')).toContain('chips');
    expect(widgetsFor('MONOLOG', 'satu-kata')).toContain('testimony');
    expect(widgetsFor('MONOLOG', 'satu-kata')).not.toContain('notes');
    expect(MONOLOG_QUESTION_KEYS).toEqual(['FGD-OBSERVE', 'FGD-INTERPRET', 'FGD-APPLY', 'DEEP-Q1', 'DEEP-Q2']);
  });

  it('trigger Q: hanya Q <= currentQ yang terbuka', () => {
    expect(isQuestionOpen(1, 0)).toBe(false);
    expect(isQuestionOpen(1, 1)).toBe(true);
    expect(isQuestionOpen(3, 2)).toBe(false);
    expect(isQuestionOpen(5, 5)).toBe(true);
  });

  it('cleanFgd + cleanSong validasi stage', () => {
    expect(cleanFgd({ currentQ: 3, triggerBy: 'mentor', triggerName: 'Kak A' })).toEqual({ currentQ: 3, triggerBy: 'MENTOR', triggerName: 'Kak A' });
    expect(cleanFgd({ currentQ: 9 })).toEqual({ currentQ: 5, triggerBy: null, triggerName: null });
    expect(cleanFgd(null)).toBeNull();
    expect(cleanFgd({ currentQ: 1, triggerBy: 'PANITIA' })?.triggerBy).toBeNull();
    expect(cleanSong({ title: 'Lagu', about: 'Makna', singer: 'Band' })).toEqual({ title: 'Lagu', about: 'Makna', singer: 'Band' });
    expect(cleanSong({})).toBeNull();
    expect(cleanSong(null)).toBeNull();
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

  it('MONOLOG: 3 acak bebas + groupName diteruskan', () => {
    const poolWithGroups = pool.map((p, i) => ({ ...p, groupName: i % 2 ? 'Agape' : null }));
    const picks = composePicks(poolWithGroups, [], TESTIMONY_NEED_MONOLOG, () => 0);
    expect(picks).toHaveLength(3);
    expect(picks.map((p) => p.slot)).toEqual([1, 2, 3]);
    expect(picks.filter((p) => p.groupName === 'Agape')).toHaveLength(1);
    expect(new Set(picks.map((p) => p.userId)).size).toBe(3);
  });

  it('manual: tanpa duplikat, slot berlanjut, grup terbawa', () => {
    const existing = [
      { userId: 'm1', name: 'Mentor A', role: 'MENTOR', groupName: 'Agape', slot: 1 },
      { userId: 'e1', name: 'Mentee 1', role: 'MENTEE', groupName: null, slot: 2 },
    ];
    const fresh = mergeManualPicks(existing, [
      { userId: 'e1', name: 'Mentee 1', roles: ['MENTEE'] },
      { userId: 'c1', name: 'Co A', roles: ['CO_MENTOR'], groupName: 'Shalom' },
      { userId: 'x1', name: 'Tamu', roles: ['ALUMNI'] },
    ]);
    expect(fresh.map((p) => p.userId)).toEqual(['c1', 'x1']);
    expect(fresh.map((p) => p.slot)).toEqual([3, 4]);
    expect(fresh[0]).toMatchObject({ name: 'Co A', role: 'CO_MENTOR', groupName: 'Shalom' });
    expect(fresh[1]).toMatchObject({ role: 'OTHER', groupName: null });
    expect(mergeManualPicks([], [])).toEqual([]);
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

  it('phase: nama valid F1/F2/F3/CLOSING + durasi baku 20/25/10/5', () => {
    expect(MONOLOG_PHASE_SECONDS).toEqual({ F1: 1200, F2: 1500, F3: 600, CLOSING: 300 });
    expect(cleanPhase(null)).toBeNull();
    expect(cleanPhase({})).toBeNull();
    expect(cleanPhase({ name: 'ngawur', startedAt: 'x' })).toBeNull();
    expect(cleanPhase({ name: 'F2' })).toBeNull();
    expect(cleanPhase({ name: 'f2', startedAt: '2026-10-11T09:00:00.000Z' })).toEqual({
      name: 'F2',
      startedAt: '2026-10-11T09:00:00.000Z',
      durationSec: 1500,
    });
    expect(cleanPhase({ name: 'F1', startedAt: 'x', durationSec: 5 })).toMatchObject({ durationSec: 60 });
    expect(cleanPhase({ name: 'F3', startedAt: 'x', durationSec: 99999 })).toMatchObject({ durationSec: 7200 });
  });
});
