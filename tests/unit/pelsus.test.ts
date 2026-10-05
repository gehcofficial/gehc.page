import { describe, it, expect } from 'vitest';
import { parsePelsusHash, pelsusPath, quorumNeed, quorumMet, electionSubtitle, SCOPE_LABEL, nextPollDelay } from '../../src/lib/pelsus';
import { quorumMet as serverQuorum, quorumNeed as serverNeed, isOpenElection, isPelsusAdmin } from '../../server/routes/pelsus.mjs';

describe('pelsus routing', () => {
  it('parse #/pelsus + detail + bilik + layar', () => {
    expect(parsePelsusHash('#/pelsus')).toEqual({ view: 'home', id: '' });
    expect(parsePelsusHash('#/pelsus/abc')).toEqual({ view: 'detail', id: 'abc' });
    expect(parsePelsusHash('#/pelsus/abc/bilik')).toEqual({ view: 'bilik', id: 'abc' });
    expect(parsePelsusHash('#/pelsus/abc/layar')).toEqual({ view: 'layar', id: 'abc' });
    expect(parsePelsusHash('#/beyonders')).toBeNull();
  });

  it('pelsusPath membangun hash', () => {
    expect(pelsusPath()).toBe('#/pelsus');
    expect(pelsusPath('x')).toBe('#/pelsus/x');
    expect(pelsusPath('x', 'bilik')).toBe('#/pelsus/x/bilik');
    expect(pelsusPath('x', 'layar')).toBe('#/pelsus/x/layar');
  });

  it('label scope tersedia', () => {
    expect(SCOPE_LABEL.BIPRA).toMatch(/Penatua/);
    expect(SCOPE_LABEL.KOLOM).toMatch(/Kolom/);
    expect(SCOPE_LABEL.BPMJ).toMatch(/BPMJ/);
  });

  it('subtitle election', () => {
    expect(electionSubtitle({ scope: 'BIPRA', bipra: 'PEMUDA', roleTarget: 'PENATUA' })).toBe('PEMUDA · PENATUA');
    expect(electionSubtitle({ scope: 'KOLOM', kolomId: 'kol-1', roleTarget: 'DIAKEN' })).toBe('kol-1 · DIAKEN');
  });
});

describe('pelsus kuorum 2/3', () => {
  it('need = ceil(total*2/3)', () => {
    expect(quorumNeed(0)).toBe(0);
    expect(quorumNeed(3)).toBe(2);
    expect(quorumNeed(10)).toBe(7);
    expect(quorumNeed(100)).toBe(67);
  });

  it('met hanya bila voted >= need', () => {
    expect(quorumMet(67, 100)).toBe(true);
    expect(quorumMet(66, 100)).toBe(false);
    expect(quorumMet(0, 0)).toBe(false);
  });

  it('server & client konsisten', () => {
    for (const t of [0, 1, 3, 10, 99, 267]) {
      expect(serverNeed(t, 2, 3)).toBe(quorumNeed(t, 2, 3));
      expect(serverQuorum(7, 10, 2, 3)).toBe(quorumMet(7, 10, 2, 3));
    }
  });
});

describe('pelsus status', () => {
  it('OPEN hanya bila status OPEN + belum closesAt', () => {
    expect(isOpenElection({ status: 'OPEN' })).toBe(true);
    expect(isOpenElection({ status: 'DRAFT' })).toBe(false);
    expect(isOpenElection({ status: 'CLOSED' })).toBe(false);
    expect(isOpenElection({ status: 'OPEN', closesAt: new Date(Date.now() - 1000) })).toBe(false);
    expect(isOpenElection({ status: 'OPEN', closesAt: new Date(Date.now() + 3600000) })).toBe(true);
    expect(isOpenElection(null)).toBe(false);
  });

  it('admin = SUPERADMIN/BPMJ/KOMISI/COMMITTEE', () => {
    expect(isPelsusAdmin({ roles: [{ role: 'SUPERADMIN' }] })).toBe(true);
    expect(isPelsusAdmin({ roles: [{ role: 'BPMJ' }] })).toBe(true);
    expect(isPelsusAdmin({ roles: [{ role: 'KOMISI' }] })).toBe(true);
    expect(isPelsusAdmin({ roles: [{ role: 'COMMITTEE' }] })).toBe(true);
    expect(isPelsusAdmin({ roles: [{ role: 'MENTEE' }] })).toBe(false);
    expect(isPelsusAdmin({ roles: [] })).toBe(false);
  });
});

describe('pelsus backoff polling', () => {
  it('mundur saat gagal, dibatasi 60 dtk', () => {
    const d0 = nextPollDelay(0);
    const d3 = nextPollDelay(3);
    const d9 = nextPollDelay(9);
    expect(d3).toBeGreaterThan(d0);
    expect(d9).toBeLessThanOrEqual(60000);
  });
});
