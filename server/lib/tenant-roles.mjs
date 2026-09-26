/**
 * Scoping peran per tenant/unit (F3.2).
 *
 * Aturan: sebuah peran berlaku di portal unit X bila:
 *   - peran itu milik tenant X (unit itu), ATAU
 *   - peran itu milik `tenant-jemaat` (peran payung — berlaku lintas unit), ATAU
 *   - peran itu SUPERADMIN.
 *
 * Server memakai hasil scoping ini sebagai `req.authUser.roles`, sehingga semua
 * pemakaian `requireRole()` / `globalRoles()` otomatis menjadi per-unit tanpa
 * menyentuh ratusan call-site. Daftar penuh tetap tersedia di `rolesAll`.
 *
 * Fallback aman: bila tidak ada peran scoped, semua peran dipertahankan (longgar)
 * sampai migrasi peran per BIPRA (F3.3) selesai — mencegah unit terkunci.
 */

export const JEMAAT_TENANT_ID = 'tenant-jemaat';

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
 *   - `roles`    = peran yang berlaku di tenant aktif,
 *   - `rolesScoped` = true bila benar-benar terfilter (bukan fallback).
 */
export function applyTenantScope(user, tenantId) {
  if (!user) return user;
  const all = user.roles || [];
  const scoped = rolesInTenant(all, tenantId);
  const useFallback = scoped.length === 0 && all.length > 0;
  user.rolesAll = all;
  user.roles = useFallback ? all : scoped;
  user.rolesScoped = all.length > 0 && !useFallback;
  return user;
}
