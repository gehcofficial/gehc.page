import { describe, expect, it } from 'vitest';
import { landingBeyondersHouses } from '../../src/lib/landing-groups';
import type { GroupBatch, YouthGroup } from '../../src/types';

const house = (over: Partial<YouthGroup> & { parentGroupId?: string | null }): YouthGroup =>
  ({
    id: 'g',
    tenant_id: 'tenant-youth',
    name: 'Agape',
    meaning: '',
    scripture: '',
    meetingSchedule: '',
    meetingLocation: '',
    color: '#000',
    icon: '',
    description: '',
    memberCount: 0,
    ...over,
  }) as YouthGroup;

describe('landingBeyondersHouses', () => {
  it('keeps empty parent houses when nothing else exists', () => {
    const empty = house({ id: 'shell', memberCount: 0 });
    expect(landingBeyondersHouses([empty]).map((g) => g.id)).toEqual(['shell']);
  });

  it('prefers the filled duplicate over an empty same-name shell', () => {
    const shell = house({ id: 'grp-2', name: 'Agape', memberCount: 0 });
    const live = house({ id: 'grp-agape', name: 'AGAPE', memberCount: 9 });
    const batches: GroupBatch[] = [
      { id: 'b1', group_id: 'grp-agape', batchLabel: '', period: '2026', mentor: 'A', comentor: '', theme: '', isCurrent: true, mentees: [] },
    ];
    expect(landingBeyondersHouses([shell, live], batches).map((g) => g.id)).toEqual(['grp-agape']);
  });

  it('hides child regeneration groups', () => {
    const parent = house({ id: 'p', name: 'Logos' });
    const child = house({ id: 'c', name: 'Logos II', parentGroupId: 'p' });
    expect(landingBeyondersHouses([parent, child]).map((g) => g.id)).toEqual(['p']);
  });
});
