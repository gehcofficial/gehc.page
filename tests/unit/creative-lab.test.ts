import { describe, expect, it } from 'vitest';
import { cleanActivity, cleanTeams, creativeLabFromDraft } from '../../server/lib/session-stage.mjs';
import { allowedNoteCodes, creativeLabBrief, findLabTeam, jarCards, labPresentationOrder, labSummary } from '../../server/routes/worship.mjs';

describe('creative-lab: cleanActivity', () => {
  it('null → null; kosong → default IDLE', () => {
    expect(cleanActivity(null)).toBeNull();
    expect(cleanActivity('x')).toBeNull();
    expect(cleanActivity({})).toMatchObject({
      phase: 'IDLE',
      showOnScreen: true,
      cardIndex: 0,
      presentIndex: 0,
      presentSeconds: 120,
      presentOrder: [],
      presentDrawnAt: null,
      durations: { A1: 900, A2: 1500, PRESENT: 120 },
    });
  });

  it('menyimpan undian presentasi: unik, 0-7, maks 8', () => {
    const a = cleanActivity({ presentOrder: [3, 1, 3, 9, -1, 0, 2, 2, 7, 8], presentDrawnAt: '2026-10-21T10:00:00.000Z' });
    expect(a.presentOrder).toEqual([3, 1, 0, 2, 7]);
    expect(a.presentDrawnAt).toBe('2026-10-21T10:00:00.000Z');
  });

  it('clamp kartu/kelompok/detik + normalisasi fase', () => {
    const a = cleanActivity({
      phase: 'present',
      startedAt: '2026-10-21T10:00:00.000Z',
      durationSec: 120,
      cardIndex: 99,
      presentIndex: 9,
      presentSeconds: 999,
      durations: { A1: 30, A2: 99999, PRESENT: 30 },
    });
    expect(a.phase).toBe('PRESENT');
    expect(a.cardIndex).toBe(5);
    expect(a.presentIndex).toBe(7);
    expect(a.presentSeconds).toBe(600);
    expect(a.durations).toEqual({ A1: 60, A2: 7200, PRESENT: 60 });
  });

  it('showOnScreen false dihormati', () => {
    expect(cleanActivity({ phase: 'A1', showOnScreen: false }).showOnScreen).toBe(false);
    expect(cleanActivity({ phase: 'A1', showOnScreen: 0 }).showOnScreen).toBe(false);
  });
});

describe('creative-lab: cleanTeams aditif', () => {
  it('menyimpan scribe/station/pot/bag tanpa merusak pola lama', () => {
    const out = cleanTeams({
      teams: [
        {
          name: 'Kelompok 1',
          task: 'Jar + pot/tas',
          members: ['A', 'B'],
          scribe: 'C',
          station: 'Meja 3',
          pot: ['A', 'B'],
          bag: ['D'],
        },
        { name: 'Tim lama' },
      ],
    });
    expect(out.teams[0]).toMatchObject({
      scribe: 'C',
      station: 'Meja 3',
      pot: ['A', 'B'],
      bag: ['D'],
    });
    expect(out.teams[1]).toMatchObject({ name: 'Tim lama', scribe: '', station: '', pot: [], bag: [] });
  });

  it('menyimpan perwakilan & anggota akun (dedupe, maks 20)', () => {
    const out = cleanTeams({
      teams: [{
        name: 'Kelompok 1',
        repUserId: 'u-rep',
        repName: 'Rina',
        memberUserIds: ['u-1', 'u-2', 'u-1', ''],
      }],
    });
    expect(out.teams[0]).toMatchObject({
      repUserId: 'u-rep',
      repName: 'Rina',
      memberUserIds: ['u-1', 'u-2'],
    });
  });
});

const DRAFT = {
  groups: {
      'group-1-name': 'Kelompok 1',
      'group-1-members': 'A, B; C\nD',
      'group-1-scribe': 'E',
      'group-1-rep': 'F',
      'group-1-pot': 'A, B',
      'group-1-bag': 'C, D',
      'group-2-name': '   ',
    },
    'activity-1': { 'a1-minutes': '20' },
    'activity-2': { 'a2-minutes': '30' },
    present: { 'present-seconds': '90' },
  };

describe('creative-lab: materialisasi draft', () => {
  it('membuat papan kelompok + durasi fase dari draft', () => {
    const out = creativeLabFromDraft(DRAFT);
    expect(out.teams.teams).toHaveLength(1);
    expect(out.teams.teams[0]).toMatchObject({
      name: 'Kelompok 1',
      members: ['A', 'B', 'C', 'D'],
      scribe: 'E',
      repName: 'F',
      repUserId: '',
      memberUserIds: [],
      station: 'Meja 1',
      pot: ['A', 'B'],
      bag: ['C', 'D'],
    });
    expect(out.activity.phase).toBe('IDLE');
    expect(out.activity.durations).toEqual({ A1: 1200, A2: 1800, PRESENT: 90 });
  });

  it('kosong → tanpa tim, default 15/25/120', () => {
    const out = creativeLabFromDraft({});
    expect(out.teams).toBeNull();
    expect(out.activity.durations).toEqual({ A1: 900, A2: 1500, PRESENT: 120 });
  });
});

describe('creative-lab: payload peserta & layar', () => {
  it('jarCards memakai draft lalu fallback generik', () => {
    const custom = jarCards({ draft: { jar: { 'jar-root': 'Akar keluarga GMIM' } } });
    expect(custom).toHaveLength(6);
    expect(custom[0]).toMatchObject({ key: 'root', code: 'JAR-ROOT', title: 'A Root I Carry', direction: 'Akar keluarga GMIM' });
    expect(custom[1].direction).toContain('Kebenaran tentang Kristus');
    expect(jarCards({})[0].direction.length).toBeGreaterThan(10);
  });

  it('creativeLabBrief membawa isi draft + fallback', () => {
    const brief = creativeLabBrief({
      draft: {
        briefing: { 'brief-core': 'Inti firman' },
        'activity-1': { 'a1-title': 'Jar', 'a1-minutes': '18' },
        'activity-2': { 'a2-pot': 'Arah pot', 'a2-bag': 'Arah tas', 'a2-minutes': '28' },
        present: { 'present-seconds': '150' },
        closing: { 'closing-script': 'Konklusi firman' },
      },
    });
    expect(brief.briefing.core).toBe('Inti firman');
    expect(brief.a1).toMatchObject({ title: 'Jar', minutes: 18 });
    expect(brief.a2).toMatchObject({ pot: 'Arah pot', bag: 'Arah tas', minutes: 28 });
    expect(brief.a2.potMeaning).toContain('Pot melambangkan tempat benih iman bertumbuh');
    expect(brief.a2.bagMeaning).toContain('Tas kanvas menjadi simbol kehidupan pemuda perantauan');
    expect(brief.a2.report).toBe('Perwakilan setiap kelompok maju melapor kepada Admin.');
    expect(brief.present.seconds).toBe(150);
    expect(brief.closing.script).toBe('Konklusi firman');
    const empty = creativeLabBrief({});
    expect(empty.a1.title).toBe('The Roots Reminder Jar');
    expect(empty.a2.title).toBe('Roots & DNA Creative Lab');
    expect(empty.present.seconds).toBe(120);
  });

  it('allowedNoteCodes menerima 6 kartu jar dari draft', () => {
    const allowed = allowedNoteCodes({
      topics: [],
      draft: {
        jar: {
          'jar-root': 'Akar', 'jar-truth': 'Kebenaran', 'jar-lost': 'Saat hilang',
          'jar-community': 'Komunitas', 'jar-verse': 'Ayat', 'jar-step': 'Langkah',
        },
        groups: DRAFT.groups,
      },
    });
    for (const k of ['JAR-ROOT', 'JAR-TRUTH', 'JAR-LOST', 'JAR-COMMUNITY', 'JAR-VERSE', 'JAR-STEP', 'KOMITMEN', 'GROUP-1-NAME']) {
      expect(allowed.has(k)).toBe(true);
    }
  });

  it('findLabTeam mengenali perwakilan & anggota; urutan presentasi melengkapi tim baru', () => {
    const cfg = {
      teams: { teams: [
        { name: 'A', repUserId: 'u-rep', memberUserIds: ['u-1', 'u-2'] },
        { name: 'B', repUserId: 'u-3', memberUserIds: [] },
      ] },
      activity: { presentOrder: [1, 1, 5] },
    };
    expect(findLabTeam(cfg, 'u-rep')).toMatchObject({ index: 0, isRep: true });
    expect(findLabTeam(cfg, 'u-2')).toMatchObject({ index: 0, isRep: false });
    expect(findLabTeam(cfg, 'u-x')).toBeNull();
    expect(labPresentationOrder(cfg.activity, 3)).toEqual([1, 0, 2]);
  });

  it('labSummary mengambil makna/progress/foto terbaru per tim', () => {
    const rows = [
      { id: 'p2', teamIndex: 0, kind: 'POT', body: 'Makna baru', progress: 60, photoUrl: 'foto-pot', thumbUrl: 'thumb', createdAt: new Date('2026-10-21T02:00:00Z') },
      { id: 'p1', teamIndex: 0, kind: 'POT', body: 'Makna lama', progress: 20, photoUrl: null, createdAt: new Date('2026-10-21T01:00:00Z') },
      { id: 'c1', teamIndex: 0, kind: 'COMMIT', body: 'Tumbuh', progress: null, photoUrl: null, createdAt: new Date('2026-10-21T01:30:00Z') },
      { id: 'g1', teamIndex: 0, kind: 'GROUP', body: '', progress: null, photoUrl: 'foto-bersama', thumbUrl: 'thumb', createdAt: new Date('2026-10-21T03:00:00Z') },
    ];
    const summary = labSummary(rows, [{ name: 'A', repName: 'Rina' }], { presentOrder: [] });
    expect(summary.presentOrder).toEqual([0]);
    expect(summary.teams[0]).toMatchObject({
      name: 'A',
      repName: 'Rina',
      pot: { meaning: 'Makna baru', progress: 60 },
      commitment: 'Tumbuh',
      photoComplete: true,
    });
    expect(summary.teams[0].pot.photos).toHaveLength(1);
  });
});
