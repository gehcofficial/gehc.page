import { describe, expect, it } from 'vitest';
import { normalizeGiftKey, normalizeGiftsTop5 } from '../../server/gift-normalize.mjs';

describe('normalizeGiftKey', () => {
  it('memetakan ID Indonesia ke nama kanonik Inggris', () => {
    expect(normalizeGiftKey('BELAS_KASIH')).toBe('Mercy');
    expect(normalizeGiftKey('PENGAJARAN')).toBe('Teaching');
    expect(normalizeGiftKey('KEPEMIMPINAN')).toBe('Leadership');
  });

  it('membiarkan nama yang sudah kanonik', () => {
    expect(normalizeGiftKey('Mercy')).toBe('Mercy');
    expect(normalizeGiftKey('Pastor/Shepherd')).toBe('Pastor/Shepherd');
  });

  it('membuka bentuk objek { key, label, score } dari gift test', () => {
    expect(normalizeGiftKey({ key: 'BELAS_KASIH', label: 'Belas Kasih', score: 12 })).toBe('Mercy');
    expect(normalizeGiftKey({ key: 'PENGAJARAN', label: 'Pengajaran', score: 9 })).toBe('Teaching');
  });

  it('jatuh ke label bila key tidak ada', () => {
    expect(normalizeGiftKey({ label: 'Mercy' })).toBe('Mercy');
  });

  it('mengembalikan null untuk objek tanpa key dan label', () => {
    expect(normalizeGiftKey({ score: 3 })).toBeNull();
  });
});

describe('normalizeGiftsTop5', () => {
  it('menghasilkan kunci yang cocok untuk kedua bentuk penyimpanan', () => {
    const fromGiftTest = [
      { key: 'BELAS_KASIH', label: 'Belas Kasih', score: 12 },
      { key: 'PENGAJARAN', label: 'Pengajaran', score: 10 },
    ];
    const fromLegacyStrings = ['BELAS_KASIH', 'PENGAJARAN'];
    expect(normalizeGiftsTop5(fromGiftTest)).toEqual(['Mercy', 'Teaching']);
    expect(normalizeGiftsTop5(fromLegacyStrings)).toEqual(['Mercy', 'Teaching']);
    // Inti bug: dua bentuk ini harus menghasilkan kunci identik supaya
    // giftCoverage dan giftsTop5 bisa saling cocok di engine penempatan.
    expect(normalizeGiftsTop5(fromGiftTest)).toEqual(normalizeGiftsTop5(fromLegacyStrings));
  });

  it('tidak lagi meloloskan objek yang ter-coerce jadi [object Object]', () => {
    const out = normalizeGiftsTop5([{ key: 'BELAS_KASIH', label: 'Belas Kasih', score: 12 }]);
    for (const g of out) {
      expect(typeof g).toBe('string');
      expect(g).not.toBe('[object Object]');
    }
  });

  it('membuang entri kosong dan menangani input non-array', () => {
    expect(normalizeGiftsTop5([])).toEqual([]);
    expect(normalizeGiftsTop5(null)).toEqual([]);
    expect(normalizeGiftsTop5([null, undefined, { score: 1 }])).toEqual([]);
  });
});
