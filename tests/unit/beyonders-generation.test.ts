import { describe, expect, it } from 'vitest';
import {
  GEN0_PERIOD,
  houseKey,
  isPeriod,
  isTenHomeName,
  leaderMismatch,
  namesMatch,
  pickTenHomes,
} from '../../server/lib/beyonders-generation.mjs';

describe('beyonders generation', () => {
  it('Retreat gen 0 is 2026-06, not registration month', () => {
    expect(GEN0_PERIOD).toBe('2026-06');
    expect(isPeriod('2026-09')).toBe(true);
    expect(isPeriod('2026')).toBe(false);
  });

  it('matches abbreviated landing names', () => {
    expect(namesMatch('Alvandi I.', 'Alvandi Isaerang')).toBe(true);
    expect(namesMatch('TBD', 'Alvandi')).toBe(false);
  });

  it('flags landing vs live access mismatch', () => {
    expect(leaderMismatch('Alvandi I.', null, null)).toBe(true);
    expect(leaderMismatch('Alvandi I.', 'u1', { id: 'u2', name: 'Other' })).toBe(true);
    expect(leaderMismatch('Alvandi I.', 'u1', { id: 'u1', name: 'Alvandi Isaerang' })).toBe(false);
  });

  it('picks one live parent per ten-home name', () => {
    const groups = [
      { id: 'shell', name: 'Agape', parentGroupId: null, memberCount: 0, batches: [] },
      { id: 'live', name: 'AGAPE', parentGroupId: null, memberCount: 9, batches: [{ isCurrent: true }] },
      { id: 'child', name: 'Agape II', parentGroupId: 'live', memberCount: 4, batches: [] },
      { id: 'dunamis', name: 'Dunamis', parentGroupId: null, memberCount: 1, batches: [{ isCurrent: true }] },
    ];
    const picked = pickTenHomes(groups);
    expect(picked.map((g) => g.id)).toEqual(['live', 'dunamis']);
    expect(houseKey('AGAPE')).toBe('agape');
    expect(isTenHomeName('Agape II')).toBe(false);
  });
});
