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

function verifySession(token) {
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

export function setSessionCookie(res, payload) {
  const token = signSession({ ...payload, exp: Date.now() + SESSION_TTL_MS });
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
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
  if (isSuperadminEmail(user.email) && !(user.roles || []).some((r) => r.role === 'SUPERADMIN')) {
    const tenantId = user.roles?.[0]?.tenantId || 'tenant-youth';
    user.roles = [...(user.roles || []), { userId: user.id, tenantId, role: 'SUPERADMIN' }];
  }
  user.roles = dedupeRoles(user.roles);
  return user;
}

export async function persistSuperadminRole(user) {
  if (!user || !isSuperadminEmail(user.email)) return applySuperadminSession(user);
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

/** Muat User + roles dari DB berdasarkan uid di sesi. */
async function loadUserByUid(uid) {
  const prisma = getPrisma();
  if (!prisma) return null;
  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: { roles: true },
  });
  return applySuperadminSession(user);
}

/** Middleware: pasang req.authUser (atau null) dari cookie sesi. */
export async function attachUser(req, _res, next) {
  req.authUser = null;
  const session = verifySession(parseCookies(req)[COOKIE_NAME]);
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

/** Login email+password → user lengkap dgn roles. */
export async function loginLocal(emailRaw, password) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const email = String(emailRaw || '').toLowerCase().trim();
  const prisma = getPrisma();
  const u = await prisma.user.findUnique({ where: { email }, include: { roles: true } });
  // Pesan sengaja sama agar tak membocorkan keberadaan email
  if (!u || !u.passwordHash || !verifyPassword(password, u.passwordHash)) {
    throw new Error('Email atau kata sandi salah.');
  }
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
        avatar: p.picture || undefined,
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
          avatar: p.picture || undefined,
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
        avatar: p.picture || null,
        googleSub: p.sub,
        linkStatus: 'LINKED',
        bipra: 'PEMUDA',
        authProvider: 'GOOGLE',
      },
      update: {
        email,
        name: p.name || undefined,
        avatar: p.picture || undefined,
        googleSub: p.sub,
        linkStatus: 'LINKED',
        authProvider: 'GOOGLE',
      },
      include: { roles: true },
    });
  }

  if ((user.roles || []).length === 0) {
    const initialRole = superadminEmails().includes(email) ? 'SUPERADMIN' : 'MENTEE';
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
      avatar: p.picture || target.avatar,
      claimToken: null,
      claimTokenExpiresAt: null,
      authProvider: 'GOOGLE',
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
      avatar: p.picture || user.avatar,
      authProvider: 'GOOGLE',
    },
    include: { roles: true },
  });
  return persistSuperadminRole(updated);
}
