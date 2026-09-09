import { describe, it, expect } from 'vitest';
import { formatSundayID, servicePrefix, formatServiceName, sundayInstant } from '../../server/lib/service-events.mjs';

describe('formatSundayID', () => {
  it('06 Sep 2026', () => {
    expect(formatSundayID('2026-09-06')).toBe('06 Sep 2026');
  });

  it('Mei dan Agu Indonesia', () => {
    expect(formatSundayID('2026-05-03')).toBe('03 Mei 2026');
    expect(formatSundayID('2026-08-30')).toBe('30 Agu 2026');
  });
});

describe('servicePrefix', () => {
  it('kolom mengalahkan bipra', () => {
    expect(servicePrefix('Pemuda', 'Kolom 5')).toBe('Ibadah Kolom 5');
  });

  it('default Pemuda', () => {
    expect(servicePrefix('Pemuda', '')).toBe('Ibadah Pemuda');
    expect(servicePrefix('', '')).toBe('Ibadah Pemuda');
  });
});

describe('formatServiceName', () => {
  it('pola Prefix: Tema - DD Mon YYYY', () => {
    expect(formatServiceName('Ibadah Pemuda', 'Hidup Kudus', '2026-09-06')).toBe(
      'Ibadah Pemuda: Hidup Kudus - 06 Sep 2026',
    );
  });

  it('tema kosong = string kosong', () => {
    expect(formatServiceName('Ibadah Pemuda', '  ', '2026-09-06')).toBe('');
  });
});

describe('sundayInstant', () => {
  it('instant valid dan null untuk input rusak', () => {
    expect(sundayInstant('2026-09-06')?.toISOString()).toBe('2026-09-06T00:00:00.000Z');
    expect(sundayInstant('ngaco')).toBeNull();
  });
});
