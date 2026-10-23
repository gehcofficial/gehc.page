/**
 * RBAC tautan BOD penatalayan (Youth tenant).
 */
import { isSuperadminEmail } from '../auth.mjs';
import { isKomisiOrSuperadmin, isBodTimkerja, globalRoles } from '../division-rbac.mjs';

const FILL_ROLES = new Set(['MENTOR', 'CO_MENTOR', 'COMMITTEE', 'KOMISI', 'SUPERADMIN']);

const COORD_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];

/** Platform admin — selaras requireRole() (peran SUPERADMIN atau email SUPERADMIN_EMAILS). */
export function isPenatalayanSuperadmin(authUser) {
  if (!authUser) return false;
  if (globalRoles(authUser).includes('SUPERADMIN')) return true;
  return isSuperadminEmail(authUser.email);
}

/** Sama dengan isCoord di penatalayan-requests (antrean divisi). */
export function isPenatalayanCoordinator(authUser) {
  const roles = (authUser?.roles || []).map((r) => r.role);
  return roles.some((r) => COORD_ROLES.includes(r));
}

/** Divisi tempat user LEAD/CO_LEAD (event_division_members). */
export async function divisionHeadDivisions(prisma, userId) {
  const headDivs = new Set();
  if (!userId || !prisma) return headDivs;
  try {
    const heads = await prisma.eventDivisionMember.findMany({
      where: { userId, role: { in: ['LEAD', 'CO_LEAD'] } },
      include: { division: { select: { division: true } } },
      take: 20,
    });
    heads.forEach((h) => h.division?.division && headDivs.add(String(h.division.division).toUpperCase()));
  } catch { /* abaikan */ }
  return headDivs;
}

/** Boleh melihat inbox antrean divisi (selaras GET /api/penatalayan/requests). */
export async function canAccessDivisionInbox(authUser, prisma, division) {
  if (!authUser) return false;
  if (isPenatalayanSuperadmin(authUser)) return true;
  if (!division) return false;
  if (isPenatalayanCoordinator(authUser)) return true;
  if (await canManageBodLink(authUser)) return true;
  const div = String(division).toUpperCase();
  const headDivs = await divisionHeadDivisions(prisma, authUser.id);
  if (headDivs.has(div)) return true;
  return isDivisionHeadOf(prisma, authUser.id, div);
}

export function isBodCoordinator(authUser) {
  if (!authUser) return false;
  if (isKomisiOrSuperadmin(authUser)) return true;
  const roles = globalRoles(authUser);
  return roles.includes('COMMITTEE');
}

export async function canManageBodLink(authUser) {
  if (!authUser) return false;
  if (isPenatalayanSuperadmin(authUser)) return true;
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
async function mentorGroupIdsForUser(prisma, userId) {
  const ids = new Set();
  if (!prisma || !userId) return ids;
  try {
    const [assignments, memberships] = await Promise.all([
      prisma.roleAssignment.findMany({
        where: { userId, isActive: true, groupId: { not: null }, familyRole: { in: ['MENTOR', 'CO_MENTOR', 'COMENTOR'] } },
        select: { groupId: true },
      }).catch(() => []),
      prisma.groupMember.findMany({
        where: { userId, status: 'ACTIVE', familyRole: { in: ['MENTOR', 'COMENTOR'] } },
        select: { groupId: true },
      }).catch(() => []),
    ]);
    for (const r of [...assignments, ...memberships]) if (r.groupId) ids.add(String(r.groupId));
  } catch { /* abaikan */ }
  return ids;
}

/**
 * Boleh mengisi tautan BOD? Opsional filter domain HOST|RESPONSIBLE untuk mentor grup terkait.
 */
export async function canFillBodLink(authUser, prisma, link, domain) {
  if (!authUser || !link) return false;
  if (isPenatalayanSuperadmin(authUser)) return true;
  if (await canManageBodLink(authUser)) return true;
  const roles = globalRoles(authUser);
  if (roles.includes('COMMITTEE') || roles.includes('KOMISI')) return true;
  const dom = String(domain || '').toUpperCase();
  const mentorGroups = await mentorGroupIdsForUser(prisma, authUser.id);
  if (dom === 'HOST' || dom === 'RESPONSIBLE') {
    const target = dom === 'HOST' ? link.hostGroupId : link.responsibleGroupId;
    if (target && mentorGroups.has(String(target))) return true;
    const divs = dom === 'HOST' ? ['KOINONIA', 'DIAKONIA'] : ['LITURGIA', 'DIDASKALIA', 'MARTURIA'];
    for (const d of divs) {
      if (await isDivisionHeadOf(prisma, authUser.id, d)) return true;
    }
    return false;
  }
  if (roles.some((r) => FILL_ROLES.has(r))) {
    if (roles.includes('MENTOR') || roles.includes('CO_MENTOR')) {
      if (link.hostGroupId && mentorGroups.has(String(link.hostGroupId))) return true;
      if (link.responsibleGroupId && mentorGroups.has(String(link.responsibleGroupId))) return true;
    }
  }
  const divs = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'];
  for (const d of divs) {
    if (await isDivisionHeadOf(prisma, authUser.id, d)) return true;
  }
  return false;
}
