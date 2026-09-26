/**
 * Anggota unit (F3.5.3–F3.5.5) — daftar anggota per tenant/unit.
 *
 * Keanggotaan mengikuti BIPRA (kategorial) atau `kolomId` (Kolom teritorial).
 * PII (telepon/email) hanya untuk pengurus unit/jemaat.
 */
import { TENANT_BIPRA } from './tenant-map.mjs';

export const PII_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE'];

/** Filter Prisma `where` untuk anggota unit aktif. `{}` = semua anggota. */
export function unitMemberWhere(tenantId, { kolomId } = {}) {
  if (tenantId === 'tenant-districts') return { kolomId: kolomId || { not: null } };
  const bipra = TENANT_BIPRA[tenantId];
  if (!bipra) return {}; // jemaat/community → semua anggota
  return { bipra };
}

/** Boleh melihat kontak (telepon/email) anggota? */
export function canSeeMemberPii(roles) {
  const set = new Set((roles || []).map((r) => String(r?.role || r || '').toUpperCase()));
  return PII_ROLES.some((r) => set.has(r));
}

/** Kolom `select` Prisma untuk daftar anggota. */
export function memberSelect(includePii) {
  const select = {
    id: true,
    name: true,
    avatar: true,
    bipra: true,
    kolomId: true,
    membershipKind: true,
    memberStatus: true,
  };
  if (includePii) {
    select.phone = true;
    select.email = true;
  }
  return select;
}
