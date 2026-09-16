import { describe, it, expect } from 'vitest';
import { newBatchId } from '../../server/lib/beyonders-generation.mjs';

describe('newBatchId', () => {
  it('menyertakan group & periode serta sufiks acak', () => {
    const id = newBatchId('grp-1', '2026-07');
    expect(id.startsWith('batch-grp-1-2026-07-')).toBe(true);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it('unik antar pemanggilan (tidak menabrak PRIMARY)', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newBatchId('grp-3', '2026-09')));
    expect(ids.size).toBe(50);
  });

  it('tetap <= 64 char untuk groupId panjang', () => {
    const longGroup = 'grp-' + 'x'.repeat(80);
    const id = newBatchId(longGroup, '2026-07');
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id.startsWith('batch-2026-07-')).toBe(true);
  });
});
