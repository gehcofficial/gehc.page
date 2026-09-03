/**
 * Platform RBAC middleware — operator root vs delegated platform admin.
 */
import { isSuperadminEmail } from '../auth.mjs';
import { readOperatorSession, loadOperatorById } from '../platform-auth.mjs';
import {
  getActiveGrantForUser,
  isLegacyPlatformRbac,
  PLATFORM_ADMIN_CAPABILITIES,
} from '../platform-operators.mjs';

function hasLegacySuperadminUser(req) {
  if (!isLegacyPlatformRbac()) return false;
  if (!req.authUser) return false;
  if (isSuperadminEmail(req.authUser.email)) return true;
  return (req.authUser.roles || []).some((r) => r.role === 'SUPERADMIN');
}

export function isPlatformRoot(req) {
  return Boolean(req.platformOperator?.status === 'ACTIVE');
}

export function isPlatformAdminActor(req) {
  if (isPlatformRoot(req)) return true;
  if (req.platformAdmin) return true;
  if (hasLegacySuperadminUser(req)) return true;
  return false;
}

export async function attachPlatformContext(req, _res, next) {
  req.platformOperator = null;
  req.platformAdmin = false;
  req.platformCapabilities = [];

  const opSession = readOperatorSession(req);
  if (opSession?.oid && opSession.actorType === 'operator') {
    try {
      req.platformOperator = await loadOperatorById(opSession.oid);
    } catch {
      req.platformOperator = null;
    }
  }

  if (req.authUser?.id) {
    try {
      const grant = await getActiveGrantForUser(req.authUser.id);
      if (grant) {
        req.platformAdmin = true;
        req.platformCapabilities = [...PLATFORM_ADMIN_CAPABILITIES];
      }
    } catch {
      /* DB transient */
    }
  }

  if (hasLegacySuperadminUser(req)) {
    req.platformAdmin = true;
    req.platformCapabilities = [...PLATFORM_ADMIN_CAPABILITIES, 'platform_admins', 'drive_audit', 'seed_gifts', 'clean_staging'];
  }

  if (isPlatformRoot(req)) {
    req.platformCapabilities = [
      ...PLATFORM_ADMIN_CAPABILITIES,
      'platform_admins',
      'drive_audit',
      'seed_gifts',
      'clean_staging',
      'passkey_manage',
    ];
  }

  next();
}

export function requirePlatformRoot() {
  return (req, res, next) => {
    if (isPlatformRoot(req)) return next();
    if (hasLegacySuperadminUser(req) && isLegacyPlatformRbac()) return next();
    return res.status(403).json({ error: 'Akses root platform diperlukan.' });
  };
}

export function requirePlatformAdmin() {
  return (req, res, next) => {
    if (isPlatformAdminActor(req)) return next();
    return res.status(403).json({ error: 'Akses platform admin diperlukan.' });
  };
}

export function requirePlatformCapability(capability) {
  return (req, res, next) => {
    if ((req.platformCapabilities || []).includes(capability)) return next();
    return res.status(403).json({ error: 'Kapabilitas platform tidak cukup.' });
  };
}

export function guardNotProtectedOperator(targetOperator) {
  if (targetOperator?.isProtected) {
    const err = new Error('Operator dilindungi dan tidak dapat dimodifikasi.');
    err.status = 403;
    throw err;
  }
}
