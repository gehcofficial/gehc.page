/**
 * Scoping peran per tenant/unit (F3.2; ketat sejak F3.3).
 *
 * Aturan: sebuah peran berlaku di portal unit X bila:
 *   - peran itu milik tenant X (unit itu), ATAU
 *   - peran itu milik `tenant-jemaat` (peran payung — berlaku lintas unit), ATAU
 *   - peran itu SUPERADMIN.
 *
 * Server memakai hasil scoping ini sebagai `req.authUser.roles`, sehingga semua
 * pemakaian `requireRole()` / `globalRoles()` otomatis menjadi per-unit tanpa
 * menyentuh ratusan call-site. Daftar penuh tetap tersedia di `rolesAll`.
 */

import { JEMAAT_TENANT_ID } from './tenant-map.mjs';

export { JEMAAT_TENANT_ID };

export function isSuperadminRole(role) {
  return String(role || '') === 'SUPERADMIN';
}

/** Filter peran yang berlaku di tenant aktif. */
export function rolesInTenant(roles, tenantId) {
  return (roles || []).filter(
    (r) => r.tenantId === tenantId || r.tenantId === JEMAAT_TENANT_ID || isSuperadminRole(r.role),
  );
}

/**
 * Terapkan scoping ke objek user (mutasi):
 *   - `rolesAll` = seluruh peran (untuk role picker lintas unit),
 *   - `roles`    = peran yang berlaku di tenant aktif (ketat),
 *   - `rolesScoped` = true bila user punya peran (terfilter).
 */
export function applyTenantScope(user, tenantId) {
  if (!user) return user;
  const all = user.roles || [];
  user.rolesAll = all;
  user.roles = rolesInTenant(all, tenantId);
  user.rolesScoped = all.length > 0;
  return user;
}
