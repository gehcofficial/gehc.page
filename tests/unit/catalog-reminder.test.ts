import { describe, expect, it } from 'vitest';
import {
  catalogReminderCopy,
  catalogReminderHref,
  institutionListQuery,
  uniqueUserIds,
} from '../../server/lib/catalog-reminder.mjs';

describe('institutionListQuery', () => {
  it('returns empty without q or id so the client never dumps the catalog', () => {
    expect(institutionListQuery({})).toEqual({ mode: 'empty' });
    expect(institutionListQuery({ q: 'U' })).toEqual({ mode: 'empty' });
  });

  it('searches when q has at least 2 characters', () => {
    expect(institutionListQuery({ q: 'UI' })).toEqual({ mode: 'search', q: 'UI', take: 40 });
  });

  it('looks up a single id', () => {
    expect(institutionListQuery({ id: 'inst-president' })).toEqual({ mode: 'id', id: 'inst-president' });
  });
});

describe('catalog reminder', () => {
  it('points minat to recreational profile section', () => {
    expect(catalogReminderHref('recreational')).toContain('section=recreational');
    expect(catalogReminderCopy('recreational', 'Futsal').title).toMatch(/Minat/i);
  });

  it('points kampus to life profile section', () => {
    expect(catalogReminderHref('institution')).toContain('section=life');
    expect(catalogReminderCopy('institution', 'President University').message).toMatch(/President/);
  });

  it('dedupes requester ids for a single map', () => {
    expect(uniqueUserIds(['a', 'a', '', 'b'])).toEqual(['a', 'b']);
  });
});
