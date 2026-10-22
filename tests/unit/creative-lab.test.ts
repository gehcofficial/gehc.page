import { describe, expect, it } from 'vitest';
import { cleanActivity, cleanTeams, creativeLabFromDraft, buildCreativeLabTeams, buildJointMissionTeams, matchJointTeam, CREATIVE_LAB_GROUP_NAMES, LAB_MAX_TEAMS, LAB_STATION_CAP, SEQUENCE_MAX_TEAMS } from '../../server/lib/session-stage.mjs';
import { adminLabPhotoAllowed, allowedNoteCodes, creativeLabBrief, findLabTeam, jarCards, LAB_PHOTO_LIMIT, labPhotoQuota, labPresentationOrder, labSummary } from '../../server/routes/worship.mjs';
import { LAB_STATION_CAP as CLIENT_STATION_CAP } from '../../src/lib/mentoring';
import { bucketForPhotoKind, pickEventFolder, pickFolderByName, plainFolderName } from '../../server/lib/lab-drive.mjs';
import { codeFromMentoringHash, stepLabPresentation } from '../../src/lib/mentoring';

describe('creative-lab: cleanActivity', () => {
  it('null → null; kosong → default IDLE', () => {
    expect(cleanActivity(null)).toBeNull();
    expect(cleanActivity('x')).toBeNull();
    expect(cleanActivity({})).toMatchObject({
      phase: 'IDLE',
      showOnScreen: true,
      cardIndex: 0,
      presentIndex: 0,
      presentSeconds: 150,
      presentOrder: [],
      presentDrawnAt: null,
      durations: { A1: 900, A2: 1500, PRESENT: 150 },
    });
  });

  it('menyimpan undian presentasi: unik, 0-9, maks 10', () => {
    const a = cleanActivity({ presentOrder: [3, 1, 3, 9, -1, 0, 2, 2, 7, 8, 10], presentDrawnAt: '2026-10-21T10:00:00.000Z' });
    expect(a.presentOrder).toEqual([3, 1, 9, 0, 2, 7, 8]);
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
    expect(a.presentIndex).toBe(9);
    expect(a.presentSeconds).toBe(600);
    expect(a.durations).toEqual({ A1: 60, A2: 7200, PRESENT: 60 });
    expect(cleanActivity({ presentIndex: 12 }).presentIndex).toBe(9);
    expect(cleanActivity({}).presentSlide).toBe(0);
    expect(cleanActivity({ presentSlide: 1 }).presentSlide).toBe(1);
    expect(cleanActivity({ presentSlide: 9 }).presentSlide).toBe(7);
  });

  it('cleanTeams default tetap 8; Creative Lab boleh 10', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `T${i + 1}` }));
    expect(cleanTeams({ teams: many }).teams).toHaveLength(8);
    expect(cleanTeams({ teams: many }, { maxTeams: LAB_MAX_TEAMS }).teams).toHaveLength(10);
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

  it('pelukis stasiun mengikuti kuota foto (maks 2)', () => {
    expect(LAB_STATION_CAP).toBe(LAB_PHOTO_LIMIT.POT);
    expect(LAB_STATION_CAP).toBe(LAB_PHOTO_LIMIT.BAG);
    expect(CLIENT_STATION_CAP).toBe(LAB_STATION_CAP);
    const out = cleanTeams({
      teams: [{ name: 'Agape', pot: ['A', 'B', 'C', 'D'], bag: ['E', 'F', 'G'] }],
    });
    expect(out.teams[0].pot).toEqual(['A', 'B']);
    expect(out.teams[0].bag).toEqual(['E', 'F']);
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

  it('kosong → tanpa tim, default 15/25/150', () => {
    const out = creativeLabFromDraft({});
    expect(out.teams).toBeNull();
    expect(out.activity.durations).toEqual({ A1: 900, A2: 1500, PRESENT: 150 });
  });

  it('present-seconds tersimpan tetap dipakai', () => {
    const out = creativeLabFromDraft({ present: { 'present-seconds': '120' } });
    expect(out.activity.presentSeconds).toBe(120);
  });
});

describe('creative-lab: payload peserta & layar', () => {
  it('jarCards dari item aktivitas 1 atau legacy jar', () => {
    const custom = jarCards({
      draft: {
        'activity-1': {
          'a1-item-1-judul': 'A Root I Carry',
          'a1-item-1-konteks': 'Akar keluarga GMIM',
          'a1-item-1-pertanyaan': 'Apa akar imanmu?',
        },
      },
    });
    expect(custom).toHaveLength(1);
    expect(custom[0]).toMatchObject({ code: 'JAR-1', title: 'A Root I Carry' });
    expect(custom[0].direction).toContain('Akar keluarga GMIM');
    const legacy = jarCards({ draft: { jar: { 'jar-root': 'Akar lama' } } });
    expect(legacy[0]).toMatchObject({ code: 'JAR-ROOT', direction: 'Akar lama' });
    expect(jarCards({})[0].code).toBe('JAR-1');
  });

  it('creativeLabBrief membawa isi draft tanpa fallback RUACH', () => {
    const brief = creativeLabBrief({
      draft: {
        firman: { 'firman-judul': 'Our Roots' },
        briefing: { 'brief-core': 'Inti firman' },
        'activity-1': { 'a1-title': 'Jar', 'a1-minutes': '18' },
        'activity-2': { 'a2-title': 'Art', 'a2-pot': 'Arah pot', 'a2-bag': 'Arah tas', 'a2-minutes': '28' },
        present: { 'present-seconds': '150' },
        closing: { 'closing-script': 'Konklusi firman' },
      },
    });
    expect(brief.firmanTitle).toBe('Our Roots');
    expect(brief.briefing.core).toBe('Inti firman');
    expect(brief.briefing.scribe).toMatch(/perwakilan/i);
    expect(brief.a1).toMatchObject({ title: 'Jar', minutes: 18 });
    expect(brief.a2).toMatchObject({ pot: 'Arah pot', bag: 'Arah tas', minutes: 28 });
    expect(brief.present.seconds).toBe(150);
    expect(brief.closing.script).toBe('Konklusi firman');
    const empty = creativeLabBrief({});
    expect(empty.a1.title).toBe('Sesi 1');
    expect(empty.a2.title).toBe('Sesi 2');
    expect(empty.a2.stationA.media).toBe('Stasiun A');
    expect(empty.present.seconds).toBe(150);
  });

  it('allowedNoteCodes tetap membuka KOMITMEN', () => {
    const allowed = allowedNoteCodes({
      topics: [],
      draft: { 'activity-1': { 'a1-item-1-judul': 'Q1' } },
    });
    expect(allowed.has('KOMITMEN')).toBe(true);
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
    expect(findLabTeam(cfg, 'u-x', { asAdmin: true, teamIndex: 1 })).toMatchObject({ index: 1, asAdmin: true, isRep: true });
    expect(findLabTeam(cfg, 'u-rep', { asAdmin: true, teamIndex: '' })).toMatchObject({ index: 0, isRep: true });
    expect(findLabTeam(cfg, 'u-x', { asAdmin: true, teamIndex: 9 })).toBeNull();
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

describe('creative-lab: buildCreativeLabTeams', () => {
  const member = (id: string, name: string) => ({ userId: id, name });
  const groups = [
    { id: 'g-shalom', name: 'shalom', members: [member('u1', 'Budi'), member('u2', 'Ani')] },
    {
      id: 'g-agape',
      name: 'AGAPE',
      members: [member('a1', 'Zara'), member('a2', 'Cici'), { name: 'Tanpa Akun' }],
    },
    { id: 'g-extra', name: 'Yohanes', members: [member('x1', 'Extra')] },
  ];

  it('urut kanonik, cocok tanpa peduli huruf, tandai yang hilang, abaikan ekstra', () => {
    const out = buildCreativeLabTeams(groups, { checkedInIds: ['a1'] });
    expect(out.teams).toHaveLength(LAB_MAX_TEAMS);
    expect(out.teams.map((t) => t.name)).toEqual([
      'AGAPE', ...CREATIVE_LAB_GROUP_NAMES.slice(1, 9), 'shalom',
    ]);
    expect(out.teams[0]).toMatchObject({
      groupId: 'g-agape',
      missing: false,
      members: ['Zara'],
      memberUserIds: ['a1', 'a2'],
    });
    expect(out.missing).toContain('Avodah');
    expect(out.missing).not.toContain('Agape');
    expect(out.missing).not.toContain('Shalom');
    expect(out.teams.some((t) => t.name === 'Yohanes')).toBe(false);
    expect(out.orderLocked).toBe(false);
  });

  it('tanpa kunci urutan: kanonik, pot dan perwakilan yang masih anggota dipertahankan', () => {
    const out = buildCreativeLabTeams(groups, {
      existingTeams: [{ name: 'shalom', pot: ['Budi', 'Orang Luar'], repUserId: 'u1', station: 'Pojok' }],
    });
    expect(out.teams[0].groupId).toBe('g-agape');
    const shalom = out.teams.find((t) => t.groupId === 'g-shalom');
    expect(shalom).toMatchObject({ pot: ['Budi'], repUserId: 'u1', repName: 'Budi', station: 'Pojok' });
  });

  it('perwakilan yang bukan anggota dibuang', () => {
    const out = buildCreativeLabTeams(
      [{ id: 'g', name: 'Agape', members: [member('a1', 'Zara')] }],
      { existingTeams: [{ name: 'Agape', groupId: 'g', repUserId: 'lain', repName: 'Admin' }] },
    );
    expect(out.teams[0].repUserId).toBe('');
    expect(out.teams[0].repName).toBe('');
  });

  it('kunci urutan bila sudah ada update: indeks lama tetap, potong di 10', () => {
    const out = buildCreativeLabTeams(groups, {
      lockOrder: true,
      existingTeams: [
        { name: 'Shalom', groupId: 'g-shalom', pot: ['Ani'], bag: ['Budi'], repUserId: 'u2', task: 'tugas', done: true },
        { name: 'Kelompok Lama', members: ['Lama'] },
      ],
    });
    expect(out.orderLocked).toBe(true);
    expect(out.teams).toHaveLength(10);
    expect(out.teams[0]).toMatchObject({ name: 'shalom', pot: ['Ani'], bag: ['Budi'], repUserId: 'u2', task: 'tugas', done: true });
    expect(out.teams[1].name).toBe('Kelompok Lama');
    expect(out.teams[2].name).toBe('AGAPE');
    expect(out.teams.map((t) => t.name)).not.toContain('Ruach');
  });

  it('roster tampilan = yang hadir; yang absen tetap di akses feed', () => {
    const members = Array.from({ length: 22 }, (_, i) => member(`id${String(i).padStart(2, '0')}`, `Nama ${String(i).padStart(2, '0')}`));
    const out = buildCreativeLabTeams(
      [{ id: 'g', name: 'Agape', members }],
      { checkedInIds: ['id21', 'id01'] },
    );
    expect(out.teams[0].members).toEqual(['Nama 01', 'Nama 21']);
    expect(out.teams[0].memberUserIds).toHaveLength(20);
    expect(out.teams[0].memberUserIds).toEqual(expect.arrayContaining(['id21', 'id01', 'id00']));
  });

  it('sebelum ada absensi, roster perencanaan tetap maks 8', () => {
    const members = Array.from({ length: 12 }, (_, i) => member(`id${i}`, `Nama ${i}`));
    const out = buildCreativeLabTeams([{ id: 'g', name: 'Agape', members }]);
    expect(out.teams[0].members).toHaveLength(8);
    expect(out.teams[0].memberUserIds).toHaveLength(12);
  });
});

describe('creative-lab: folder foto', () => {
  it('jenis foto memilih ember yang benar', () => {
    expect(bucketForPhotoKind('GROUP')).toBe('Foto Kelompok');
    expect(bucketForPhotoKind('POT')).toBe('Hasil Karya');
    expect(bucketForPhotoKind('bag')).toBe('Hasil Karya');
  });

  it('nama polos membuang tag dan garis miring', () => {
    expect(plainFolderName(' Agape [GROUP:agape] / foto ')).toBe('Agape foto');
  });

  it('pemilih folder memakai yang pertama dan tag event', () => {
    const folders = [
      { id: '1', name: 'Lain' },
      { id: '2', name: 'Foto Kelompok' },
      { id: '3', name: 'foto kelompok' },
      { id: '4', name: 'Ibadah [EV:serving:DIDASKALIA]' },
      { id: '5', name: 'Duplikat [EV:serving:DIDASKALIA]' },
    ];
    expect(pickFolderByName(folders, 'Foto Kelompok')?.id).toBe('2');
    expect(pickEventFolder(folders, 'serving')?.id).toBe('4');
    expect(pickEventFolder(folders, '')).toBeNull();
    expect(pickEventFolder(folders, 'lain')).toBeNull();
  });
});

describe('creative-lab: navigasi slide presentasi', () => {
  it('maju per slide, lalu pindah kelompok; sesi lama tanpa slide mulai di Pot', () => {
    expect(stepLabPresentation({ presentIndex: 0 }, 3, 1)).toEqual({ phase: 'PRESENT', presentIndex: 0, presentSlide: 1 });
    expect(stepLabPresentation({ presentIndex: 0, presentSlide: 1 }, 3, 1)).toEqual({ phase: 'PRESENT', presentIndex: 0, presentSlide: 2 });
    expect(stepLabPresentation({ presentIndex: 0, presentSlide: 2 }, 3, 1)).toEqual({ phase: 'PRESENT', presentIndex: 1, presentSlide: 0 });
    expect(stepLabPresentation({ presentIndex: 2, presentSlide: 2 }, 3, 1)).toEqual({ phase: 'DONE', presentIndex: 2, presentSlide: 2 });
  });

  it('mundur di slide pertama kembali ke foto bersama kelompok sebelumnya', () => {
    expect(stepLabPresentation({ presentIndex: 0, presentSlide: 0 }, 3, -1)).toEqual({ phase: 'PRESENT', presentIndex: 0, presentSlide: 0 });
    expect(stepLabPresentation({ presentIndex: 2, presentSlide: 0 }, 3, -1)).toEqual({ phase: 'PRESENT', presentIndex: 1, presentSlide: 2 });
    expect(stepLabPresentation({ presentIndex: 1, presentSlide: 2 }, 3, -1)).toEqual({ phase: 'PRESENT', presentIndex: 1, presentSlide: 1 });
  });
});

describe('creative-lab: unggah admin dan kuota', () => {
  const photo = (kind: string) => ({ kind, photoUrl: 'https://drive.example/x' });

  it('pengurus boleh saat A2, presentasi, dan penutupan; peserta dan fase lain ditolak', () => {
    expect(adminLabPhotoAllowed({ roles: ['SUPERADMIN'], status: 'RUNNING', phase: 'A2' }).ok).toBe(true);
    expect(adminLabPhotoAllowed({ roles: [{ role: 'KOMISI' }], status: 'RUNNING', phase: 'PRESENT' }).ok).toBe(true);
    expect(adminLabPhotoAllowed({ roles: ['COMMITTEE'], status: 'WRAPUP', phase: 'DONE' }).ok).toBe(true);
    expect(adminLabPhotoAllowed({ roles: ['SUPERADMIN'], status: 'RUNNING', phase: 'DONE' }).ok).toBe(true);
    expect(adminLabPhotoAllowed({ roles: ['MENTEE'], status: 'RUNNING', phase: 'A2' })).toMatchObject({ ok: false, status: 403 });
    expect(adminLabPhotoAllowed({ roles: ['SUPERADMIN'], status: 'RUNNING', phase: 'A1' })).toMatchObject({ ok: false, status: 409 });
    expect(adminLabPhotoAllowed({ roles: ['SUPERADMIN'], status: 'CLOSED', phase: 'PRESENT' })).toMatchObject({ ok: false, status: 409 });
  });

  it('kuota sama dengan perwakilan: Pot 2, Tas 2, bersama 1', () => {
    expect(labPhotoQuota([photo('POT')], 'POT').ok).toBe(true);
    expect(labPhotoQuota([photo('POT'), photo('POT')], 'pot')).toMatchObject({ ok: false, status: 400 });
    expect(labPhotoQuota([photo('BAG'), { kind: 'BAG', photoUrl: null }], 'BAG').ok).toBe(true);
    expect(labPhotoQuota([photo('BAG'), photo('BAG')], 'BAG')).toMatchObject({ ok: false, status: 400 });
    expect(labPhotoQuota([photo('GROUP')], 'GROUP')).toMatchObject({ ok: false, status: 400 });
    expect(labPhotoQuota([], 'NOTE')).toMatchObject({ ok: false, status: 400 });
  });
});

describe('mission-sequence: tim gabungan', () => {
  it('default 5 pasangan dari 10 kelompok, peran hanya teks di dalam tim', () => {
    const board = buildJointMissionTeams();
    expect(board.teams).toHaveLength(SEQUENCE_MAX_TEAMS);
    expect(board.teams[0]).toMatchObject({ name: 'Agape & Avodah', pair: ['Agape', 'Avodah'] });
    expect(board.teams[4].name).toBe('Ruach & Shalom');
    expect(String(board.teams[0].roles)).toContain('bukan tim terpisah');
    const cleaned = cleanTeams(board, { maxTeams: SEQUENCE_MAX_TEAMS });
    expect(cleaned.teams).toHaveLength(5);
    expect(cleaned.teams[1].pair).toEqual(['Dunamis', 'Echad']);
    expect(matchJointTeam(cleaned.teams, { groupName: 'Kairos' })).toBe(2);
    expect(matchJointTeam(cleaned.teams, { userId: 'x' })).toBe(-1);
  });
});

describe('creative-lab: kode layar di hash', () => {
  it('membaca code di dalam hash, bukan location.search', () => {
    expect(codeFromMentoringHash('#/mentoring/lab-1/layar?code=ab-12')).toBe('AB12');
    expect(codeFromMentoringHash('#/mentoring/lab-1/layar')).toBe('');
    expect(codeFromMentoringHash('#/mentoring/lab-1/layar?code=abcdefghijklmn')).toBe('ABCDEFGHIJKL');
  });
});
