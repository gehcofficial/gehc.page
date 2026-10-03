import { describe, expect, it } from 'vitest';
import {
  JEMAAT_PHOTO_MAX_PER_USER,
  isWithinUploadWindow,
  remainingQuota,
} from '../../server/lib/gallery-jemaat.mjs';

const DAY = 86400000;
const EVENT = new Date('2026-10-04T06:00:00Z').getTime();

describe('jendela upload foto jemaat (H-1..H+7)', () => {
  it('boleh H-1, H, dan H+7', () => {
    expect(isWithinUploadWindow(new Date(EVENT).toISOString(), EVENT - DAY)).toBe(true);
    expect(isWithinUploadWindow(new Date(EVENT).toISOString(), EVENT)).toBe(true);
    expect(isWithinUploadWindow(new Date(EVENT).toISOString(), EVENT + 7 * DAY)).toBe(true);
  });

  it('tolak H-2 dan H+8', () => {
    expect(isWithinUploadWindow(new Date(EVENT).toISOString(), EVENT - 2 * DAY)).toBe(false);
    expect(isWithinUploadWindow(new Date(EVENT).toISOString(), EVENT + 8 * DAY)).toBe(false);
  });

  it('tanpa tanggal → boleh (diatur call-site)', () => {
    expect(isWithinUploadWindow(null)).toBe(true);
    expect(isWithinUploadWindow('bukan-tanggal')).toBe(true);
  });
});

describe('kuota 5 foto/orang/event', () => {
  it('sisa berkurang hingga 0, tidak negatif', () => {
    expect(JEMAAT_PHOTO_MAX_PER_USER).toBe(5);
    expect(remainingQuota(0)).toBe(5);
    expect(remainingQuota(4)).toBe(1);
    expect(remainingQuota(5)).toBe(0);
    expect(remainingQuota(9)).toBe(0);
  });
});
