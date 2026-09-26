/**
 * Peta BIPRA → tenant unit (F3.3).
 *
 * Dipakai migrasi peran (`server/_migrate-roles-per-tenant.cjs`) & helper lain.
 */

export const JEMAAT_TENANT_ID = 'tenant-jemaat';

/** BIPRA → tenant unit. */
export const BIPRA_TENANT = {
  PEMUDA: 'tenant-youth',
  REMAJA: 'tenant-teen',
  ANAK: 'tenant-kids',
  BAPAK: 'tenant-men',
  IBU: 'tenant-women',
};

/** Peran tingkat jemaat — berlaku lintas unit (pindah ke tenant-jemaat). */
export const JEMAAT_ROLES = ['SUPERADMIN', 'BPMJ'];

/**
 * Peran kepemimpinan/pelayanan unit yang relevan di semua jenis unit →
 * digandakan ke tenant BIPRA user. MENTOR/CO_MENTOR/MENTEE khusus Pemuda
 * (tidak digandakan).
 */
export const UNIT_LEAD_ROLES = ['KOMISI', 'COMMITTEE', 'ALUMNI'];

export function tenantForBipra(bipra) {
  if (!bipra) return null;
  return BIPRA_TENANT[String(bipra).toUpperCase()] || null;
}

/** tenant → BIPRA default (kebalikan BIPRA_TENANT). */
export const TENANT_BIPRA = Object.fromEntries(
  Object.entries(BIPRA_TENANT).map(([bipra, tenant]) => [tenant, bipra]),
);

/**
 * Keanggotaan unit (tier dasar) dari BIPRA/Kolom.
 *  - unit kategorial → `users.bipra` cocok dengan BIPRA tenant
 *  - `tenant-districts` (Kolom) → user punya `kolomId`
 *  - jemaat/community → bukan tier keanggotaan (false)
 */
export function isUnitMember(user, tenantId) {
  if (!user || !tenantId) return false;
  if (tenantId === 'tenant-districts') return Boolean(user.kolomId);
  const bipra = TENANT_BIPRA[tenantId];
  if (!bipra) return false;
  return String(user.bipra || '').toUpperCase() === bipra;
}

export function isJemaatRole(role) {
  return JEMAAT_ROLES.includes(String(role || '').toUpperCase());
}

export function isUnitLeadRole(role) {
  return UNIT_LEAD_ROLES.includes(String(role || '').toUpperCase());
}
