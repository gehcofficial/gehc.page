/**
 * Jethro Placement Batch Management
 * CRUD for placement review batches and items.
 */
import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from './db.mjs';

const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
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
          newcomerGender: rec.newcomerGender,
          newcomerGiftsTop5: rec.newcomerGiftsTop5,
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

  return prisma.placementBatch.findUnique({
    where: { id: batchId },
    include: { items: { orderBy: { newcomerName: 'asc' } } },
  });
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

/** Bulk approve all PENDING items in a batch. */
export async function bulkApprovePlacementBatch({ batchId, reviewedBy }) {
  assertDb();
  const prisma = getPrisma();

  const batch = await prisma.placementBatch.findUnique({
    where: { id: batchId },
    include: { items: { where: { status: 'PENDING' } } },
  });
  if (!batch) throw new Error('Batch tidak ditemukan.');

  await prisma.placementItem.updateMany({
    where: { batchId, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      finalGroupId: { set: item => item.recommendedGroupId },
      finalRole: { set: item => item.recommendedRole },
      finalIsIndividu: false,
      reviewedBy,
      reviewedAt: new Date(),
    },
  });

  // Update batch status
  await prisma.placementBatch.update({
    where: { id: batchId },
    data: { status: 'APPROVED', reviewedBy, reviewedAt: new Date() },
  });

  return { updated: batch.items.length };
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
        include: { batch: true },
      },
    },
  });
  if (!batch) throw new Error('Batch tidak ditemukan.');
  if (batch.status === 'COMMITTED') throw new Error('Batch sudah di-commit.');

  const results = {
    created: 0,
    updated: 0,
    individu: 0,
    errors: [],
  };

  for (const item of batch.items) {
    try {
      if (item.finalIsIndividu || item.status === 'INDIVIDU') {
        // Create RoleAssignment as INDIVIDU (MENTEE, no group)
        await prisma.roleAssignment.create({
          data: {
            id: uid('ra'),
            userId: item.newcomerId,
            role: 'MENTEE',
            position: null,
            division: null,
            subdivision: null,
            groupId: null,
            familyRole: 'MENTEE',
            assignedBy: committedBy,
            note: 'Individu (tanpa kelompok mentoring)',
            isActive: true,
          },
        });
        results.individu++;
      } else if (item.finalGroupId && item.finalRole) {
        // Create RoleAssignment with group
        await prisma.roleAssignment.create({
          data: {
            id: uid('ra'),
            userId: item.newcomerId,
            role: item.finalRole,
            position: item.finalRole === 'MENTOR' || item.finalRole === 'COMENTOR' ? item.finalRole : null,
            division: null,
            subdivision: null,
            groupId: item.finalGroupId,
            familyRole: item.finalRole,
            assignedBy: committedBy,
            note: `Jethro placement: ${item.recommendedGroupName} → ${item.finalRole}`,
            isActive: true,
          },
        });
        results.created++;
      } else {
        results.errors.push({ newcomerId: item.newcomerId, error: 'Missing final group/role' });
        continue;
      }

      // Dual-write UserRole
      const existingUserRole = await prisma.userRole.findFirst({
        where: {
          userId: item.newcomerId,
          role: item.finalIsIndividu ? 'MENTEE' : item.finalRole,
          groupId: item.finalIsIndividu ? null : item.finalGroupId,
        },
      });

      if (existingUserRole) {
        await prisma.userRole.update({
          where: { id: existingUserRole.id },
          data: { assignmentId: `placeholder-${item.newcomerId}-${Date.now()}` }, // will be updated after RoleAssignment created
        });
      } else {
        await prisma.userRole.create({
          data: {
            userId: item.newcomerId,
            tenantId: 'tenant-youth',
            role: item.finalIsIndividu ? 'MENTEE' : item.finalRole,
            groupId: item.finalIsIndividu ? null : item.finalGroupId,
          },
        });
      }

      // Update WaitingPool status
      await prisma.waitingPool.updateMany({
        where: { userId: item.newcomerId },
        data: { status: 'ROLE_ASSIGNED' },
      });

      // Update User.onboardingStatus
      await prisma.user.update({
        where: { id: item.newcomerId },
        data: { onboardingStatus: 'ACTIVE' },
      });

    } catch (e) {
      results.errors.push({ newcomerId: item.newcomerId, error: e.message });
    }
  }

  // Mark batch as committed
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

  // Get users from WaitingPool with PROFILE_COMPLETED + gift test done + gender
  const pool = await prisma.waitingPool.findMany({
    where: {
      status: 'PROFILE_COMPLETED',
      giftTestDone: true,
      gender: { not: null },
      giftsTop5: { not: null },
    },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      gender: true,
      giftsTop5: true,
      giftsScores: true,
    },
  });

  return pool.map((p) => ({
    id: p.userId || p.id,
    name: p.name,
    gender: p.gender,
    giftsTop5: Array.isArray(p.giftsTop5) ? p.giftsTop5 : [],
    giftsScores: p.giftsScores || {},
    maturityScore: 0, // could be calculated from attendance if user existed before
  }));
}