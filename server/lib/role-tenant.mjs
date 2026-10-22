import { JEMAAT_ROLES, JEMAAT_TENANT_ID } from './tenant-map.mjs';
import { YOUTH_TENANT_ID } from './tenant-defaults.mjs';

/**
 * Tenant untuk baris UserRole baru.
 * Peran payung (SUPERADMIN/BPMJ) → jemaat.
 * Ada grup → tenant grup itu.
 * Selain itu → tenant eksplisit (host). Tanpa keduanya, fallback historis Pemuda.
 */
export async function resolveRoleTenant(prisma, { role = null, groupId = null, fallbackTenant = null } = {}) {
  if (JEMAAT_ROLES.includes(String(role || ''))) return JEMAAT_TENANT_ID;
  if (groupId && prisma?.group?.findUnique) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { tenantId: true },
    }).catch(() => null);
    if (group?.tenantId) return group.tenantId;
  }
  return fallbackTenant || YOUTH_TENANT_ID;
}

/**
 * Simpan peran undangan di tenant host.
 * Baris boleh ada saat akun masih PENDING supaya persetujuan Komisi
 * (hanya mengubah accountStatus) langsung berlaku. requireRole menolak
 * akun yang belum ACTIVE, jadi peran ini belum memberi akses.
 */
export async function grantRoleOnTenant(prisma, user, { role, tenantId }) {
  const roles = user.roles || [];
  if (roles.some((r) => r.role === role && r.tenantId === tenantId)) return user;
  await prisma.userRole.create({ data: { userId: user.id, tenantId, role } });
  user.roles = [...roles, { userId: user.id, tenantId, role }];
  return user;
}
