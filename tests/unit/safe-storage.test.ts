import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStoredJson, readStoredString, writeStored } from '../../src/lib/safe-storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safe-storage', () => {
  it('returns fallback when localStorage throws (Safari private / ITP)', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('QuotaExceededError');
        },
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    });
    expect(readStoredString('k', 'id')).toBe('id');
    expect(readStoredJson('k', { ok: true })).toEqual({ ok: true });
    expect(() => writeStored('k', 'v')).not.toThrow();
  });

  it('returns fallback for corrupt JSON', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '{not json',
        setItem: () => undefined,
      },
    });
    expect(readStoredJson('k', [1])).toEqual([1]);
  });
});
