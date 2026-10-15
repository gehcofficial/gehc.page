import { describe, expect, it } from 'vitest';
import { tabFromHash } from '../../src/app/routes';
import { originDateFor } from '../../server/lib/service-overrides.mjs';
import { weekIndexForDate } from '../../server/lib/penatalayan-access.mjs';

const GESER = new Map([['2026-10-18', { condition: 'GESER', newEventDate: '2026-10-17' }]]);

describe('ringkasan publik: routing hash', () => {
  it('#/ringkasan/:ym/:week → tab ringkasan', () => {
    expect(tabFromHash('#/ringkasan/2026-10/3')).toBe('ringkasan');
  });

  it('hash lain tak terpengaruh', () => {
    expect(tabFromHash('#/bulletin')).toBe('bulletin');
    expect(tabFromHash('#/warta')).toBe('bulletin');
  });
});

describe('ringkasan publik: event → pekan materi (GESER-aware)', () => {
  it('event 17 Okt (geser 18→17) → origin 2026-10/W3', () => {
    const origin = originDateFor('2026-10-17', GESER);
    expect(origin).toBe('2026-10-18');
    expect(weekIndexForDate(`${origin}T00:00:00.000Z`)).toEqual({ yearMonth: '2026-10', weekIndex: 3 });
  });

  it('tanpa override → pekan kalender', () => {
    const origin = originDateFor('2026-10-11', new Map());
    expect(weekIndexForDate(`${origin}T00:00:00.000Z`)).toEqual({ yearMonth: '2026-10', weekIndex: 2 });
  });
});
