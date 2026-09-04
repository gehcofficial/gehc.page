/**
 * Pre-provision invited users — username/password, role, optional group/org slot.
 */
import crypto from 'node:crypto';
import { hashPassword } from './auth.mjs';
import { applyGroupEntitlements } from './access-groups.mjs';
import { isProductionEnv } from './platform-operators.mjs';
import { assignRoleToUser } from './role-assign.mjs';
import { assignOrgSlot } from './services/org-assign.mjs';
import {
  normalizeUsername,
  slugUsernameFromName,
  validateUsername,
  ensureUniqueUsername,
} from './lib/username.mjs';

export const DEFAULT_UNIFORM_PASSWORD = 'GEHCikarang';

export function generateProvisionPassword() {
  return `GehC-${crypto.randomBytes(4).toString('hex')}!`;
}

export function resolveUniformPassword(body = {}) {
  const useUniform = Boolean(body.useUniformPassword);
  const requested = body.uniformPassword ? String(body.uniformPassword) : null;
  if (!useUniform && !requested) return null;

  const envUniform = process.env.PROVISION_UNIFORM_PASSWORD || process.env.DEMO_PASSWORD || null;
  const pass = requested || envUniform || DEFAULT_UNIFORM_PASSWORD;

  if (pass.length < 8) {
    throw new Error('Password seragam minimal 8 karakter.');
  }
  if (
    isProductionEnv()
    && requested
    && envUniform
    && requested !== envUniform
    && requested !== DEFAULT_UNIFORM_PASSWORD
  ) {
    throw new Error('Password seragam kustom tidak diizinkan di production.');
  }
  return pass;
}

const MENTORING_ROLES = new Set(['MENTOR', 'CO_MENTOR', 'MENTEE']);

function resolveInviteType(body) {
  const t = String(body?.inviteType || body?.invite_type || 'staff').toLowerCase();
  if (t === 'beyonders' || t === 'beyonders_group') return 'beyonders';
  if (t === 'individual' || t === 'individu') return 'individual';
  return 'staff';
}

export async function createInviteProvisionUser(
  prisma,
  {
    name,
    loginUsername,
    email,
    role,
    password,
    origin,
    newClaimToken,
    inviteType,
    groupId,
    familyRole,
    orgNodeId,
    assignedBy,
  },
) {
  const trimmedName = String(name || '').trim();
  const assignedRole = String(role || 'MENTOR').trim();
  const type = resolveInviteType({ inviteType });

  if (!trimmedName) throw Object.assign(new Error('Nama wajib.'), { status: 400 });

  let username = loginUsername ? normalizeUsername(loginUsername) : slugUsernameFromName(trimmedName);
  const usernameErr = validateUsername(username);
  if (usernameErr && loginUsername) throw Object.assign(new Error(usernameErr), { status: 400 });
  username = await ensureUniqueUsername(prisma, username);

  const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
  if (normalizedEmail) {
    const taken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (taken) throw Object.assign(new Error('Email sudah terdaftar.'), { status: 400 });
  }

  if (type === 'beyonders') {
    if (!groupId) throw Object.assign(new Error('groupId wajib untuk undangan Beyonders.'), { status: 400 });
    if (!MENTORING_ROLES.has(assignedRole)) {
      throw Object.assign(new Error('Role Beyonders harus MENTOR, CO_MENTOR, atau MENTEE.'), { status: 400 });
    }
  }

  if (type === 'staff' && !orgNodeId) {
    throw Object.assign(new Error('orgNodeId wajib untuk undangan Komisi/Tim Kerja.'), { status: 400 });
  }

  const tempPass = password || generateProvisionPassword();
  const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
  const token = newClaimToken();
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const isBeyonders = type === 'beyonders';

  await prisma.user.create({
    data: {
      id: userId,
      name: trimmedName,
      loginUsername: username,
      email: normalizedEmail,
      passwordHash: hashPassword(tempPass),
      mustChangePassword: true,
      authProvider: 'LOCAL',
      linkStatus: 'UNLINKED',
      accountStatus: 'ACTIVE',
      onboardingStatus: 'ACTIVE',
      onboardingPath: 'INVITED',
      accountKind: 'INVITED',
      isBeyonders,
      bipra: 'PEMUDA',
      claimToken: token,
      claimTokenExpiresAt: expires,
    },
  });

  const assigner = assignedBy || 'system-invite';

  if (type === 'beyonders') {
    const fam = familyRole || (assignedRole === 'MENTEE' ? 'MENTEE' : assignedRole === 'CO_MENTOR' ? 'CO_MENTOR' : 'MENTOR');
    await assignRoleToUser(prisma, {
      userId,
      role: assignedRole,
      groupId,
      familyRole: fam,
      assignedBy: assigner,
      note: 'Invite provision Beyonders',
      updateOnboarding: false,
    });
  } else if (orgNodeId) {
    await assignOrgSlot(prisma, {
      userId,
      orgNodeId,
      groupId: groupId || null,
      familyRole: familyRole || null,
      assignedBy: assigner,
      note: 'Invite provision org slot',
      updateOnboarding: false,
    });
  } else {
    await prisma.userRole.create({
      data: { userId, tenantId: 'tenant-youth', role: assignedRole },
    });
    if (assignedRole === 'MENTEE' && type === 'individual') {
      await prisma.user.update({ where: { id: userId }, data: { isBeyonders: false } });
    }
  }

  if (normalizedEmail) {
    await applyGroupEntitlements(normalizedEmail, userId);
  }

  return {
    userId,
    name: trimmedName,
    loginUsername: username,
    email: normalizedEmail,
    role: assignedRole,
    inviteType: type,
    groupId: groupId || null,
    tempPassword: tempPass,
    claimUrl: `${origin}/#/claim?token=${encodeURIComponent(token)}`,
    expiresAt: expires.toISOString(),
  };
}
