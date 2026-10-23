import { describe, expect, it } from 'vitest';
import { penatalayanBodLinkHash, penatalayanBodLinkUrl } from '../../src/lib/penatalayan-bod-link-ui';

describe('penatalayan BOD link UI helpers', () => {
  it('membangun hash dengan token ter-encode', () => {
    expect(penatalayanBodLinkHash('abc+def')).toContain('token=abc');
    expect(penatalayanBodLinkHash('tok123')).toBe('#/portal/mentor/penatalayan-tautan?token=tok123');
  });

  it('membangun URL absolut dari origin', () => {
    expect(penatalayanBodLinkUrl('x', 'https://staging-youth.gehc.page')).toBe(
      'https://staging-youth.gehc.page/#/portal/mentor/penatalayan-tautan?token=x',
    );
  });
});
