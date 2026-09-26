/**
 * Scoping DATA per tenant/unit (F3.4).
 *
 * Aturan (sesuai keputusan pemilik):
 *   - Portal unit  → hanya data unit itu + data jemaat (`tenant-jemaat`).
 *   - Portal jemaat (hub) → semua data (tanpa filter).
 *
 * Dipakai pada tabel ber-`tenantId`: `EventProgram`, `ChurchCalendarEntry`,
 * `ChurchProgram`, `ContentItem`, `Testimonial`, `Group`, `UserRole`.
 *
 * Kebijakan: **daftar/list** difilter; **detail per-id** dibiarkan agar tautan
 * langsung (deep link) tetap bekerja. Penulisan baru menyegel `tenantId` aktif.
 */

import { resolveHostContext } from './host-context.mjs';
import { JEMAAT_TENANT_ID } from './tenant-map.mjs';

/** Tenant aktif dari host request (hub → tenant-jemaat). */
export function activeTenantId(req) {
  return resolveHostContext(req).tenantId;
}

/** True bila request dari portal jemaat (tanpa filter). */
export function isJemaatScope(req) {
  const t = activeTenantId(req);
  return !t || t === JEMAAT_TENANT_ID;
}

/**
 * Fragmen `where` Prisma untuk tabel ber-`tenantId`.
 * `null` = jemaat (tanpa filter); unit = `{ tenantId: { in: [unit, jemaat] } }`.
 */
export function tenantWhere(req) {
  const t = activeTenantId(req);
  if (!t || t === JEMAAT_TENANT_ID) return null;
  return { tenantId: { in: [t, JEMAAT_TENANT_ID] } };
}

/** Gabungkan filter tenant ke `where` lain (aman bila jemaat). */
export function withTenant(req, where = {}) {
  const tf = tenantWhere(req);
  return tf ? { ...where, ...tf } : where;
}

/** TenantId untuk penulisan baru (unit aktif; hub → tenant-jemaat). */
export function tenantForWrite(req) {
  return activeTenantId(req) || JEMAAT_TENANT_ID;
}

/**
 * Boleh mengakses baris dengan `rowTenantId`?
 * Jemaat (hub) → semua; unit → miliknya sendiri atau data jemaat.
 */
export function canAccessTenant(req, rowTenantId) {
  const t = activeTenantId(req);
  if (!t || t === JEMAAT_TENANT_ID) return true;
  return rowTenantId === t || rowTenantId === JEMAAT_TENANT_ID;
}
