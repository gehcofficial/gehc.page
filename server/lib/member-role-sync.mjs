import crypto from 'node:crypto';
import { GEN0_PERIOD } from './beyonders-generation.mjs';

const BEYONDER_ROLES = ['MENTOR', 'CO_MENTOR', 'MENTEE'];

export const genSyncId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

export function mapFamilyRole(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'MENTOR') return 'MENTOR';
  if (r === 'CO_MENTOR' || r === 'COMENTOR') return 'COMENTOR';
  return 'MENTEE';
}

/** Period batch berjalan rumah (fallback foundedPeriod/GEN0). */
export async function currentPeriod(prisma, groupId) {
  const batch = await prisma.groupBatch.findFirst({
    where: { groupId, isCurrent: true },
    orderBy: { period: 'desc' },
  });
  if (batch?.period) return batch.period;
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { foundedPeriod: true } });
  return group?.foundedPeriod || GEN0_PERIOD;
}

export async function refreshGroupCounts(prisma, groupIds) {
  const ids = [...new Set((Array.isArray(groupIds) ? groupIds : [groupIds]).filter(Boolean))];
  for (const groupId of ids) {
    const count = await prisma.groupMember.count({ where: { groupId, status: 'ACTIVE' } });
    await prisma.group.update({ where: { id: groupId }, data: { memberCount: count } }).catch(() => {});
  }
}

async function upsertUserRole(prisma, userId, role, groupId, assignmentId) {
  const existing = await prisma.userRole.findFirst({ where: { userId, role, groupId: groupId || null } });
  if (existing) {
    await prisma.userRole.update({ where: { id: existing.id }, data: { assignmentId } });
  } else {
    await prisma.userRole.create({
      data: { userId, tenantId: 'tenant-youth', role, groupId: groupId || null, assignmentId },
    });
  }
}

async function updateBatchLeader(prisma, groupId, familyRole, user, period) {
  const where = period
    ? { groupId, period }
    : { groupId, isCurrent: true };
  const batch = await prisma.groupBatch.findFirst({ where, orderBy: { period: 'desc' } });
  if (!batch) return;
  const data = {};
  if (familyRole === 'MENTOR') {
    data.mentorName = user?.name || 'TBD';
    data.mentorUserId = user?.id || null;
  } else if (familyRole === 'COMENTOR') {
    data.comentorName = user?.name || null;
    data.comentorUserId = user?.id || null;
  } else return;
  await prisma.groupBatch.update({ where: { id: batch.id }, data });
}

/**
 * Tempatkan seseorang ke role grup (pindah penuh — tanpa peran ganda).
 * Sinkron: RoleAssignment + UserRole + GroupMember(period) + GroupBatch + user flags.
 */
export async function placePerson(prisma, { userId, groupId, role, familyRole, period, assignedBy, note, reason }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User tidak ditemukan.');
  const usePeriod = period || (await currentPeriod(prisma, groupId));
  const fam = familyRole || mapFamilyRole(role);
  const assignedByUser = await prisma.user.findFirst({ where: { id: assignedBy } });
  const assignedById = assignedByUser?.id || assignedBy || null;

  // 1. Lepas semua peran Beyonders lain (tanpa peran ganda).
  const others = await prisma.roleAssignment.findMany({
    where: { userId, isActive: true, groupId: { not: null }, role: { in: BEYONDER_ROLES } },
  });
  for (const ra of others) {
    await prisma.roleAssignment.update({ where: { id: ra.id }, data: { isActive: false } });
    await prisma.userRole.deleteMany({ where: { userId, role: ra.role, groupId: ra.groupId } });
    if (ra.groupId === groupId) {
      // Sama grup: baris generasi lama jadi PAST (history), bukan dihapus.
      await prisma.groupMember.updateMany({
        where: { userId, groupId, status: 'ACTIVE', batchPeriod: { not: usePeriod } },
        data: { status: 'PAST' },
      });
    } else {
      await prisma.groupMember.updateMany({
        where: { userId, groupId: ra.groupId, status: 'ACTIVE' },
        data: { status: 'MOVED', movedToGroupId: groupId },
      });
      // Bersihkan nama pemimpin di batch grup lama bila dia pemimpin.
      const oldBatch = await prisma.groupBatch.findFirst({ where: { groupId: ra.groupId, isCurrent: true } });
      if (oldBatch) {
        const data = {};
        if (oldBatch.mentorUserId === userId) { data.mentorName = 'TBD'; data.mentorUserId = null; }
        if (oldBatch.comentorUserId === userId) { data.comentorName = null; data.comentorUserId = null; }
        if (Object.keys(data).length) await prisma.groupBatch.update({ where: { id: oldBatch.id }, data });
      }
    }
  }

  // 2. Buat assignment baru.
  const assignment = await prisma.roleAssignment.create({
    data: {
      id: genSyncId('ra'),
      userId,
      role: fam === 'MENTEE' ? 'MENTEE' : (fam === 'MENTOR' ? 'MENTOR' : 'CO_MENTOR'),
      groupId,
      familyRole: fam,
      assignedBy: assignedById,
      note: note || reason || null,
      isActive: true,
    },
  });
  await upsertUserRole(prisma, userId, assignment.role, groupId, assignment.id);

  // 3. Baris roster per generasi.
  const existing = await prisma.groupMember.findFirst({ where: { userId, groupId, batchPeriod: usePeriod } });
  if (existing) {
    await prisma.groupMember.update({
      where: { id: existing.id },
      data: { familyRole: fam, status: 'ACTIVE', assignmentId: assignment.id, movedToGroupId: null, name: user.name },
    });
  } else {
    await prisma.groupMember.create({
      data: {
        id: genSyncId('gm'),
        groupId,
        userId,
        batchPeriod: usePeriod,
        name: user.name,
        email: user.email,
        phone: user.phone,
        familyRole: fam,
        status: 'ACTIVE',
        assignmentId: assignment.id,
      },
    });
  }

  // 4. Batch leader fields.
  if (fam !== 'MENTEE') await updateBatchLeader(prisma, groupId, fam, user, usePeriod);

  // 5. User flags + onboarding.
  await prisma.user.update({
    where: { id: userId },
    data: { isBeyonders: true, isIndividuExplicit: false, onboardingStatus: 'ACTIVE' },
  });
  await prisma.waitingPool.updateMany({ where: { userId }, data: { status: 'ROLE_ASSIGNED' } });

  await refreshGroupCounts(prisma, [groupId]);
  return { assignment, period: usePeriod, familyRole: fam };
}

/**
 * Selaraskan satu baris roster (perubahan role/grup) ke RoleAssignment + UserRole.
 * Best-effort, dipakai oleh shuffle/mitosis/merge.
 */
export async function syncRosterRole(prisma, { userId, groupId, familyRole, assignedBy }) {
  if (!userId || !groupId) return null;
  const fam = mapFamilyRole(familyRole);
  const role = fam === 'MENTOR' ? 'MENTOR' : fam === 'COMENTOR' ? 'CO_MENTOR' : 'MENTEE';
  // Nonaktifkan assignment grup lain (tanpa peran ganda).
  const others = await prisma.roleAssignment.findMany({
    where: { userId, isActive: true, groupId: { not: null }, NOT: { groupId }, role: { in: BEYONDER_ROLES } },
  });
  for (const ra of others) {
    await prisma.roleAssignment.update({ where: { id: ra.id }, data: { isActive: false } });
  }
  const active = await prisma.roleAssignment.findFirst({ where: { userId, groupId, isActive: true, role: { in: BEYONDER_ROLES } } });
  let assignment = active;
  if (assignment && assignment.role !== role) {
    await prisma.roleAssignment.update({ where: { id: assignment.id }, data: { isActive: false } });
    assignment = null;
  }
  if (!assignment) {
    assignment = await prisma.roleAssignment.create({
      data: {
        id: genSyncId('ra'),
        userId,
        role,
        groupId,
        familyRole: fam,
        assignedBy: assignedBy || null,
        note: 'Sync roster',
        isActive: true,
      },
    });
    await upsertUserRole(prisma, userId, role, groupId, assignment.id);
  }
  await prisma.groupMember.updateMany({
    where: { userId, groupId, status: 'ACTIVE' },
    data: { assignmentId: assignment.id, familyRole: fam },
  });
  return assignment;
}

/**
 * Tandai alumni (bulk) per generasi: roster ALUMNI + opsi cabut akses grup.
 */
export async function markAlumniBulk(prisma, { userIds, period, note, revokeRole = true }) {
  const ids = [...new Set((userIds || []).map(String).filter(Boolean))];
  let updated = 0;
  for (const userId of ids) {
    const rows = await prisma.groupMember.findMany({
      where: { userId, status: 'ACTIVE', ...(period ? { batchPeriod: period } : {}) },
      select: { id: true, groupId: true },
    });
    for (const row of rows) {
      await prisma.groupMember.update({
        where: { id: row.id },
        data: { status: 'ALUMNI', alumniDate: new Date(), alumniNote: note || null },
      });
      updated += 1;
    }
    if (revokeRole) {
      const ras = await prisma.roleAssignment.findMany({
        where: { userId, isActive: true, groupId: { not: null }, role: { in: BEYONDER_ROLES } },
      });
      for (const ra of ras) {
        await prisma.roleAssignment.update({ where: { id: ra.id }, data: { isActive: false } });
        await prisma.userRole.deleteMany({ where: { userId, role: ra.role, groupId: ra.groupId } });
      }
    }
    await prisma.user.update({ where: { id: userId }, data: { memberStatus: 'ALUMNI', isBeyonders: false } }).catch(() => {});
    await refreshGroupCounts(prisma, rows.map((r) => r.groupId));
  }
  return { updated, users: ids.length };
}

/**
 * Bawa anggota ACTIVE generasi sebelumnya ke period baru.
 * - Alumni/nonaktif dilewati. Yang pindah grup dilewati (ditandai MOVED).
 * - Baris generasi lama ACTIVE → PAST.
 */
export async function carryActiveMembers(prisma, { period, groupIds, dryRun = false }) {
  const targets = [...new Set((groupIds || []).map(String).filter(Boolean))];
  const summary = { groups: targets.length, carried: 0, skippedMoved: 0, alumni: 0, dryRun, details: [] };

  for (const groupId of targets) {
    // Generasi berjalan grup (period terbaru sebelum period baru).
    const rows = await prisma.groupMember.findMany({
      where: { groupId, batchPeriod: { not: null, notIn: [period] } },
      orderBy: { batchPeriod: 'desc' },
    });
    const latest = rows[0]?.batchPeriod;
    const currentGen = rows.filter((r) => r.batchPeriod === latest);

    for (const row of currentGen) {
      if (!row.userId) continue;
      if (row.status === 'ALUMNI') { summary.alumni += 1; continue; }
      if (row.status !== 'ACTIVE') continue;

      const activeRa = await prisma.roleAssignment.findFirst({
        where: { userId: row.userId, isActive: true, groupId: { not: null }, role: { in: BEYONDER_ROLES } },
      });
      const stillHere = activeRa && activeRa.groupId === groupId;
      if (!stillHere) {
        summary.skippedMoved += 1;
        if (!dryRun) {
          await prisma.groupMember.update({
            where: { id: row.id },
            data: { status: 'MOVED', movedToGroupId: activeRa?.groupId || null },
          });
        }
        continue;
      }

      summary.carried += 1;
      summary.details.push({ groupId, userId: row.userId, name: row.name, familyRole: row.familyRole });
      if (dryRun) continue;

      const existing = await prisma.groupMember.findFirst({ where: { userId: row.userId, groupId, batchPeriod: period } });
      if (!existing) {
        await prisma.groupMember.create({
          data: {
            id: genSyncId('gm'),
            groupId,
            userId: row.userId,
            batchPeriod: period,
            name: row.name,
            email: row.email,
            phone: row.phone,
            familyRole: row.familyRole,
            status: 'ACTIVE',
            assignmentId: row.assignmentId,
          },
        });
      }
      await prisma.groupMember.update({ where: { id: row.id }, data: { status: 'PAST' } });
    }
  }

  if (!dryRun) await refreshGroupCounts(prisma, targets);
  return summary;
}
