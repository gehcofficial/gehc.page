import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_KINDS,
  BOOKING_STATUS,
  FACILITY_KINDS,
  accountBalance,
  unitOfTenant,
} from '../../server/lib/church-p1.mjs';

describe('church-p1 — konstanta & pemetaan', () => {
  it('unit dari tenant', () => {
    expect(unitOfTenant('tenant-jemaat')).toBe('JEMAAT');
    expect(unitOfTenant('tenant-men')).toBe('BAPAK');
    expect(unitOfTenant('tenant-women')).toBe('IBU');
    expect(unitOfTenant('tenant-youth')).toBe('PEMUDA');
    expect(unitOfTenant('tenant-districts')).toBe('KOLOM');
    expect(unitOfTenant('bogus')).toBe('JEMAAT');
  });

  it('katalog konstanta', () => {
    expect(FACILITY_KINDS).toEqual(['GEDUNG', 'RUANG', 'ALAT']);
    expect(ACCOUNT_KINDS).toContain('KAS_UNIT');
    expect(BOOKING_STATUS).toContain('APPROVED');
    expect(BOOKING_STATUS).toContain('CANCELLED');
  });

  it('saldo akun = saldo awal + IN − OUT', () => {
    expect(accountBalance(100000, [{ direction: 'IN', sum: 50000 }, { direction: 'OUT', sum: 20000 }])).toBe(130000);
    expect(accountBalance(0, [])).toBe(0);
    expect(accountBalance('150000', [{ direction: 'OUT', sum: '50000' }])).toBe(100000);
  });
});
