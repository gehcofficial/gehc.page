import { describe, expect, it } from 'vitest';
import { dayKeyOf, hasServingContent } from '../../src/components/portal/EventServiceDutyCard';
import { worshipStatusLabel } from '../../src/components/portal/EventWorshipCard';

describe('dayKeyOf', () => {
  it('mengambil tanggal WIB dari eventDate ISO', () => {
    // 2026-10-04T13:00:00+07:00 -> hari yang sama WIB
    expect(dayKeyOf('2026-10-04T13:00:00+07:00')).toBe('2026-10-04');
  });

  it('mengembalikan null untuk input kosong / invalid', () => {
    expect(dayKeyOf(null)).toBeNull();
    expect(dayKeyOf(undefined)).toBeNull();
    expect(dayKeyOf('bukan-tanggal')).toBeNull();
  });
});

describe('hasServingContent', () => {
  it('false bila semuanya kosong (kartu disembunyikan)', () => {
    expect(hasServingContent([], {})).toBe(false);
  });

  it('true bila ada petugas / penanggung / tuan rumah', () => {
    expect(hasServingContent([{ name: 'Ani' }], {})).toBe(true);
    expect(hasServingContent([], { responsible: 'Kairos' })).toBe(true);
    expect(hasServingContent([], { host: 'Shalom' })).toBe(true);
  });
});

describe('worshipStatusLabel', () => {
  it('memetakan status sesi ke label Indonesia', () => {
    expect(worshipStatusLabel('DRAFT')).toBe('Segera');
    expect(worshipStatusLabel('RUNNING')).toBe('Berlangsung');
    expect(worshipStatusLabel('CLOSED')).toBe('Selesai');
  });

  it('fallback ke status mentah bila tak dikenal', () => {
    expect(worshipStatusLabel('sesuatu')).toBe('sesuatu');
  });
});
