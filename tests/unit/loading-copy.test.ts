import { describe, expect, it } from 'vitest';
import {
  LOADING_APPEAR_DELAY_MS,
  LOADING_DEFAULT_TIMEOUT_MS,
  LOADING_FUN_DELAY_MS,
  isFunMode,
  isTimedOut,
  nextMessageIndex,
  shouldShowOverlay,
} from '../../src/lib/loading-copy';

describe('loading-copy (kontrak waktu overlay standar)', () => {
  it('overlay anti-flash: tampil setelah 300ms', () => {
    expect(LOADING_APPEAR_DELAY_MS).toBe(300);
    expect(shouldShowOverlay(0)).toBe(false);
    expect(shouldShowOverlay(299)).toBe(false);
    expect(shouldShowOverlay(300)).toBe(true);
  });

  it('mode playful aktif setelah 3 detik', () => {
    expect(LOADING_FUN_DELAY_MS).toBe(3000);
    expect(isFunMode(2999)).toBe(false);
    expect(isFunMode(3000)).toBe(true);
  });

  it('timeout default 20 detik dan dapat dikonfigurasi', () => {
    expect(LOADING_DEFAULT_TIMEOUT_MS).toBe(20000);
    expect(isTimedOut(19999)).toBe(false);
    expect(isTimedOut(20000)).toBe(true);
    expect(isTimedOut(15000, 15000)).toBe(true);
    expect(isTimedOut(14999, 15000)).toBe(false);
  });

  it('pesan playful berputar tanpa keluar batas', () => {
    expect(nextMessageIndex(0, 4)).toBe(1);
    expect(nextMessageIndex(3, 4)).toBe(0);
    expect(nextMessageIndex(0, 0)).toBe(0);
  });
});
