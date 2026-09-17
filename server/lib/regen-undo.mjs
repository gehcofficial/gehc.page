import crypto from 'node:crypto';

/** 10 rumah induk (scope regenerasi). */
export const REGEN_HOME_IDS = ['grp-1', 'grp-2', 'grp-3', 'grp-4', 'grp-5', 'grp-6', 'grp-7', 'grp-8', 'grp-9', 'grp-10'];

const BEYONDER_ROLES = ['MENTOR', 'CO_MENTOR', 'MENTEE'];

export function reviveRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && (/(At|Date)$/.test(k)) && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      out[k] = new Date(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Ambil snapshot seluruh scope 10 rumah (batches, members, assignments, userRoles, transitions, groupes, flags). */
export async function captureScope(prisma, homeIds = REGEN_HOME_IDS) {
  const [batches, members, roleAssignments, transitions, groups] = await Promise.all([
    prisma.groupBatch.findMany({ where: { groupId: { in: homeIds } } }),
    prisma.groupMember.findMany({ where: { groupId: { in: homeIds } } }),
    prisma.roleAssignment.findMany({ where: { groupId: { in: homeIds }, role: { in: BEYONDER_ROLES } } }),
    prisma.mentorTransition.findMany({ where: { groupId: { in: homeIds } } }).catch(() => []),
    prisma.group.findMany({ where: { id: { in: homeIds } }, select: { id: true, memberCount: true } }),
  ]);
  const userIds = [...new Set([
    ...members.map((m) => m.userId),
    ...roleAssignments.map((a) => a.userId),
  ].filter(Boolean))];
  const userRoles = await prisma.userRole.findMany({
    where: { groupId: { in: homeIds }, role: { in: BEYONDER_ROLES } },
  }).catch(() => []);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, isBeyonders: true, isIndividuExplicit: true, onboardingStatus: true, memberStatus: true },
      })
    : [];
  return { batches, members, roleAssignments, userRoles, transitions, groups, users };
}

export async function recordSnapshot(prisma, { action, summary, groupId = null, period = null, createdById = null, data }) {
  const id = `rsnap-${crypto.randomUUID()}`;
  await prisma.regenScopeSnapshot.create({
    data: { id, action, summary: String(summary).slice(0, 400), groupId, period, createdById, data },
  });
  return id;
}

export async function latestUndoable(prisma) {
  return prisma.regenScopeSnapshot.findFirst({ where: { undoneAt: null }, orderBy: { createdAt: 'desc' } });
}

/** Pulihkan scope dari snapshot (replace). */
export async function restoreScope(prisma, data, homeIds = REGEN_HOME_IDS) {
  const d = data || {};
  await prisma.mentorTransition.deleteMany({ where: { groupId: { in: homeIds } } }).catch(() => {});
  await prisma.roleAssignment.deleteMany({ where: { groupId: { in: homeIds }, role: { in: BEYONDER_ROLES } } });
  await prisma.userRole.deleteMany({ where: { groupId: { in: homeIds }, role: { in: BEYONDER_ROLES } } });
  await prisma.groupMember.deleteMany({ where: { groupId: { in: homeIds } } });
  await prisma.groupBatch.deleteMany({ where: { groupId: { in: homeIds } } });

  if (Array.isArray(d.batches) && d.batches.length) {
    await prisma.groupBatch.createMany({ data: d.batches.map(reviveRow) });
  }
  if (Array.isArray(d.members) && d.members.length) {
    await prisma.groupMember.createMany({ data: d.members.map(reviveRow) });
  }
  if (Array.isArray(d.roleAssignments) && d.roleAssignments.length) {
    await prisma.roleAssignment.createMany({ data: d.roleAssignments.map(reviveRow) });
  }
  if (Array.isArray(d.userRoles) && d.userRoles.length) {
    await prisma.userRole.createMany({ data: d.userRoles.map(reviveRow) });
  }
  if (Array.isArray(d.transitions) && d.transitions.length) {
    await prisma.mentorTransition.createMany({ data: d.transitions.map(reviveRow) });
  }
  for (const g of (d.groups || [])) {
    await prisma.group.update({ where: { id: g.id }, data: { memberCount: g.memberCount } }).catch(() => {});
  }
  for (const u of (d.users || [])) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        isBeyonders: u.isBeyonders,
        isIndividuExplicit: u.isIndividuExplicit,
        onboardingStatus: u.onboardingStatus,
        memberStatus: u.memberStatus,
      },
    }).catch(() => {});
  }
}

/** Undo aksi terakhir (yang belum di-undo). */
export async function undoLast(prisma) {
  const snap = await latestUndoable(prisma);
  if (!snap) return { ok: false, error: 'Tidak ada aksi untuk dibatalkan.' };
  await restoreScope(prisma, snap.data);
  await prisma.regenScopeSnapshot.update({ where: { id: snap.id }, data: { undoneAt: new Date() } });
  return { ok: true, action: snap.action, summary: snap.summary, createdAt: snap.createdAt };
}
