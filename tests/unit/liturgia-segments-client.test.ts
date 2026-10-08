import { describe, expect, it } from 'vitest';
import { patternSegments, skeletonFromPattern } from '../../src/lib/liturgy-live';

const PATTERN = {
  code: 'MONOLOG',
  name: 'Monolog',
  phases: [
    {
      no: 1, title: 'Praise & Worship', minutes: 20,
      segments: [
        { key: 'praise', label: 'Praise', kind: 'song', songs: 3 },
        { key: 'firman', label: 'Firman', kind: 'firman' },
      ],
    },
    { no: 2, title: 'Diskusi', segments: [{ key: 'x', kind: 'games' }] },
  ],
};

describe('liturgia-segments klien: paritas dengan server', () => {
  it('patternSegments menyaring kind song/firman', () => {
    expect(patternSegments(PATTERN).map((s) => s.key)).toEqual(['praise', 'firman']);
  });

  it('skeletonFromPattern: 3 slot + 1 firman', () => {
    const sk = skeletonFromPattern(PATTERN);
    expect(sk.length).toBe(4);
    expect(sk[0]).toMatchObject({ kind: 'lagu', title: 'Praise 1', segmentKey: '1:praise', serviceSongId: null });
    expect(sk[3]).toMatchObject({ kind: 'firman', segmentKey: '1:firman' });
  });
});
