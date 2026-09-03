/**
 * Google SSO (Google Identity Services) + session cookie untuk GEHC portal.
 *
 * Env yang dipakai:
 *   GOOGLE_CLIENT_ID   — OAuth 2.0 Client ID dari Google Cloud Console (wajib untuk login)
 *   SESSION_SECRET     — kunci HMAC cookie sesi (opsional; fallback di-derived otomatis)
 *   SUPERADMIN_EMAILS  — daftar email (dipisah koma) yang otomatis dapat role SUPERADMIN
 */
import crypto from 'node:crypto';
import { Auth } from 'googleapis';
import { getPrisma, isDbConfigured, resetPrisma, isTransientDbError } from './db.mjs';
import { shouldAutoGrantSuperadminEmail } from './platform-operators.mjs';
import { roleToNamespace, namespaceToRole } from './portal-namespace.mjs';
import { googleAvatarCreate, googleAvatarPatch } from './lib/user-avatar.mjs';

const COOKIE_NAME = 'gehc_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Fallback deterministik dari DATABASE_URL — cukup untuk dev, produksi wajib set SESSION_SECRET
  return 'gehc::' + crypto.createHash('sha256').update(process.env.DATABASE_URL || 'no-db').digest('hex');
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signSession(payload) {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.uid || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function cookieFlags({ maxAge } = {}) {
  const age = maxAge ?? Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
}

export function setSessionCookie(res, payload) {
  const token = signSession({ ...payload, exp: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieFlags()}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieFlags({ maxAge: 0 })}`);
}

function dedupeRoles(roles) {
  const seen = new Set();
  return (roles || []).filter((r) => {
    const key = `${r.role}::${r.tenantId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function applySuperadminSession(user) {
  if (!user) return user;
  if (shouldAutoGrantSuperadminEmail() && isSuperadminEmail(user.email) && !(user.roles || []).some((r) => r.role === 'SUPERADMIN')) {
    const tenantId = user.roles?.[0]?.tenantId || 'tenant-youth';
    user.roles = [...(user.roles || []), { userId: user.id, tenantId, role: 'SUPERADMIN' }];
  }
  user.roles = dedupeRoles(user.roles);
  return user;
}

export async function persistSuperadminRole(user) {
  if (!user || !shouldAutoGrantSuperadminEmail() || !isSuperadminEmail(user.email)) return applySuperadminSession(user);
  if ((user.roles || []).some((r) => r.role === 'SUPERADMIN')) return applySuperadminSession(user);
  const tenantId = user.roles?.[0]?.tenantId || 'tenant-youth';
  const prisma = getPrisma();
  if (prisma) {
    try {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId, role: 'SUPERADMIN' },
      });
      user.roles = [...(user.roles || []), { userId: user.id, tenantId, role: 'SUPERADMIN' }];
    } catch {
      /* DB belum siap — fallback session-only */
    }
  }
  return applySuperadminSession(user);
}

export const ensureSuperadminRole = persistSuperadminRole;

async function attachMustChangePassword(prisma, user) {
  if (!user) return user;
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT must_change_password AS mcp FROM users WHERE id = ? LIMIT 1',
      user.id,
    );
    const v = rows?.[0]?.mcp;
    user.mustChangePassword = Buffer.isBuffer(v) ? v[0] === 1 : Boolean(Number(v));
  } catch {
    user.mustChangePassword = Boolean(user.mustChangePassword);
  }
  return user;
}

/** Muat User + roles dari DB berdasarkan uid di sesi. */
async function loadUserByUid(uid) {
  const prisma = getPrisma();
  if (!prisma) return null;
  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: { roles: true },
  });
  await attachMustChangePassword(prisma, user);
  return applySuperadminSession(user);
}

export function readSession(req) {
  return verifySession(parseCookies(req)[COOKIE_NAME]);
}

const ROLE_ORDER = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'];

export function pickDefaultActiveRole(user) {
  const roles = (user?.roles || []).map((r) => r.role);
  if (!roles.length) return null;
  if (roles.length === 1) return roles[0];
  for (const r of ROLE_ORDER) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
}

export function resolveSessionActiveRole(session, user) {
  const owned = (user?.roles || []).map((r) => r.role);
  if (!owned.length) return null;
  const fromSession = session?.activeRole;
  if (fromSession && owned.includes(fromSession)) return fromSession;
  return pickDefaultActiveRole(user);
}

export function resolveSessionContext(session, user) {
  const activeRole = resolveSessionActiveRole(session, user);
  if (!activeRole) return { activeRole: null, activeNamespace: null };
  const expectedNs = roleToNamespace(activeRole);
  let activeNamespace = session?.activeNamespace;
  if (!activeNamespace || namespaceToRole(activeNamespace) !== activeRole) {
    activeNamespace = expectedNs;
  }
  return { activeRole, activeNamespace };
}

export function buildSessionPayload(user, overrides = {}) {
  const activeRole = overrides.activeRole || pickDefaultActiveRole(user);
  return {
    uid: user.id,
    email: user.email || '',
    activeRole,
    activeNamespace: overrides.activeNamespace || roleToNamespace(activeRole),
  };
}

/** Middleware: pasang req.authUser (atau null) dari cookie sesi. */
export async function attachUser(req, _res, next) {
  req.authUser = null;
  req.sessionMeta = null;
  req.activeRole = null;
  req.activeNamespace = null;
  const session = readSession(req);
  req.sessionMeta = session;
  if (session && isDbConfigured()) {
    for (let attempt = 0; attempt < 2 && !req.authUser; attempt++) {
      try {
        req.authUser = await loadUserByUid(session.uid);
      } catch (err) {
        if (isTransientDbError(err)) await resetPrisma();
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
        } else {
          console.error('[auth] gagal memuat user:', err.message);
        }
      }
    }
    if (req.authUser) {
      const ctx = resolveSessionContext(session, req.authUser);
      req.activeRole = ctx.activeRole;
      req.activeNamespace = ctx.activeNamespace;
    }
  }
  next();
}

/** Middleware RBAC: hanya lewat jika role user termasuk daftar. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
    if (roles.length === 0) return next();
    if (isSuperadminEmail(req.authUser.email)) return next();
    const userRoles = (req.authUser.roles || []).map((r) => r.role);
    if (userRoles.includes('SUPERADMIN')) return next();
    const ok = roles.some((r) => userRoles.includes(r));
    if (!ok) return res.status(403).json({ error: 'Akses ditolak untuk role Anda.' });
    next();
  };
}

export function isSuperadminEmail(email) {
  return superadminEmails().includes(String(email || '').toLowerCase());
}

function superadminEmails() {
  return (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// ---------- Auth lokal (email + password) ----------

/** Hash scrypt: "salt:hash" (hex). Tanpa dependency eksternal. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === test.length && crypto.timingSafeEqual(expected, test);
}

/** Login username atau email + password → user lengkap dgn roles. */
export async function loginLocal(identifierRaw, password) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const prisma = getPrisma();
  const { findUserByLoginIdentifier } = await import('./lib/username.mjs');
  const u = await findUserByLoginIdentifier(prisma, identifierRaw);
  if (!u || !u.passwordHash || !verifyPassword(password, u.passwordHash)) {
    throw new Error('Username/email atau kata sandi salah.');
  }
  await attachMustChangePassword(prisma, u);
  return persistSuperadminRole(u);
}

/** Verifikasi ID token Google → payload {sub,email,name,picture,...} (dipakai login & join). */
export async function verifyGoogleCredential(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID belum dikonfigurasi di server.');
  }
  const client = new Auth.OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload();
  if (!p?.email || !p?.sub) throw new Error('ID token Google tidak valid.');
  if (p.email_verified === false) throw new Error('Email Google belum terverifikasi.');
  return { ...p, email: p.email.toLowerCase() };
}

/**
 * Verifikasi credential (ID token JWT) dari Google Identity Services,
 * lalu upsert User (+ role awal) ke TiDB.
 */
export async function loginWithGoogleCredential(credential) {
  if (!isDbConfigured()) {
    throw new Error('DATABASE_URL belum dikonfigurasi.');
  }
  const p = await verifyGoogleCredential(credential);
  const email = p.email;
  const prisma = getPrisma();

  let user = await prisma.user.findFirst({
    where: { googleSub: p.sub },
    include: { roles: true },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        name: p.name || undefined,
        ...googleAvatarPatch(user, p.picture),
        linkStatus: 'LINKED',
        authProvider: 'GOOGLE',
      },
      include: { roles: true },
    });
  } else {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== p.sub) {
        throw new Error('Email ini sudah tertaut ke akun Google lain.');
      }
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleSub: p.sub,
          linkStatus: 'LINKED',
          email,
          name: p.name || undefined,
          ...googleAvatarPatch(byEmail, p.picture),
          authProvider: 'GOOGLE',
        },
        include: { roles: true },
      });
    }
  }

  if (!user) {
    user = await prisma.user.upsert({
      where: { id: p.sub },
      create: {
        id: p.sub,
        email,
        name: p.name || email.split('@')[0],
        ...googleAvatarCreate(p.picture),
        googleSub: p.sub,
        linkStatus: 'LINKED',
        bipra: 'PEMUDA',
        authProvider: 'GOOGLE',
      },
      update: {
        email,
        name: p.name || undefined,
        ...googleAvatarPatch(user, p.picture),
        googleSub: p.sub,
        linkStatus: 'LINKED',
        authProvider: 'GOOGLE',
      },
      include: { roles: true },
    });
  }

  if ((user.roles || []).length === 0) {
    const initialRole = shouldAutoGrantSuperadminEmail() && superadminEmails().includes(email) ? 'SUPERADMIN' : 'MENTEE';
    await prisma.userRole.create({
      data: { userId: user.id, tenantId: 'tenant-youth', role: initialRole },
    });
    user.roles.push({ userId: user.id, tenantId: 'tenant-youth', role: initialRole });
  }

  return persistSuperadminRole(user);
}

export function newClaimToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function newResetToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export async function claimWithGoogleCredential(credential, tokenRaw) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const token = String(tokenRaw || '').trim();
  if (!token) throw new Error('Token taut wajib.');
  const p = await verifyGoogleCredential(credential);
  const prisma = getPrisma();

  const taken = await prisma.user.findFirst({ where: { googleSub: p.sub } });
  const target = await prisma.user.findFirst({
    where: { claimToken: token },
    include: { roles: true },
  });
  if (!target) throw new Error('Taut tidak valid.');
  if (!target.claimTokenExpiresAt || target.claimTokenExpiresAt < new Date()) {
    throw new Error('Taut sudah kedaluwarsa. Minta taut baru dari admin.');
  }
  if (taken && taken.id !== target.id) {
    throw new Error('Akun Google ini sudah tertaut ke jemaat lain.');
  }
  if (p.email) {
    const emailOwner = await prisma.user.findUnique({ where: { email: p.email } });
    if (emailOwner && emailOwner.id !== target.id) {
      throw new Error('Email Google ini sudah dipakai jemaat lain.');
    }
  }

  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      googleSub: p.sub,
      linkStatus: 'LINKED',
      email: p.email,
      name: p.name || target.name,
      ...googleAvatarPatch(target, p.picture),
      claimToken: null,
      claimTokenExpiresAt: null,
      authProvider: target.passwordHash ? target.authProvider : 'GOOGLE',
    },
    include: { roles: true },
  });
  return persistSuperadminRole(user);
}

/** Tautkan Google ke user yang sudah login (self-service, tanpa claim token). */
export async function linkGoogleToSessionUser(userId, credential) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const p = await verifyGoogleCredential(credential);
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!user) throw new Error('User tidak ditemukan.');
  if (user.googleSub && user.linkStatus === 'LINKED' && user.authProvider === 'GOOGLE') {
    throw new Error('Akun sudah tertaut ke Google.');
  }

  const taken = await prisma.user.findFirst({ where: { googleSub: p.sub } });
  if (taken && taken.id !== userId) {
    throw new Error('Akun Google ini sudah tertaut ke jemaat lain.');
  }
  if (p.email) {
    const emailOwner = await prisma.user.findUnique({ where: { email: p.email } });
    if (emailOwner && emailOwner.id !== userId) {
      throw new Error('Email Google ini sudah dipakai jemaat lain.');
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      googleSub: p.sub,
      linkStatus: 'LINKED',
      email: p.email || user.email,
      name: p.name || user.name,
      ...googleAvatarPatch(user, p.picture),
      // Keep LOCAL if password exists — dual auth (Google + password backup)
      authProvider: user.passwordHash ? user.authProvider : 'GOOGLE',
    },
    include: { roles: true },
  });
  return persistSuperadminRole(updated);
}
