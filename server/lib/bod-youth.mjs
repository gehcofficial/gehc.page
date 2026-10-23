/**
 * BOD Youth (Tim Kerja) — COMMITTEE dengan OrgAssignment di pohon TIMKERJA_BOD
 * (domain YOUTH), atau RoleAssignment.division = TIMKERJA secara eksplisit.
 *
 * Celah lama (COMMITTEE + strukturMember kosong dianggap BOD) ditutup di sini.
 */
import { getPrisma } from '../db.mjs';

function globalRoles(authUser) {
  return (authUser?.roles || []).map((r) => r.role);
}

/**
 * @param {{ id?: string, roles?: Array<{ role: string }> }} authUser
 * @returns {Promise<boolean>}
 */
export async function isYouthBodCommittee(authUser) {
  if (!authUser?.id) return false;
  const roles = globalRoles(authUser);
  if (!roles.includes('COMMITTEE')) return false;

  const prisma = getPrisma();
  if (!prisma) return false;

  try {
    const bodBranch = await prisma.orgNode.findFirst({
      where: { domain: 'YOUTH', slug: 'TIMKERJA_BOD', isActive: true },
      select: { id: true },
    });
    if (bodBranch) {
      const bodNodes = await prisma.orgNode.findMany({
        where: {
          domain: 'YOUTH',
          isActive: true,
          OR: [{ id: bodBranch.id }, { parentId: bodBranch.id }],
        },
        select: { id: true },
      });
      const nodeIds = bodNodes.map((n) => n.id);
      if (nodeIds.length) {
        const assign = await prisma.orgAssignment.findFirst({
          where: { userId: authUser.id, isActive: true, orgNodeId: { in: nodeIds } },
          select: { id: true },
        });
        if (assign) return true;
      }
    }

    const ra = await prisma.roleAssignment.findFirst({
      where: { userId: authUser.id, isActive: true, role: 'COMMITTEE' },
      select: { division: true },
    });
    const div = String(ra?.division || '').toUpperCase();
    return div === 'TIMKERJA';
  } catch {
    return false;
  }
}
