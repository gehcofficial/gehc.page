import { describe, expect, it } from 'vitest';
import { mergeDayStatus } from '../../src/lib/control-room';
import { isDayScreenHash, parseDayHash } from '../../src/lib/liturgy-live';

describe('control-room: agregasi blok hari', () => {
  const blocks = [
    { id: 'b1', kind: 'ibadah-block', eventId: 'ev-1', event: { id: 'ev-1', name: 'Ibadah' } },
    { id: 'b2', kind: 'pengumuman', title: 'HUT' },
    { id: 'b3', kind: 'ibadah-block', eventId: 'ev-2', event: { id: 'ev-2', name: 'Ibadah 2' } },
  ];

  it('gabung live + sesi per event, blok non-ibadah polos', () => {
    const out = mergeDayStatus(
      blocks,
      [{ eventId: 'ev-1', status: 'LIVE', currentTitle: 'Praise 1', totalMoments: 8 }],
      [{ eventId: 'ev-1', slug: 'sesi-x', status: 'RUNNING', patternCode: 'MONOLOG' }],
    );
    expect(out[0]).toMatchObject({ liveStatus: 'LIVE', liveCurrent: 'Praise 1', worshipStatus: 'RUNNING', worshipSlug: 'sesi-x', worshipPattern: 'MONOLOG' });
    expect(out[1]).toMatchObject({ liveStatus: null, worshipStatus: null });
    expect(out[2]).toMatchObject({ liveStatus: null, worshipStatus: null });
  });

  it('toleran kosong', () => {
    expect(mergeDayStatus([], [], [])).toEqual([]);
  });
});

describe('day-screen: hash rute', () => {
  it('urai tanggal valid, tolak lain', () => {
    expect(parseDayHash('#/hari/2026-10-11/layar')).toEqual({ day: '2026-10-11' });
    expect(parseDayHash('#/ibadah/x/layar')).toBeNull();
    expect(parseDayHash('#/hari/besok/layar')).toBeNull();
    expect(isDayScreenHash('#/hari/2026-10-11/layar')).toBe(true);
    expect(isDayScreenHash('#/portal')).toBe(false);
  });
});
