import { getPrisma } from '../db.mjs';
import { isKomisiOrSuperadmin, isBodTimkerja, globalRoles } from '../division-rbac.mjs';

export async function strukturDivision(authUser) {
  if (!authUser?.email) return '';
  try {
    const prisma = getPrisma();
    if (!prisma) return '';
    const sm = await prisma.strukturMember.findFirst({ where: { email: authUser.email } });
    return String(sm?.division || '').toUpperCase();
  } catch {
    return '';
  }
}

export async function isKoinoniaOperator(authUser) {
  if (!authUser) return false;
  if (isKomisiOrSuperadmin(authUser)) return true;
  if (await isBodTimkerja(authUser)) return true;
  const div = await strukturDivision(authUser);
  if (div === 'KOINONIA') return true;
  const prisma = getPrisma();
  if (!prisma || !authUser.id) return false;
  try {
    const ra = await prisma.roleAssignment.findFirst({
      where: { userId: authUser.id, isActive: true, division: 'KOINONIA' },
    });
    if (ra) return true;
    const member = await prisma.eventDivisionMember.findFirst({
      where: { userId: authUser.id, eventDivision: { division: 'KOINONIA' } },
    });
    return !!member;
  } catch {
    return false;
  }
}

export async function isDivisionStaff(authUser, division) {
  if (!authUser || !division) return false;
  if (isKomisiOrSuperadmin(authUser)) return true;
  if (await isBodTimkerja(authUser)) return true;
  const want = String(division).toUpperCase();
  const div = await strukturDivision(authUser);
  if (div === want) return true;
  const prisma = getPrisma();
  if (!prisma || !authUser.id) return false;
  try {
    const ra = await prisma.roleAssignment.findFirst({
      where: { userId: authUser.id, isActive: true, division: want },
    });
    return !!ra;
  } catch {
    return false;
  }
}

export async function mentoredGroupIds(authUser) {
  if (!authUser?.id) return [];
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    const [assignments, members] = await Promise.all([
      prisma.roleAssignment.findMany({
        where: {
          userId: authUser.id,
          isActive: true,
          groupId: { not: null },
          familyRole: { in: ['MENTOR', 'CO_MENTOR', 'COMENTOR'] },
        },
        select: { groupId: true },
      }),
      prisma.groupMember.findMany({
        where: {
          userId: authUser.id,
          status: 'ACTIVE',
          familyRole: { in: ['MENTOR', 'COMENTOR'] },
        },
        select: { groupId: true },
      }),
    ]);
    return [...new Set([...assignments, ...members].map((r) => r.groupId).filter(Boolean))];
  } catch {
    return [];
  }
}

export function isPortalStaff(authUser) {
  const roles = globalRoles(authUser);
  return roles.some((r) =>
    ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'BPMJ'].includes(r),
  );
}
