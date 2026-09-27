import { describe, it, expect } from 'vitest';
import { BZP_PETTY_CODE, UNIT_ACCOUNTS, csvCell, monthRange, toCsv } from '../../server/lib/church-cash.mjs';

describe('church-cash — katalog akun', () => {
  it('punya akun jemaat + 6 unit + petty BZP', () => {
    const codes = UNIT_ACCOUNTS.map((a) => a.code);
    expect(codes).toContain('KAS-JEMAAT');
    expect(codes).toContain('KAS-PEMUDA');
    expect(codes).toContain('KAS-KOLOM');
    expect(codes).toContain(BZP_PETTY_CODE);
    expect(UNIT_ACCOUNTS.find((a) => a.code === 'KAS-JEMAAT')?.kind).toBe('KAS_GEREJA');
    expect(UNIT_ACCOUNTS.find((a) => a.code === BZP_PETTY_CODE)?.kind).toBe('PETTY_CASH');
    // kode unik
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('church-cash — CSV', () => {
  it('escape sel berisi koma/quote/newline', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('toCsv: header + baris, dukung value()', () => {
    const csv = toCsv(
      [{ a: 1, b: 'x' }, { a: 2, b: 'y,z' }],
      [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { label: 'C', value: (r) => r.a * 10 }],
    );
    expect(csv.split('\r\n')).toEqual(['A,B,C', '1,x,10', '2,"y,z",20']);
  });

  it('toCsv aman untuk daftar kosong', () => {
    expect(toCsv([], [{ key: 'a', label: 'A' }])).toBe('A');
  });
});

describe('church-cash — rentang bulan', () => {
  it('YYYY-MM → from/to eksklusif', () => {
    const r = monthRange('2026-11');
    expect(r.ym).toBe('2026-11');
    expect(r.from.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(r.to.toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('bulan tak valid → bulan berjalan', () => {
    const r = monthRange('bogus');
    expect(r.ym).toMatch(/^\d{4}-\d{2}$/);
    expect(r.from.getUTCDate()).toBe(1);
  });
});
