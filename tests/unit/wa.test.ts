import { describe, it, expect } from 'vitest';
import { waDigits, waMeHref } from '../../src/lib/wa';

describe('waDigits', () => {
  it('normalisasi 0 → 62', () => {
    expect(waDigits('081234567890')).toBe('6281234567890');
  });
  it('buang spasi/tanda dan terima +62', () => {
    expect(waDigits('+62 812-3456-7890')).toBe('6281234567890');
  });
  it('null bila kosong / terlalu pendek', () => {
    expect(waDigits('')).toBeNull();
    expect(waDigits('123')).toBeNull();
    expect(waDigits(null)).toBeNull();
  });
});

describe('waMeHref', () => {
  it('membuat tautan wa.me dengan pesan', () => {
    expect(waMeHref('081234567890', 'Halo Budi')).toBe('https://wa.me/6281234567890?text=Halo%20Budi');
  });
  it('null bila nomor invalid', () => {
    expect(waMeHref('abc')).toBeNull();
  });
});
