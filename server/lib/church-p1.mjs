/**
 * Konstanta & pemetaan P1 (Fasilitas & Keuangan) — murni, mudah diuji.
 */

export const UNIT_BY_TENANT = {
  'tenant-jemaat': 'JEMAAT',
  'tenant-youth': 'PEMUDA',
  'tenant-teen': 'REMAJA',
  'tenant-kids': 'ANAK',
  'tenant-men': 'BAPAK',
  'tenant-women': 'IBU',
  'tenant-districts': 'KOLOM',
  'tenant-community': 'KOMUNITAS',
};

export const BOOKING_STATUS = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DONE', 'CANCELLED'];
export const FACILITY_KINDS = ['GEDUNG', 'RUANG', 'ALAT'];
export const ACCOUNT_KINDS = ['KAS_GEREJA', 'KAS_UNIT', 'PETTY_CASH'];
export const CASH_DIRECTIONS = ['IN', 'OUT'];
export const FUNDING_ACTIONS = ['approve', 'reject', 'disburse', 'settle'];
export const DISTRIBUTION_STATUS = ['PROPOSED', 'APPROVED', 'PAID'];
export const DISTRIBUTION_SOURCES = ['BZP_CAMPAIGN', 'BZP_SALES', 'DONATION', 'OTHER'];

/** Kode unit dari tenant (default JEMAAT). */
export function unitOfTenant(tenantId) {
  return UNIT_BY_TENANT[tenantId] || 'JEMAAT';
}

/** Saldo akun = saldo awal + (IN − OUT). */
export function accountBalance(openingBalance, sums) {
  let delta = 0;
  for (const s of sums || []) {
    const amt = Number(s?.sum || 0);
    delta += String(s?.direction || '').toUpperCase() === 'IN' ? amt : -amt;
  }
  return Number(openingBalance || 0) + delta;
}
