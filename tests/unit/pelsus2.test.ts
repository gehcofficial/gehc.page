import { describe, it, expect } from 'vitest';
import {
  parsePelsus2Hash, pelsus2Path, pelsus2Query, isSimPreview, filterSim,
  parseTokenQueue, nextUnvoted, myBallotProgress,
} from '../../src/lib/pelsus2';
import { isPelsusHash, isPelsus2Hash } from '../../src/lib/host-context';
import { groupVotersToPeople } from '../../server/routes/pelsus.mjs';

describe('pelsus2 routing', () => {
  it('parse home + detail + bilik + layar + panitia', () => {
    expect(parsePelsus2Hash('#/pelsus2')).toEqual({ view: 'home', id: '' });
    expect(parsePelsus2Hash('#/pelsus2?sim')).toEqual({ view: 'home', id: '' });
    expect(parsePelsus2Hash('#/pelsus2/abc')).toEqual({ view: 'detail', id: 'abc' });
    expect(parsePelsus2Hash('#/pelsus2/abc/bilik')).toEqual({ view: 'bilik', id: 'abc' });
    expect(parsePelsus2Hash('#/pelsus2/abc/layar')).toEqual({ view: 'layar', id: 'abc' });
    expect(parsePelsus2Hash('#/pelsus2/panitia')).toEqual({ view: 'panitia', id: '' });
    expect(parsePelsus2Hash('#/pelsus')).toBeNull();
    expect(parsePelsus2Hash('#/pelsus2x')).toBeNull();
    expect(parsePelsus2Hash('#/beyonders')).toBeNull();
  });

  it('pelsus2Path membangun hash', () => {
    expect(pelsus2Path()).toBe('#/pelsus2');
    expect(pelsus2Path('x')).toBe('#/pelsus2/x');
    expect(pelsus2Path('x', 'bilik')).toBe('#/pelsus2/x/bilik');
    expect(pelsus2Path('x', 'layar')).toBe('#/pelsus2/x/layar');
    expect(pelsus2Path(undefined, 'panitia')).toBe('#/pelsus2/panitia');
  });

  it('V1 dan V2 tidak saling menelan', () => {
    expect(isPelsusHash('#/pelsus2')).toBe(false);
    expect(isPelsusHash('#/pelsus2/abc')).toBe(false);
    expect(isPelsusHash('#/pelsus2/abc/bilik')).toBe(false);
    expect(isPelsus2Hash('#/pelsus')).toBe(false);
    expect(isPelsus2Hash('#/pelsus/abc')).toBe(false);
    expect(isPelsus2Hash('#/voting')).toBe(false);
    expect(isPelsus2Hash('#/pelsus2')).toBe(true);
    expect(isPelsus2Hash('#/pelsus2?sim')).toBe(true);
    expect(isPelsus2Hash('#/pelsus2/abc/layar')).toBe(true);
    expect(isPelsus2Hash('#/pelsus2/panitia')).toBe(true);
  });

  it('query + filter sim', () => {
    expect(pelsus2Query('#/pelsus2?sim').has('sim')).toBe(true);
    expect(isSimPreview('#/pelsus2?sim')).toBe(true);
    expect(isSimPreview('#/pelsus2')).toBe(false);
    const list = [{ id: 'sim-a' }, { id: 'pel-x' }, { id: 'sim-b' }, { id: 'pv2-c' }];
    expect(filterSim(list, '#/pelsus2?sim').map((e) => e.id)).toEqual(['sim-a', 'sim-b', 'pv2-c']);
    expect(filterSim(list, '#/pelsus2')).toHaveLength(4);
  });

  it('antrean token: tokens CSV + fallback token tunggal', () => {
    expect(parseTokenQueue('#/pelsus2/x/bilik?tokens=AB12,cd34 ,EF56')).toEqual(['AB12', 'CD34', 'EF56']);
    expect(parseTokenQueue('#/pelsus2/x/bilik?token=ab12')).toEqual(['AB12']);
    expect(parseTokenQueue('#/pelsus2/x/bilik')).toEqual([]);
    expect(parseTokenQueue('#/pelsus2/x/bilik?tokens=a!@#, ')).toEqual(['A']);
    const many = Array.from({ length: 15 }, (_, i) => `T${i}`).join(',');
    expect(parseTokenQueue(`#/pelsus2/x/bilik?tokens=${many}`)).toHaveLength(10);
  });
});

describe('pelsus2 by-person', () => {
  const list = [
    { id: 'a', open: true, myVoter: { hasVoted: true } },
    { id: 'b', open: true, myVoter: { hasVoted: false } },
    { id: 'c', open: false, myVoter: { hasVoted: false } },
    { id: 'd', open: true, myVoter: null },
  ];

  it('nextUnvoted lewati sudah/tutup/tak-terdaftar', () => {
    expect(nextUnvoted(list)?.id).toBe('b');
    expect(nextUnvoted(list, 'b')).toBeNull();
    expect(nextUnvoted([{ id: 'x', status: 'OPEN', myVoter: { hasVoted: false } }])?.id).toBe('x');
  });

  it('myBallotProgress hitung milik saya saja', () => {
    expect(myBallotProgress(list)).toEqual({ done: 1, total: 3 });
    expect(myBallotProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('people search grouping (server, murni)', () => {
  const emap = new Map([
    ['e1', { id: 'e1', title: 'Penatua Pemuda', scope: 'BIPRA', status: 'OPEN' }],
    ['e2', { id: 'e2', title: 'Penatua Kolom 3', scope: 'KOLOM', status: 'DRAFT' }],
  ]);
  const rows = [
    { id: 'v1', electionId: 'e1', userId: 'u-al', name: 'Alvandi', bipra: 'PEMUDA', kolomId: 'kol-3', hasVoted: false, votedVia: null },
    { id: 'v2', electionId: 'e2', userId: 'u-al', name: 'Alvandi', bipra: 'PEMUDA', kolomId: 'kol-3', hasVoted: false, votedVia: null },
    { id: 'v3', electionId: 'e1', userId: null, name: 'Tamu', bipra: null, kolomId: 'kol-3', hasVoted: true, votedVia: 'MANUAL' },
  ];

  it('satu userId lintas election = satu orang', () => {
    const people = groupVotersToPeople(rows, emap);
    expect(people).toHaveLength(2);
    const al = people.find((p) => p.userId === 'u-al');
    expect(al.elections).toHaveLength(2);
    expect(al.elections[0]).toMatchObject({ electionId: 'e1', open: true, hasVoted: false });
    expect(al.elections[1]).toMatchObject({ electionId: 'e2', open: false });
  });

  it('DPT impor tanpa akun dikelompokkan per nama', () => {
    const people = groupVotersToPeople(rows, emap);
    const tamu = people.find((p) => p.userId === null);
    expect(tamu.name).toBe('Tamu');
    expect(tamu.elections[0]).toMatchObject({ votedVia: 'MANUAL', hasVoted: true });
  });

  it('election tak dikenal tetap tampil (open=false)', () => {
    const people = groupVotersToPeople([rows[0]], new Map());
    expect(people[0].elections[0]).toMatchObject({ title: 'e1', open: false });
  });
});
