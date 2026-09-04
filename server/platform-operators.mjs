/**
 * Platform admin grants + audit log.
 */
import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from './db.mjs';

export const PLATFORM_ADMIN_CAPABILITIES = [
  'access_groups',
  'users_provision',
  'users_invite',
  'users_edit',
  'integrations',
];

export function isProductionEnv() {
  const env = String(process.env.GEHC_ENV || process.env.VERCEL_ENV || '').toLowerCase();
  return env === 'production';
}

export function isLegacyPlatformRbac() {
  if (process.env.PLATFORM_RBAC_LEGACY === 'false') return false;
  return true;
}

export async function getActiveGrantForUser(userId) {
  const prisma = getPrisma();
  if (!prisma || !userId) return null;
  return prisma.platformAdminGrant.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { grantedAt: 'desc' },
  });
}

export async function userHasPlatformAdmin(userId) {
  const grant = await getActiveGrantForUser(userId);
  return Boolean(grant);
}

export async function listPlatformAdminGrants() {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.platformAdminGrant.findMany({
    where: { revokedAt: null },
    include: {
      user: { select: { id: true, email: true, name: true, avatar: true } },
      grantedByOperator: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: { grantedAt: 'desc' },
  });
}

export function normalizeGrantUserIdent(raw) {
  return String(raw || '').trim().replace(/^@+/, '').trim();
}

const SYSTEM_USER_IDS = ['usr-platform-ops'];

export async function searchGrantableUsers(qRaw) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const q = String(qRaw || '').trim().replace(/^@+/, '').trim();
  const users = await prisma.user.findMany({
    where: {
      id: { notIn: SYSTEM_USER_IDS },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { loginUsername: { contains: q } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, loginUsername: true },
    orderBy: { name: 'asc' },
    take: q ? 20 : 40,
  });
  return users;
}

export async function resolveCongregationUser(raw) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const ident = normalizeGrantUserIdent(raw);
  if (!ident) return null;
  const byId = await prisma.user.findUnique({ where: { id: ident } });
  if (byId) return byId;
  return prisma.user.findFirst({
    where: {
      OR: [{ email: ident }, { loginUsername: ident }],
    },
  });
}

export async function grantPlatformAdmin({ operatorId, userId, note }) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const user = await resolveCongregationUser(userId);
  if (!user) throw new Error('User tidak ditemukan.');
  const existing = await getActiveGrantForUser(user.id);
  if (existing) throw new Error('User sudah memiliki grant platform admin aktif.');

  const grant = await prisma.platformAdminGrant.create({
    data: {
      id: crypto.randomBytes(32).toString('hex'),
      userId: user.id,
      grantedByOperatorId: operatorId,
      note: note || null,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  await writePlatformAudit({
    actorType: 'OPERATOR',
    actorId: operatorId,
    action: 'GRANT_PLATFORM_ADMIN',
    targetType: 'USER',
    targetId: user.id,
    meta: { grantId: grant.id },
  });

  return grant;
}

export async function revokePlatformAdmin({ operatorId, grantId }) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const grant = await prisma.platformAdminGrant.findUnique({ where: { id: grantId } });
  if (!grant || grant.revokedAt) throw new Error('Grant tidak ditemukan.');

  const updated = await prisma.platformAdminGrant.update({
    where: { id: grantId },
    data: { revokedAt: new Date() },
  });

  await writePlatformAudit({
    actorType: 'OPERATOR',
    actorId: operatorId,
    action: 'REVOKE_PLATFORM_ADMIN',
    targetType: 'USER',
    targetId: grant.userId,
    meta: { grantId },
  });

  return updated;
}

export async function writePlatformAudit({ actorType, actorId, action, targetType, targetId, meta }) {
  if (!isDbConfigured()) return;
  const prisma = getPrisma();
  try {
    await prisma.platformAuditLog.create({
      data: {
        id: crypto.randomBytes(32).toString('hex'),
        actorType,
        actorId,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        meta: meta || null,
      },
    });
  } catch (err) {
    console.error('[platform-audit]', err.message);
  }
}

export async function listPlatformAuditLogs(limit = 50) {
  const prisma = getPrisma();
  if (!prisma) return [];
  return prisma.platformAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
}

export function shouldAutoGrantSuperadminEmail() {
  if (isProductionEnv()) return false;
  return isLegacyPlatformRbac();
}
