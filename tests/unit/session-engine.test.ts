import { describe, expect, it } from 'vitest';
import {
  canOpenSegmentPattern,
  filmLikertMeans,
  filmLikertPairs,
  isQuestionOpen,
  mergeFilmVals,
  MERGED_PATTERN_ALIAS,
  MONOLOG_QUESTION_KEYS,
  noteSlotsFor,
  PATTERN_SEGMENTS,
  resolvePatternCode,
  resolvePinnedSegment,
  segmentForPattern,
  sessionModuleLabel,
  widgetsFor,
} from '../../src/lib/session-engine';
import { applyFilmCap, classifyPoolRole, composePicks, mergeManualPicks, TESTIMONY_FILM_CAP, TESTIMONY_NEED_FILM, TESTIMONY_NEED_MONOLOG, TESTIMONY_TOTAL } from '../../server/lib/testimony.mjs';
import { cleanFgd, cleanLikertRounds, cleanPhase, cleanPhasePrefs, cleanRounds, cleanScreening, cleanSong, cleanTeams, FILM_PHASE_SECONDS, MONOLOG_PHASE_SECONDS, ROUND_PHASE_LABEL } from '../../server/lib/session-stage.mjs';

describe('session-engine: registry segmen', () => {
  it('pola non-post-to-post punya 3+ segmen (MONOLOG berakhir di penutup)', () => {
    for (const [code, segs] of Object.entries(PATTERN_SEGMENTS)) {
      expect(code).not.toBe('POST_TO_POST');
      expect(segs.length).toBeGreaterThanOrEqual(3);
      const last = code === 'MONOLOG' ? 'penutup' : code === 'BEDAH_FILM' ? 'kesaksian' : code === 'CREATIVE_LAB' ? 'penutup' : 'komitmen';
      expect(segs[segs.length - 1].id).toBe(last);
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

  it('BEDAH_FILM: likert-awal → nonton → likert-akhir (+Lesson Learned) → lesson-learned → kesaksian', () => {
    expect(segmentForPattern('BEDAH_FILM', 'DRAFT', false)).toBe('likert-awal');
    expect(segmentForPattern('BEDAH_FILM', 'LIKERT_OPEN', false)).toBe('likert-awal');
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false)).toBe('likert-awal');
    // Peserta telat: gate AWAL sudah dikunci (M1) → lanjut nonton, tak terkunci.
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false, undefined, { preAnswered: false, preOpen: false })).toBe('nonton');
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false, undefined, { preAnswered: false, preOpen: true })).toBe('likert-awal');
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false, undefined, { preAnswered: true, screeningOn: true })).toBe('nonton');
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false, undefined, { preAnswered: true })).toBe('nonton');
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false, undefined, { preAnswered: true, postOpen: true })).toBe('likert-akhir');
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false, undefined, { preAnswered: true, postOpen: true, postAnswered: true })).toBe('lesson-learned');
    expect(segmentForPattern('BEDAH_FILM', 'RUNNING', false, undefined, { preAnswered: true, postOpen: true, postAnswered: true, chipDone: true })).toBe('kesaksian');
    expect(segmentForPattern('BEDAH_FILM', 'WRAPUP', false)).toBe('lesson-learned');
    expect(segmentForPattern('BEDAH_FILM', 'WRAPUP', true, undefined, { chipDone: true })).toBe('kesaksian');
    expect(segmentForPattern('BEDAH_FILM', 'CLOSED', false)).toBe('kesaksian');
  });

  it('BEDAH_FILM: widget likert/chips/testimony per segmen', () => {
    expect(PATTERN_SEGMENTS.BEDAH_FILM.map((s) => s.id)).toEqual(['likert-awal', 'nonton', 'likert-akhir', 'lesson-learned', 'kesaksian']);
    expect(widgetsFor('BEDAH_FILM', 'likert-awal')).toEqual(['likert']);
    expect(widgetsFor('BEDAH_FILM', 'nonton')).toEqual(['screening', 'notes']);
    expect(widgetsFor('BEDAH_FILM', 'likert-akhir')).toEqual(['likert', 'chips']);
    expect(widgetsFor('BEDAH_FILM', 'lesson-learned')).toEqual(['chips', 'notes', 'download']);
    expect(widgetsFor('BEDAH_FILM', 'kesaksian')).toEqual(['testimony', 'download']);
  });

  it('CREATIVE_LAB: segmen mengikuti fase A1 → A2 → PRESENT → DONE', () => {
    expect(PATTERN_SEGMENTS.CREATIVE_LAB.map((s) => s.id)).toEqual([
      'pembuka', 'briefing', 'aktivitas-1', 'aktivitas-2', 'presentasi', 'refleksi', 'penutup',
    ]);
    expect(segmentForPattern('CREATIVE_LAB', 'DRAFT', false)).toBe('pembuka');
    expect(segmentForPattern('CREATIVE_LAB', 'RUNNING', false, undefined, { activityPhase: 'IDLE' })).toBe('briefing');
    expect(segmentForPattern('CREATIVE_LAB', 'RUNNING', false, undefined, { activityPhase: 'A1' })).toBe('aktivitas-1');
    expect(segmentForPattern('CREATIVE_LAB', 'RUNNING', false, undefined, { activityPhase: 'A2' })).toBe('aktivitas-2');
    expect(segmentForPattern('CREATIVE_LAB', 'RUNNING', false, undefined, { activityPhase: 'PRESENT' })).toBe('presentasi');
    expect(segmentForPattern('CREATIVE_LAB', 'RUNNING', false, undefined, { activityPhase: 'DONE' })).toBe('refleksi');
    expect(segmentForPattern('CREATIVE_LAB', 'WRAPUP', false)).toBe('refleksi');
    expect(segmentForPattern('CREATIVE_LAB', 'CLOSED', false)).toBe('penutup');
    expect(widgetsFor('CREATIVE_LAB', 'aktivitas-1')).toEqual(['activity', 'jar', 'teams']);
    expect(widgetsFor('CREATIVE_LAB', 'aktivitas-2')).toEqual(['activity', 'lab', 'teams']);
    expect(widgetsFor('CREATIVE_LAB', 'refleksi')).toEqual(['chips', 'notes', 'download']);
  });

  it('filmLikertPairs memasangkan PRE/POST + delta per peserta', () => {
    const items = [
      { id: 'a1', topicCode: 'FILM_PRE', text: 'Saya berani otentik' },
      { id: 'a2', topicCode: 'FILM_PRE', text: 'Saya pakai topeng' },
      { id: 'b1', topicCode: 'FILM_POST', text: 'Saya berani otentik' },
      { id: 'b2', topicCode: 'FILM_POST', text: 'Saya pakai topeng' },
    ];
    const pairs = filmLikertPairs(items, { a1: 2, a2: 4, b1: 4 });
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ n: 1, pre: 2, post: 4, delta: 2 });
    expect(pairs[1]).toMatchObject({ n: 2, pre: 4, post: null, delta: null });
    const means = filmLikertMeans(pairs, { a1: { avg: 2.5, n: 4 }, b1: { avg: 4, n: 3 } });
    expect(means[0]).toMatchObject({ n: 1, preAvg: 2.5, preN: 4, postAvg: 4, postN: 3, delta: 1.5 });
    expect(means[1].delta).toBeNull();
  });

  it('mergeFilmVals: polling tidak menghapus pilihan lokal yang belum dikirim', () => {
    const pairs = filmLikertPairs(
      [
        { id: 'a1', topicCode: 'FILM_PRE', text: 'P1' },
        { id: 'a2', topicCode: 'FILM_PRE', text: 'P2' },
        { id: 'b1', topicCode: 'FILM_POST', text: 'P1' },
        { id: 'b2', topicCode: 'FILM_POST', text: 'P2' },
      ],
      {},
    );
    // 3 pilihan lokal (belum submit) vs payload server kosong → tetap utuh.
    const local = { a1: 2, a2: 5 };
    const afterPoll = mergeFilmVals(local, pairs, 'PRE', {});
    expect(afterPoll).toEqual({ a1: 2, a2: 5 });
    expect(afterPoll).toBe(local); // referensi stabil → tanpa re-render sia-sia
    // Jawaban tersimpan server ikut termuat saat init.
    expect(mergeFilmVals({}, pairs, 'PRE', { a1: 4, a2: 1 })).toEqual({ a1: 4, a2: 1 });
    // Lokal menang atas server untuk id yang sama (belum submit ulang).
    expect(mergeFilmVals({ a1: 3 }, pairs, 'PRE', { a1: 4, a2: 1 })).toEqual({ a1: 3, a2: 1 });
    // Ganti ronde PRE→POST membuang id ronde lama.
    expect(mergeFilmVals({ a1: 3, a2: 5 }, pairs, 'POST', { b1: 2 })).toEqual({ b1: 2 });
    // Nilai server non-numerik diabaikan.
    expect(mergeFilmVals({}, pairs, 'PRE', { a1: Number.NaN } as Record<string, number>)).toEqual({});
  });

  it('undi film: 1 Mentee + 1 Mentor (fallback bebas)', () => {
    expect(TESTIMONY_NEED_FILM).toEqual([['MENTEE', 1], ['MENTOR', 1]]);
    const pool = [
      { userId: 'm1', name: 'Mentee', roles: ['MENTEE'] },
      { userId: 't1', name: 'Mentor', roles: ['MENTOR'] },
      { userId: 'm2', name: 'Mentee 2', roles: ['MENTEE'] },
    ];
    const picks = composePicks(pool, [], TESTIMONY_NEED_FILM, () => 0);
    expect(picks).toHaveLength(2);
    expect(picks.map((p) => p.role).sort()).toEqual(['MENTEE', 'MENTOR']);
    // Pool tanpa mentor → dilengkapi bebas.
    const picks2 = composePicks(pool.filter((p) => p.userId !== 't1'), [], TESTIMONY_NEED_FILM, () => 0);
    expect(picks2).toHaveLength(2);
  });

  it('cleanLikertRounds: default AWAL buka + AKHIR tutup', () => {
    expect(cleanLikertRounds(null)).toBeNull();
    expect(cleanLikertRounds({})).toEqual({ pre: 'open', post: 'closed' });
    expect(cleanLikertRounds({ pre: 'closed', post: 'open' })).toEqual({ pre: 'closed', post: 'open' });
    expect(cleanLikertRounds({ pre: 'aneh' })).toEqual({ pre: 'open', post: 'closed' });
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
    for (const code of ['MONOLOG', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES', 'CREATIVE_LAB']) {
      const slots = noteSlotsFor(code);
      expect(slots.length).toBeGreaterThan(1);
      expect(slots[slots.length - 1].key).toBe('KOMITMEN');
    }
  });

  it('CREATIVE_LAB: 6 kartu jar + KOMITMEN', () => {
    const keys = noteSlotsFor('CREATIVE_LAB').map((s) => s.key);
    expect(keys).toEqual(['JAR-ROOT', 'JAR-TRUTH', 'JAR-LOST', 'JAR-COMMUNITY', 'JAR-VERSE', 'JAR-STEP', 'KOMITMEN']);
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
    expect(sessionModuleLabel('activity')).toBe('Aktivitas & timer');
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

  it('manual: tanpa duplikat, slot berlanjut, grup terbawa', () => {    const existing = [
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

  it('film: batas tepat 2 live, fresh diutamakan', () => {
    expect(TESTIMONY_FILM_CAP).toBe(2);
    const a = { userId: 'a', slot: 1 };
    const b = { userId: 'b', slot: 2 };
    expect(applyFilmCap([], [])).toEqual({ picks: [], capped: false });
    expect(applyFilmCap([a], [b])).toEqual({ picks: [a, b], capped: false });
    // Penuh + fresh 2 → 2 baru menang, lama dibuang.
    const out = applyFilmCap([a, b], [{ userId: 'c' }, { userId: 'd' }]);
    expect(out.picks.map((p) => p.userId)).toEqual(['c', 'd']);
    expect(out.capped).toBe(true);
    // Keadaan aneh (1 lama + 2 fresh) → tetap 2.
    expect(applyFilmCap([a], [b, { userId: 'c' }]).picks).toHaveLength(2);
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
    expect(widgetsFor('BEDAH_FILM', 'kesaksian')).toEqual(['testimony', 'download']);
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

  it('rounds kosong/null → null / default aman (kompatibel mundur)', () => {
    expect(cleanRounds(null)).toBeNull();
    expect(cleanRounds([])).toBeNull();
    expect(cleanRounds({})).toMatchObject({
      rounds: [],
      current: 0,
      phase: 'brief',
      step: 0,
      stepShowOnScreen: true,
      trapReveal: '',
    });
  });

  it('screening: judul wajib, durasi dibatasi', () => {
    expect(cleanScreening({})).toBeNull();
    expect(cleanScreening({ title: 'Gavin Stone', durationMin: 500 })).toMatchObject({ title: 'Gavin Stone', durationMin: 180 });
  });

  it('screening: preShow dirapikan (maks 6 baris, 140 huruf, kosong dibuang)', () => {
    const out = cleanScreening({
      title: 'Gavin Stone',
      preShow: ['  Konsumsi setelah film  ', '', 'a'.repeat(200), 1, 2, 3, 4, 5],
    });
    expect(out?.preShow).toEqual(['Konsumsi setelah film', 'a'.repeat(140), '1', '2', '3', '4']);
    expect(cleanScreening({ title: 'X' })?.preShow).toEqual([]);
  });

  it('teams: batas 8 tim, tanpa nama dibuang', () => {
    const out = cleanTeams({ teams: [{ name: 'Soal', members: ['A'] }, { name: '' }, { name: 'Lapangan' }] });
    expect(out.teams.map((t) => t.name)).toEqual(['Soal', 'Lapangan']);
    expect(cleanTeams(null)).toBeNull();
  });

  it('phase: nama valid F1/F2/F3/CLOSING + langkah film M0/M3/M4 + durasi baku 20/25/10/5 (+5/5/10)', () => {
    expect(MONOLOG_PHASE_SECONDS).toEqual({ F1: 1200, F2: 1500, F3: 600, CLOSING: 300 });
    expect(FILM_PHASE_SECONDS).toEqual({ M0: 300, M3: 300, M4: 600 });
    expect(cleanPhase(null)).toBeNull();
    expect(cleanPhase({})).toBeNull();
    expect(cleanPhase({ name: 'ngawur', startedAt: 'x' })).toBeNull();
    expect(cleanPhase({ name: 'F2' })).toBeNull();
    expect(cleanPhase({ name: 'f2', startedAt: '2026-10-11T09:00:00.000Z' })).toEqual({
      name: 'F2',
      startedAt: '2026-10-11T09:00:00.000Z',
      durationSec: 1500,
      showOnScreen: true,
    });
    expect(cleanPhase({ name: 'F1', startedAt: 'x', durationSec: 5 })).toMatchObject({ durationSec: 60 });
    expect(cleanPhase({ name: 'F3', startedAt: 'x', durationSec: 99999 })).toMatchObject({ durationSec: 7200 });
    expect(cleanPhase({ name: 'M0', startedAt: 'x' })).toMatchObject({ name: 'M0', durationSec: 300, showOnScreen: true });
    expect(cleanPhase({ name: 'M3', startedAt: 'x' })).toMatchObject({ name: 'M3', durationSec: 300, showOnScreen: true });
    expect(cleanPhase({ name: 'M4', startedAt: 'x' })).toMatchObject({ name: 'M4', durationSec: 600, showOnScreen: true });
    expect(cleanPhase({ name: 'M1', startedAt: 'x' })).toBeNull();
    expect(cleanPhase({ name: 'M2', startedAt: 'x' })).toBeNull();
  });

  it('phase: tampil di layar default true, bisa dimatikan', () => {
    expect(cleanPhase({ name: 'F1', startedAt: 'x' })).toMatchObject({ showOnScreen: true });
    expect(cleanPhase({ name: 'F1', startedAt: 'x', showOnScreen: false })).toMatchObject({ showOnScreen: false });
    expect(cleanPhase({ name: 'F1', startedAt: 'x', showOnScreen: 0 })).toMatchObject({ showOnScreen: false });
  });

  it('phasePrefs: durasi + tampil per fase dinormalisasi', () => {
    expect(cleanPhasePrefs(null)).toBeNull();
    expect(cleanPhasePrefs({})).toBeNull();
    const out = cleanPhasePrefs({
      F1: { durationSec: 600, showOnScreen: false },
      F2: { durationSec: 5 },
      NGACO: { durationSec: 100 },
    });
    expect(out.F1).toMatchObject({ durationSec: 600, showOnScreen: false });
    expect(out.F2).toMatchObject({ durationSec: 60, showOnScreen: true });
    expect(out.NGACO).toBeUndefined();
    expect(out.CLOSING).toMatchObject({ durationSec: 300, showOnScreen: true });
  });
});

describe('session-engine: pin mundur ke flow terbuka', () => {
  const order = ['sambutan', 'lagu', 'catatan', 'satu-kata', 'penutup'];

  it('tanpa pin / pin tak dikenal → ikut alur server', () => {
    expect(resolvePinnedSegment(order, null, 'catatan')).toBe('catatan');
    expect(resolvePinnedSegment(order, 'ngaco', 'catatan')).toBe('catatan');
  });

  it('pin ke tahap yang sudah terbuka dipertahankan', () => {
    expect(resolvePinnedSegment(order, 'lagu', 'catatan')).toBe('lagu');
    expect(resolvePinnedSegment(order, 'catatan', 'catatan')).toBe('catatan');
  });

  it('pin ke tahap yang belum terbuka jatuh ke alur server', () => {
    expect(resolvePinnedSegment(order, 'penutup', 'catatan')).toBe('catatan');
  });

  it('alur server maju tidak menarik pin mundur paksa', () => {
    expect(resolvePinnedSegment(order, 'lagu', 'satu-kata')).toBe('lagu');
    expect(resolvePinnedSegment(order, 'lagu', 'penutup')).toBe('lagu');
  });
});
