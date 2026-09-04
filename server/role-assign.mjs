import crypto from 'node:crypto';

export function genId64() {
  return crypto.randomBytes(32).toString('hex');
}

export const PLATFORM_OPS_USER_ID = 'usr-platform-ops';

/** Akun sistem untuk FK assignedBy saat aksi dari platform operator (bukan user jemaat). */
export async function ensurePlatformOpsUser(prisma) {
  const existing = await prisma.user.findUnique({
    where: { id: PLATFORM_OPS_USER_ID },
    select: { id: true },
  });
  if (existing) {
    try {
      await prisma.user.update({
        where: { id: PLATFORM_OPS_USER_ID },
        data: { accountKind: 'SYSTEM_LEGACY', name: 'Platform Ops', isBeyonders: false },
      });
    } catch {
      /* kolom belum ada */
    }
    return existing.id;
  }
  await prisma.user.create({
    data: {
      id: PLATFORM_OPS_USER_ID,
      name: 'Platform Ops',
      email: null,
      loginUsername: 'platform.ops',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'ACTIVE',
      onboardingPath: 'INVITED',
      accountKind: 'SYSTEM_LEGACY',
      authProvider: 'LOCAL',
      linkStatus: 'UNLINKED',
      isBeyonders: false,
      bipra: 'PEMUDA',
    },
  });
  return PLATFORM_OPS_USER_ID;
}

export async function resolveAssignedByUserId(prisma, candidate) {
  const id = String(candidate || '').trim();
  if (id) {
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (u) return u.id;
  }
  return ensurePlatformOpsUser(prisma);
}

export function mapPlacementRoleToPrisma(role) {
  if (role === 'COMENTOR') return 'CO_MENTOR';
  return role;
}

export function mapFamilyRole(role) {
  const map = { MENTOR: 'MENTOR', CO_MENTOR: 'COMENTOR', COMENTOR: 'COMENTOR', MENTEE: 'MENTEE' };
  return map[role] || 'MENTEE';
}

/** Ensure group has a current batch; return { id, period }. */
export async function ensureCurrentBatch(prisma, groupId, { mentorName, comentorName } = {}) {
  let batch = await prisma.groupBatch.findFirst({
    where: { groupId, isCurrent: true },
    orderBy: { period: 'desc' },
  });
  if (batch) {
    const data = {};
    if (mentorName) data.mentorName = mentorName;
    if (comentorName) data.comentorName = comentorName;
    if (Object.keys(data).length) {
      batch = await prisma.groupBatch.update({ where: { id: batch.id }, data });
    }
    return batch;
  }

  const period = new Date().toISOString().slice(0, 7);
  return prisma.groupBatch.create({
    data: {
      id: `batch-${groupId}-${period}`.slice(0, 64),
      groupId,
      period,
      mentorName: mentorName || 'TBD',
      comentorName: comentorName || null,
      batchLabel: `Batch ${period}`,
      isCurrent: true,
    },
  });
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

  const assignerId = await resolveAssignedByUserId(prisma, assignedBy);

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
      assignedBy: assignerId,
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
    const batch = await ensureCurrentBatch(prisma, groupId, {
      mentorName: role === 'MENTOR' ? user.name : undefined,
      comentorName: role === 'CO_MENTOR' ? user.name : undefined,
    });

    if (role === 'MENTOR') {
      await prisma.groupBatch.update({
        where: { id: batch.id },
        data: { mentorName: user.name },
      });
    } else if (role === 'CO_MENTOR') {
      await prisma.groupBatch.update({
        where: { id: batch.id },
        data: { comentorName: user.name },
      });
    }

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
          batchPeriod: batch.period,
          assignmentId: assignment.id,
          status: 'ACTIVE',
        },
      });
    } else {
      await prisma.groupMember.update({
        where: { id: existingMember.id },
        data: {
          familyRole: memberFamilyRole,
          batchPeriod: batch.period,
          assignmentId: assignment.id,
          status: 'ACTIVE',
          name: user.name,
        },
      });
    }

    const count = await prisma.groupMember.count({
      where: { groupId, status: 'ACTIVE' },
    });
    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: count },
    });

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

  try {
    const roleLabel = position || role;
    await prisma.notification.create({
      data: {
        id: genId64(),
        type: 'ROLE_ASSIGNED',
        memberId: userId,
        groupId: groupId || null,
        title: 'Peran baru ditugaskan',
        message: `Kamu mendapat peran ${roleLabel}. Buka portal untuk melihat konteks peran aktif.`,
        payload: { role, position, division, subdivision, groupId, assignedBy },
        status: 'OPEN',
      },
    });
  } catch (e) {
    console.warn('[role-assign] notifikasi ROLE_ASSIGNED gagal:', e?.message || e);
  }

  return { assignment, userRole };
}

/** Revoke role assignment + UserRole + GroupMember + linked OrgAssignment. */
export async function revokeRoleAssignment(prisma, roleAssignmentId) {
  const assignment = await prisma.roleAssignment.findUnique({ where: { id: roleAssignmentId } });
  if (!assignment) throw new Error('Assignment tidak ditemukan.');

  await prisma.roleAssignment.update({
    where: { id: roleAssignmentId },
    data: { isActive: false },
  });

  await prisma.userRole.deleteMany({
    where: { userId: assignment.userId, role: assignment.role, groupId: assignment.groupId },
  });

  if (assignment.groupId && ['MENTOR', 'CO_MENTOR', 'MENTEE'].includes(assignment.role)) {
    await prisma.groupMember.deleteMany({
      where: { userId: assignment.userId, groupId: assignment.groupId },
    });
  }

  await prisma.orgAssignment.updateMany({
    where: { roleAssignmentId, isActive: true },
    data: { isActive: false },
  });

  return { ok: true, assignment };
}
