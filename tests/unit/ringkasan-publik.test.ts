import { describe, expect, it } from 'vitest';
import { tabFromHash } from '../../src/app/routes';
import { originDateFor } from '../../server/lib/service-overrides.mjs';
import { weekIndexForDate } from '../../server/lib/penatalayan-access.mjs';
import { publishedOnPublishDoc } from '../../server/routes/didaskalia-studio.mjs';
import { isArchiveVisible } from '../../server/routes/drive-ownership.mjs';

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

describe('ringkasan publik: publish khutbah = terbit', () => {
  it('khutbah/pembekalan/rhb menandai PUBLISHED; doc lain tidak', () => {
    expect(publishedOnPublishDoc('khutbah')).toBe(true);
    expect(publishedOnPublishDoc('pembekalan')).toBe(true);
    expect(publishedOnPublishDoc('rhb')).toBe(true);
    expect(publishedOnPublishDoc('draf')).toBe(false);
    expect(publishedOnPublishDoc('')).toBe(false);
  });
});

describe('ringkasan publik: visibilitas arsip', () => {
  const ring = { ym: '2026-10', week: 3 };
  it('planning (25 Okt) + hari-H + tanpa ringkasan: sembunyi', () => {
    expect(isArchiveVisible({ date: '2026-10-25', ringkasan: ring }, '2026-10-16')).toBe(false);
    expect(isArchiveVisible({ date: '2026-10-16', ringkasan: ring }, '2026-10-16')).toBe(false);
    expect(isArchiveVisible({ date: '2026-10-04', ringkasan: null }, '2026-10-16')).toBe(false);
  });

  it('lampau + published: tampil; tanggal tak valid: sembunyi', () => {
    expect(isArchiveVisible({ date: '2026-10-04', ringkasan: ring }, '2026-10-16')).toBe(true);
    expect(isArchiveVisible({ date: '', ringkasan: ring }, '2026-10-16')).toBe(false);
    expect(isArchiveVisible(null, '2026-10-16')).toBe(false);
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
