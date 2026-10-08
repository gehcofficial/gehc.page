import { describe, expect, it } from 'vitest';
import {
  DAY_KINDS,
  normalizeDay,
  normalizeDayItemInput,
  serializeDayItem,
} from '../../server/lib/day-timeline.mjs';
import { orderBoundaryWarnings } from '../../server/lib/liturgy-live.mjs';
import { orderBoundaryWarnings as clientWarnings } from '../../src/lib/liturgy-live';

describe('day-timeline: validasi blok hari', () => {
  it('tanggal wajib YYYY-MM-DD', () => {
    expect(normalizeDay('2026-10-11')).toBe('2026-10-11');
    expect(normalizeDay('2026-10-11T00:00:00Z')).toBe('2026-10-11');
    expect(normalizeDay('11-10-2026')).toBeNull();
    expect(normalizeDay('')).toBeNull();
    expect(() => normalizeDayItemInput({ kind: 'pengumuman' })).toThrow('Tanggal hari');
  });

  it('blok ibadah wajib menunjuk event', () => {
    expect(() => normalizeDayItemInput({ kind: 'ibadah-block', day: '2026-10-11' }))
      .toThrow('menunjuk event');
    const d = normalizeDayItemInput({ kind: 'ibadah-block', day: '2026-10-11', eventId: 'evt-1' });
    expect(d.eventId).toBe('evt-1');
    expect(DAY_KINDS).toContain('selebrasi');
    expect(() => normalizeDayItemInput({ kind: 'karnaval', day: '2026-10-11' })).toThrow('Jenis blok');
  });

  it('durasi + serialize', () => {
    expect(() => normalizeDayItemInput({ kind: 'makan', day: '2026-10-11', minutes: 9999 })).toThrow('Durasi');
    const s = serializeDayItem({
      id: 'x', tenant_id: null, day: new Date('2026-10-11T00:00:00Z'),
      sort_order: 1, kind: 'pengumuman', event_id: null, title: 'HUT', body: null,
      owner: 'MC', minutes: 10, note: null,
    });
    expect(s.day).toBe('2026-10-11');
    expect(s.kind).toBe('pengumuman');
  });
});

describe('batas ibadah doa-buka/tutup (paritas server-klien)', () => {
  const cases: Array<[{ kind: string }[], string[]]> = [
    [[{ kind: 'doa' }, { kind: 'lagu' }, { kind: 'doa' }], []],
    [[{ kind: 'lagu' }, { kind: 'doa' }], []],
    [[{ kind: 'pengumuman' }, { kind: 'doa' }], ['Momen pertama bukan doa/lagu buka.']],
    [[{ kind: 'doa' }, { kind: 'lagu' }], ['Momen terakhir bukan doa tutup/berkat.']],
    [[{ kind: 'mc' }, { kind: 'persembahan' }], [
      'Momen pertama bukan doa/lagu buka.',
      'Momen terakhir bukan doa tutup/berkat.',
    ]],
    [[], []],
  ];
  it.each(cases)('%j → %j', (items, expected) => {
    expect(orderBoundaryWarnings(items)).toEqual(expected);
    expect(clientWarnings(items)).toEqual(expected);
  });
});
