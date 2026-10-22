import { describe, expect, it } from 'vitest';
import { clientHasEtag, weakEtag } from '../../server/lib/http-cache.mjs';
import { nextUnchangedDelay } from '../../src/lib/visible-poll';

describe('etag poll', () => {
  it('etag stabil untuk potongan yang sama, termasuk bigint', () => {
    const a = weakEtag(['worship', 3n, new Date('2026-10-25T00:00:00.000Z')]);
    const b = weakEtag(['worship', 3n, new Date('2026-10-25T00:00:00.000Z')]);
    expect(a).toBe(b);
    expect(a.startsWith('W/"')).toBe(true);
    expect(weakEtag(['worship', 4n])).not.toBe(a);
  });

  it('If-None-Match cocok dengan etag lemah', () => {
    const etag = weakEtag(['x']);
    expect(clientHasEtag({ headers: { 'if-none-match': etag } }, etag)).toBe(true);
    expect(clientHasEtag({ headers: { 'if-none-match': 'W/"lain"' } }, etag)).toBe(false);
    expect(clientHasEtag({ headers: {} }, etag)).toBe(false);
  });

  it('jeda naik saat tidak berubah dan mentok di batas', () => {
    expect(nextUnchangedDelay(15000, 15000, 30000)).toBe(24000);
    expect(nextUnchangedDelay(24000, 15000, 30000)).toBe(30000);
    expect(nextUnchangedDelay(30000, 15000, 30000)).toBe(30000);
  });
});
