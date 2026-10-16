import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MdBlocks, parseMdLite } from '../../src/lib/md-lite';
import { tabFromHash } from '../../src/app/routes';
import { parseHashRoute } from '../../src/lib/hash-routes';
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

  it('#/arsip/:id → tab arsip', () => {
    expect(tabFromHash('#/arsip/evt-123')).toBe('arsip');
  });

  it('outline khotbah ter-render tanpa simbol mentah', () => {
    const excerpt = [
      '#### A. Pribadi yang Sempurna',
      '',
      '> *"Dia yang tidak mengenal dosa"* (2 Korintus 5:21)',
      '',
      'Manusia mencoba menambal jarak itu dengan **kesalehan diri**. Poin Utama bagi Anak Muda: statusmu berubah.',
      '',
      '* Satu',
      '* Dua',
    ].join('\n');
    const html = renderToStaticMarkup(
      React.createElement(MdBlocks, { blocks: parseMdLite(excerpt), tone: 'paper', density: 'compact' }),
    );
    expect(html).toContain('Pribadi yang Sempurna');
    expect(html).toContain('2 Korintus 5:21');
    expect(html).toContain('kesalehan diri');
    expect(html).not.toContain('**');
    expect(html).not.toContain('####');
    expect(html).not.toMatch(/>\s*\*/);
  });

  it('parser live (App): arsip + ringkasan tak jatuh ke landing', () => {
    expect(parseHashRoute('#/arsip/evt-123').tab).toBe('arsip');
    expect(parseHashRoute('#/ringkasan/2026-10/3').tab).toBe('ringkasan');
  });

  it('parser live (App): hash lama tak berubah', () => {
    expect(parseHashRoute('#/bulletin').tab).toBe('bulletin');
    expect(parseHashRoute('#/warta').tab).toBe('bulletin');
    expect(parseHashRoute('#/event/bakutau').tab).toBe('event-signup');
    expect(parseHashRoute('#/tak-dikenal').tab).toBe('beyonders');
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
  const ring = { ym: '2026-10', week: 3, published: false };
  it('planning (25 Okt) + hari-H: sembunyi; lampau tampil walau draf live', () => {
    expect(isArchiveVisible({ date: '2026-10-25', ringkasan: ring }, '2026-10-16')).toBe(false);
    expect(isArchiveVisible({ date: '2026-10-16', ringkasan: ring }, '2026-10-16')).toBe(false);
    expect(isArchiveVisible({ date: '2026-10-04', ringkasan: ring }, '2026-10-16')).toBe(true);
  });

  it('tanggal tak valid: sembunyi', () => {
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
