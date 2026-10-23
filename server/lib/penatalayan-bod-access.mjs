/**
 * RBAC tautan BOD penatalayan (Youth tenant).
 */
import { isKomisiOrSuperadmin, isBodTimkerja, globalRoles } from '../division-rbac.mjs';

const FILL_ROLES = new Set(['MENTOR', 'CO_MENTOR', 'COMMITTEE', 'KOMISI', 'SUPERADMIN']);

export function isBodCoordinator(authUser) {
  if (!authUser) return false;
  if (isKomisiOrSuperadmin(authUser)) return true;
  const roles = globalRoles(authUser);
  return roles.includes('COMMITTEE');
}

export async function canManageBodLink(authUser) {
  if (!authUser) return false;
  if (isKomisiOrSuperadmin(authUser)) return true;
  const roles = globalRoles(authUser);
  if (!roles.includes('COMMITTEE')) return false;
  try {
    return await isBodTimkerja(authUser);
  } catch {
    return false;
  }
}

export async function isDivisionHeadOf(prisma, userId, division) {
  if (!userId || !division) return false;
  try {
    const row = await prisma.eventDivisionMember.findFirst({
      where: { userId, role: { in: ['LEAD', 'CO_LEAD'] }, division: { division: String(division).toUpperCase() } },
      select: { id: true },
    });
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Boleh mengisi usulan via tautan BOD?
 */
export async function canFillBodLink(authUser, prisma, link) {
  if (!authUser || !link) return false;
  if (await canManageBodLink(authUser)) return true;
  const roles = globalRoles(authUser);
  if (roles.some((r) => FILL_ROLES.has(r))) {
    if (roles.includes('MENTOR') || roles.includes('CO_MENTOR')) return true;
  }
  if (roles.includes('COMMITTEE') || roles.includes('KOMISI')) return true;
  const divs = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'];
  for (const d of divs) {
    if (await isDivisionHeadOf(prisma, authUser.id, d)) return true;
  }
  return false;
}
