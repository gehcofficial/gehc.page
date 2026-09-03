import { describe, expect, it } from 'vitest';
import { normalizeGifts, giftLabels } from '../../src/lib/gifts';

describe('normalizeGifts', () => {
  it('menangani bentuk objek dari gift test — penyebab React error #31', () => {
    const raw = [
      { key: 'MERCY', label: 'Kemurahan', score: 12 },
      { key: 'TEACHING', label: 'Mengajar', score: 10 },
    ];
    expect(normalizeGifts(raw)).toEqual([
      { key: 'MERCY', label: 'Kemurahan', score: 12 },
      { key: 'TEACHING', label: 'Mengajar', score: 10 },
    ]);
  });

  it('menangani data lama berupa string biasa', () => {
    expect(normalizeGifts(['Kemurahan', 'Mengajar'])).toEqual([
      { key: 'gift-0', label: 'Kemurahan' },
      { key: 'gift-1', label: 'Mengajar' },
    ]);
  });

  it('jatuh ke key saat label tidak ada', () => {
    expect(normalizeGifts([{ key: 'MERCY' }])[0].label).toBe('MERCY');
  });

  it('tahan terhadap nilai non-array dan elemen kosong', () => {
    expect(normalizeGifts(null)).toEqual([]);
    expect(normalizeGifts(undefined)).toEqual([]);
    expect(normalizeGifts('bukan array')).toEqual([]);
    expect(normalizeGifts({})).toEqual([]);
    expect(normalizeGifts([null])).toEqual([{ key: 'gift-0', label: '' }]);
  });
});

describe('giftLabels', () => {
  it('selalu mengembalikan string yang aman dirender React', () => {
    const mixed = [
      { key: 'MERCY', label: 'Kemurahan', score: 12 },
      'Mengajar',
      { key: 'GIVING' },
      null,
    ];
    const labels = giftLabels(mixed);
    expect(labels).toEqual(['Kemurahan', 'Mengajar', 'GIVING']);
    for (const l of labels) expect(typeof l).toBe('string');
  });

  it('mengembalikan array kosong untuk input tak terduga', () => {
    expect(giftLabels(null)).toEqual([]);
    expect(giftLabels({ key: 'MERCY' })).toEqual([]);
  });
});
