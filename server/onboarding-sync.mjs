import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from './db.mjs';
import { profileSegments } from './profile-fields.mjs';

const wpId = () => `wp-${crypto.randomUUID()}`;

function poolDataFromUser(user, recreationalIds = []) {
  const segments = profileSegments({ ...user, recreationalIds });
  const giftTestDone = Array.isArray(user.giftsTop5) && user.giftsTop5.length > 0;
  const profileCompleted = segments.contact && segments.gifts;
  return { segments, giftTestDone, profileCompleted };
}

export async function syncWaitingPoolFromUser(userId) {
  if (!isDbConfigured()) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { recreational: { select: { groupId: true } } },
  });
  if (!user) return null;

  const recreationalIds = (user.recreational || []).map((m) => m.groupId);
  const { giftTestDone, profileCompleted } = poolDataFromUser(user, recreationalIds);

  let entry = await prisma.waitingPool.findUnique({ where: { userId } });
  const base = {
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    origin: user.origin,
    giftTestDone,
    giftsTop5: user.giftsTop5,
    giftsScores: user.giftsScores,
    talents: user.talents,
    profileCompleted,
  };

  if (!entry) {
    const status = profileCompleted ? 'PROFILE_COMPLETED' : 'WAITING_POOL';
    entry = await prisma.waitingPool.create({
      data: {
        id: wpId(),
        userId,
        ...base,
        status,
        profileCompletedAt: profileCompleted ? new Date() : null,
      },
    });
    if (status === 'WAITING_POOL' && user.onboardingStatus !== 'ACTIVE') {
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingStatus: 'WAITING_POOL' },
      });
    }
    return entry;
  }

  if (entry.status === 'ROLE_ASSIGNED') {
    return prisma.waitingPool.update({
      where: { id: entry.id },
      data: base,
    });
  }

  const update = { ...base };
  if (profileCompleted && entry.status === 'WAITING_POOL') {
    update.status = 'PROFILE_COMPLETED';
    update.profileCompletedAt = entry.profileCompletedAt || new Date();
  }

  return prisma.waitingPool.update({
    where: { id: entry.id },
    data: update,
  });
}

export async function ensureWaitingPoolForNewPemuda(userId, { sourceEvent } = {}) {
  if (!isDbConfigured()) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const existing = await prisma.waitingPool.findUnique({ where: { userId } });
  if (existing) return existing;

  const recreationalIds = [];
  const { giftTestDone, profileCompleted } = poolDataFromUser(user, recreationalIds);
  const status = profileCompleted ? 'PROFILE_COMPLETED' : 'WAITING_POOL';

  const entry = await prisma.waitingPool.create({
    data: {
      id: wpId(),
      userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      origin: user.origin,
      status,
      giftTestDone,
      giftsTop5: user.giftsTop5,
      giftsScores: user.giftsScores,
      talents: user.talents,
      profileCompleted,
      profileCompletedAt: profileCompleted ? new Date() : null,
      sourceEvent: sourceEvent || null,
    },
  });

  if (status === 'WAITING_POOL') {
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingStatus: 'WAITING_POOL' },
    });
  }

  return entry;
}
