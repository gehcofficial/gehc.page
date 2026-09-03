/**
 * Jethro Placement Batch Management
 * CRUD for placement review batches and items.
 */
import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from './db.mjs';
import { assignRoleToUser, mapPlacementRoleToPrisma } from './role-assign.mjs';
import { assignOrgSlot } from './services/org-assign.mjs';
import { normalizeGiftsTop5, normalizeGiftsScores } from './gift-normalize.mjs';

const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
}

function poolEntryToNewcomer(p) {
  return {
    id: p.userId,
    poolId: p.id,
    name: p.name,
    gender: p.gender,
    giftsTop5: normalizeGiftsTop5(Array.isArray(p.giftsTop5) ? p.giftsTop5 : []),
    giftsScores: normalizeGiftsScores(p.giftsScores || {}),
    maturityScore: 0,
  };
}

function isPoolEntryEligible(p) {
  if (!p.userId || !p.giftTestDone || !p.gender) return false;
  if (p.giftsTop5 == null) return false;
  if (Array.isArray(p.giftsTop5) && p.giftsTop5.length === 0) return false;
  return true;
}

/** Assign Individu (no mentoring group) — mirrors bulk-individu API. */
async function assignIndividuRole(prisma, userId, assignedBy) {
  const individuNode = await prisma.orgNode.findFirst({
    where: { domain: 'YOUTH', slug: 'INDIVIDU', isActive: true },
  });
  if (individuNode) {
    await assignOrgSlot(prisma, {
      userId,
      orgNodeId: individuNode.id,
      assignedBy,
      note: 'Individu (tanpa kelompok mentoring)',
      updateOnboarding: true,
    });
    return;
  }
  await assignRoleToUser(prisma, {
    userId,
    role: 'MENTEE',
    groupId: null,
    familyRole: 'MENTEE',
    assignedBy,
    note: 'Individu (tanpa kelompok mentoring)',
  });
  await prisma.user.update({
    where: { id: userId },
    data: { isBeyonders: false },
  });
}

function serializeItem(item, groupNames = new Map()) {
  const finalGroupId = item.finalGroupId || item.recommendedGroupId;
  return {
    ...item,
    finalGroupName: finalGroupId ? (groupNames.get(finalGroupId) || item.recommendedGroupName) : null,
  };
}

/** Create a new placement batch from recommendations. */
export async function createPlacementBatch({ createdBy, recommendations }) {
  assertDb();
  const prisma = getPrisma();

  const batch = await prisma.placementBatch.create({
    data: {
      id: uid('plb'),
      status: 'GENERATED',
      createdBy,
      generatedAt: new Date(),
      items: {
        create: recommendations.map((rec) => ({
          id: uid('pli'),
          newcomerId: rec.newcomerId,
          newcomerName: rec.newcomerName,
          newcomerGender: rec.newcomerGender || '',
          newcomerGiftsTop5: rec.newcomerGiftsTop5 || [],
          newcomerMaturityScore: rec.newcomerMaturityScore ?? null,
          recommendedGroupId: rec.recommendedGroupId ?? null,
          recommendedGroupName: rec.recommendedGroupName ?? null,
          recommendedRole: rec.recommendedRole ?? 'MENTEE',
          confidence: rec.confidence ?? 0,
          reasons: rec.reasons ?? [],
          scoreBreakdown: rec.scoreBreakdown ?? null,
          status: 'PENDING',
        })),
      },
    },
    include: { items: true },
  });

  return batch;
}

/** Get batch with all items. */
export async function getPlacementBatch(batchId) {
  assertDb();
  const prisma = getPrisma();

  const batch = await prisma.placementBatch.findUnique({
    where: { id: batchId },
    include: { items: { orderBy: { newcomerName: 'asc' } } },
  });
  if (!batch) return null;

  const groupIds = [
    ...new Set(
      batch.items.flatMap((i) => [i.finalGroupId, i.recommendedGroupId].filter(Boolean)),
    ),
  ];
  const groups = groupIds.length
    ? await prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
      })
    : [];
  const groupNames = new Map(groups.map((g) => [g.id, g.name]));

  return {
    ...batch,
    items: batch.items.map((item) => serializeItem(item, groupNames)),
  };
}

/** List batches with optional status filter. */
export async function listPlacementBatches({ status, createdBy, limit = 50, offset = 0 }) {
  assertDb();
  const prisma = getPrisma();

  const where = {};
  if (status) where.status = status;
  if (createdBy) where.createdBy = createdBy;

  const [batches, total] = await Promise.all([
    prisma.placementBatch.findMany({
      where,
      include: {
        items: {
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.placementBatch.count({ where }),
  ]);

  return { batches, total };
}

/** Update single placement item (approve/revise/reject/individu). */
export async function updatePlacementItem({ itemId, status, finalGroupId, finalRole, finalIsIndividu, reviewedBy }) {
  assertDb();
  const prisma = getPrisma();

  const item = await prisma.placementItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Placement item tidak ditemukan.');

  const updateData = { status, reviewedBy, reviewedAt: new Date() };
  if (finalGroupId !== undefined) updateData.finalGroupId = finalGroupId;
  if (finalRole !== undefined) updateData.finalRole = finalRole;
  if (finalIsIndividu !== undefined) updateData.finalIsIndividu = finalIsIndividu;

  return prisma.placementItem.update({
    where: { id: itemId },
    data: updateData,
  });
}

/** Bulk approve all PENDING items in a batch (single CASE WHEN UPDATE). */
export async function bulkApprovePlacementBatch({ batchId, reviewedBy }) {
  assertDb();
  const prisma = getPrisma();

  const batch = await prisma.placementBatch.findUnique({
    where: { id: batchId },
    include: { items: { where: { status: 'PENDING' } } },
  });
  if (!batch) throw new Error('Batch tidak ditemukan.');

  const pending = batch.items;
  if (pending.length > 0) {
    const esc = (s) => String(s).replace(/'/g, "''");
    const caseGroup = pending
      .map((i) => `WHEN '${esc(i.id)}' THEN ${i.recommendedGroupId ? `'${esc(i.recommendedGroupId)}'` : 'NULL'}`)
      .join(' ');
    const caseRole = pending
      .map((i) => `WHEN '${esc(i.id)}' THEN ${i.recommendedRole ? `'${esc(i.recommendedRole)}'` : `'MENTEE'`}`)
      .join(' ');

    await prisma.$executeRawUnsafe(`
      UPDATE placement_items SET
        status = 'APPROVED',
        final_group_id = CASE id ${caseGroup} ELSE final_group_id END,
        final_role = CASE id ${caseRole} ELSE final_role END,
        final_is_individu = false,
        reviewed_by = '${esc(reviewedBy)}',
        reviewed_at = NOW(3)
      WHERE batch_id = '${esc(batchId)}' AND status = 'PENDING'
    `);
  }

  await prisma.placementBatch.update({
    where: { id: batchId },
    data: { status: 'APPROVED', reviewedBy, reviewedAt: new Date() },
  });

  return { updated: pending.length };
}

/** Commit batch → create RoleAssignments + update WaitingPool. */
export async function commitPlacementBatch({ batchId, committedBy }) {
  assertDb();
  const prisma = getPrisma();

  const batch = await prisma.placementBatch.findUnique({
    where: { id: batchId },
    include: {
      items: {
        where: { status: { in: ['APPROVED', 'REVISED'] } },
      },
    },
  });
  if (!batch) throw new Error('Batch tidak ditemukan.');
  if (batch.status === 'COMMITTED') throw new Error('Batch sudah di-commit.');

  const results = {
    created: 0,
    individu: 0,
    errors: [],
  };

  for (const item of batch.items) {
    try {
      if (item.finalIsIndividu || item.status === 'INDIVIDU') {
        await assignIndividuRole(prisma, item.newcomerId, committedBy);
        results.individu++;
      } else if (item.finalGroupId && item.finalRole) {
        const prismaRole = mapPlacementRoleToPrisma(item.finalRole);
        await assignRoleToUser(prisma, {
          userId: item.newcomerId,
          role: prismaRole,
          groupId: item.finalGroupId,
          position: ['MENTOR', 'CO_MENTOR'].includes(prismaRole) ? prismaRole : null,
          assignedBy: committedBy,
          note: `Jethro placement: ${item.recommendedGroupName || item.finalGroupId} → ${item.finalRole}`,
        });
        results.created++;
      } else {
        results.errors.push({ newcomerId: item.newcomerId, error: 'Missing final group/role' });
      }
    } catch (e) {
      results.errors.push({ newcomerId: item.newcomerId, error: e.message });
    }
  }

  await prisma.placementBatch.update({
    where: { id: batchId },
    data: { status: 'COMMITTED', committedBy, committedAt: new Date() },
  });

  return results;
}

/** Get eligible newcomers for placement (from WaitingPool with gifts+gender). */
export async function getEligibleNewcomers() {
  assertDb();
  const prisma = getPrisma();

  const pool = await prisma.waitingPool.findMany({
    where: {
      status: 'PROFILE_COMPLETED',
      giftTestDone: true,
      gender: { not: null },
    },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      gender: true,
      giftsTop5: true,
      giftsScores: true,
      giftTestDone: true,
    },
  });

  return pool.filter(isPoolEntryEligible).map(poolEntryToNewcomer);
}

/** Resolve newcomers by userId or WaitingPool id for Jethro advanced placement. */
export async function resolveNewcomersByIds(ids) {
  assertDb();
  const prisma = getPrisma();
  if (!ids.length) return [];

  const poolEntries = await prisma.waitingPool.findMany({
    where: {
      status: 'PROFILE_COMPLETED',
      giftTestDone: true,
      gender: { not: null },
      OR: [{ userId: { in: ids } }, { id: { in: ids } }],
    },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      gender: true,
      giftsTop5: true,
      giftsScores: true,
      giftTestDone: true,
    },
  });

  const seen = new Set();
  const out = [];
  for (const p of poolEntries) {
    if (!isPoolEntryEligible(p) || seen.has(p.userId)) continue;
    seen.add(p.userId);
    out.push(poolEntryToNewcomer(p));
  }
  return out;
}
