import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from './db.mjs';
import { profileSegments } from './profile-fields.mjs';
import { normalizePhone } from './lib/baku-tau.mjs';

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

/** Link quick-register pool entry (by phone) to authenticated user. */
export async function claimWaitingPoolByPhone(prisma, userId, phone, sourceEvent) {
  const norm = normalizePhone(phone);
  if (!norm) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const orphans = await prisma.waitingPool.findMany({
    where: { userId: null, sourceEvent, status: 'REGISTERED' },
  });
  const match = orphans.find((e) => normalizePhone(e.phone) === norm);
  if (!match) return null;

  const userPatch = {};
  if (match.domicileKind && !user.domicileKind) userPatch.domicileKind = match.domicileKind;
  if (match.domicileDetail && !user.domicileDetail) userPatch.domicileDetail = match.domicileDetail;
  if (match.origin && !user.origin) userPatch.origin = match.origin;
  if (match.gender && !user.gender) userPatch.gender = match.gender;
  if (match.phone && !user.phone) userPatch.phone = match.phone;
  if (Object.keys(userPatch).length) {
    await prisma.user.update({ where: { id: userId }, data: userPatch });
  }

  const existing = await prisma.waitingPool.findUnique({ where: { userId } });
  if (existing) {
    await prisma.waitingPool.update({
      where: { id: existing.id },
      data: {
        sourceEvent: sourceEvent || existing.sourceEvent,
        domicileKind: match.domicileKind || existing.domicileKind,
        domicileDetail: match.domicileDetail || existing.domicileDetail,
        origin: match.origin || existing.origin,
        gender: match.gender || existing.gender,
        phone: match.phone || existing.phone,
        status: existing.status === 'ROLE_ASSIGNED' ? 'ROLE_ASSIGNED' : 'WAITING_POOL',
      },
    });
    await prisma.waitingPool.delete({ where: { id: match.id } });
    return existing;
  }

  const claimed = await prisma.waitingPool.update({
    where: { id: match.id },
    data: {
      userId,
      email: user.email,
      name: user.name,
      status: 'WAITING_POOL',
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingStatus: 'WAITING_POOL' },
  });

  return claimed;
}

export async function ensureWaitingPoolForNewPemuda(userId, { sourceEvent } = {}) {
  if (!isDbConfigured()) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const existing = await prisma.waitingPool.findUnique({ where: { userId } });
  if (existing) return existing;

  const userWithPhone = await prisma.user.findUnique({ where: { id: userId } });
  if (userWithPhone?.phone && sourceEvent) {
    const claimed = await claimWaitingPoolByPhone(prisma, userId, userWithPhone.phone, sourceEvent);
    if (claimed) return claimed;
  }

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
