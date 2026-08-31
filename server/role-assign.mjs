import crypto from 'node:crypto';
import { getPrisma } from './db.mjs';

export function genId64() {
  return crypto.randomBytes(32).toString('hex');
}

export function mapPlacementRoleToPrisma(role) {
  if (role === 'COMENTOR') return 'CO_MENTOR';
  return role;
}

export function mapFamilyRole(role) {
  const map = { MENTOR: 'MENTOR', CO_MENTOR: 'COMENTOR', COMENTOR: 'COMENTOR', MENTEE: 'MENTEE' };
  return map[role] || 'MENTEE';
}

export async function assignRoleToUser(prisma, {
  userId,
  role,
  groupId = null,
  position = null,
  division = null,
  subdivision = null,
  familyRole = null,
  assignedBy,
  note = null,
  updateOnboarding = true,
}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User tidak ditemukan.');

  if (groupId && ['MENTOR', 'CO_MENTOR', 'MENTEE'].includes(role)) {
    const existing = await prisma.roleAssignment.findFirst({
      where: {
        userId,
        groupId,
        isActive: true,
        role: { in: ['MENTOR', 'CO_MENTOR', 'MENTEE'] },
      },
    });
    if (existing) throw new Error('User sudah punya role aktif di grup ini.');
  }

  const resolvedFamilyRole = familyRole || (groupId ? mapFamilyRole(role) : role === 'MENTEE' ? 'MENTEE' : null);

  const assignment = await prisma.roleAssignment.create({
    data: {
      id: genId64(),
      userId,
      role,
      position: position || null,
      division: division || null,
      subdivision: subdivision || null,
      groupId: groupId || null,
      familyRole: resolvedFamilyRole,
      assignedBy,
      note: note || null,
      isActive: true,
    },
  });

  const existingUserRole = await prisma.userRole.findFirst({
    where: { userId, role, groupId: groupId || null },
  });

  let userRole;
  if (existingUserRole) {
    userRole = await prisma.userRole.update({
      where: { id: existingUserRole.id },
      data: { assignmentId: assignment.id },
    });
  } else {
    userRole = await prisma.userRole.create({
      data: {
        userId,
        tenantId: 'tenant-youth',
        role,
        groupId: groupId || null,
        assignmentId: assignment.id,
      },
    });
  }

  if (groupId && ['MENTOR', 'CO_MENTOR', 'MENTEE'].includes(role)) {
    const memberFamilyRole = mapFamilyRole(role);
    const existingMember = await prisma.groupMember.findFirst({
      where: { userId, groupId },
    });
    if (!existingMember) {
      await prisma.groupMember.create({
        data: {
          id: genId64(),
          groupId,
          userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          familyRole: memberFamilyRole,
          assignmentId: assignment.id,
        },
      });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { isBeyonders: true },
    });
  }

  if (updateOnboarding) {
    await prisma.waitingPool.updateMany({
      where: { userId },
      data: { status: 'ROLE_ASSIGNED' },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingStatus: 'ACTIVE' },
    });
  }

  return { assignment, userRole };
}
