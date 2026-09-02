/**
 * Platform operator session + WebAuthn passkey auth.
 */
import crypto from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getPrisma, isDbConfigured } from './db.mjs';
import { hashPassword, verifyPassword, parseCookies } from './auth.mjs';
import { writePlatformAudit } from './platform-operators.mjs';

export const OPERATOR_COOKIE_NAME = 'gehc_operator_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function getOperatorSessionSecret() {
  if (process.env.OPERATOR_SESSION_SECRET) return process.env.OPERATOR_SESSION_SECRET;
  return 'gehc-op::' + crypto.createHash('sha256').update(process.env.DATABASE_URL || 'no-db').digest('hex');
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signOperatorSession(payload) {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getOperatorSessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOperatorSession(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', getOperatorSessionSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.oid || payload.actorType !== 'operator' || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readOperatorSession(req) {
  return verifyOperatorSession(parseCookies(req)[OPERATOR_COOKIE_NAME]);
}

export function setOperatorSessionCookie(res, operator) {
  const token = signOperatorSession({
    oid: operator.id,
    email: operator.email,
    actorType: 'operator',
    exp: Date.now() + SESSION_TTL_MS,
  });
  res.setHeader(
    'Set-Cookie',
    `${OPERATOR_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  );
}

export function clearOperatorSessionCookie(res) {
  res.setHeader('Set-Cookie', `${OPERATOR_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function getWebAuthnConfig() {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  let origin = process.env.WEBAUTHN_ORIGIN || appUrl;
  let rpID = process.env.WEBAUTHN_RP_ID;
  try {
    const u = new URL(origin);
    origin = u.origin;
    if (!rpID) rpID = u.hostname;
  } catch {
    origin = 'http://localhost:3000';
    rpID = rpID || 'localhost';
  }
  return { rpName: 'GEHC Platform', rpID, origin };
}

function parseCredentials(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export async function loadOperatorById(id) {
  const prisma = getPrisma();
  if (!prisma || !id) return null;
  return prisma.platformOperator.findUnique({ where: { id } });
}

export async function loadOperatorByEmail(emailRaw) {
  const prisma = getPrisma();
  if (!prisma) return null;
  const email = String(emailRaw || '').toLowerCase().trim();
  if (!email) return null;
  return prisma.platformOperator.findUnique({ where: { email } });
}

async function storeChallenge(operatorId, challenge) {
  const prisma = getPrisma();
  await prisma.platformOperator.update({
    where: { id: operatorId },
    data: {
      currentChallenge: challenge,
      challengeExpiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
}

async function consumeChallenge(operator) {
  if (!operator.challengeExpiresAt || operator.challengeExpiresAt < new Date()) {
    throw new Error('Challenge kedaluwarsa. Muat ulang dan coba lagi.');
  }
  const challenge = operator.currentChallenge;
  if (!challenge) throw new Error('Challenge tidak ditemukan.');
  const prisma = getPrisma();
  await prisma.platformOperator.update({
    where: { id: operator.id },
    data: { currentChallenge: null, challengeExpiresAt: null },
  });
  return challenge;
}

export async function createPasskeyRegistrationOptions(operatorId) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const operator = await loadOperatorById(operatorId);
  if (!operator || operator.status !== 'ACTIVE') throw new Error('Operator tidak ditemukan.');
  const { rpName, rpID } = getWebAuthnConfig();
  const credentials = parseCredentials(operator.webauthnCredentials);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: operator.email,
    userDisplayName: operator.displayName,
    userID: Buffer.from(operator.id),
    attestationType: 'none',
    excludeCredentials: credentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key',
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
  await storeChallenge(operator.id, options.challenge);
  return options;
}

export async function verifyPasskeyRegistration(operatorId, body) {
  const operator = await loadOperatorById(operatorId);
  if (!operator) throw new Error('Operator tidak ditemukan.');
  const expectedChallenge = await consumeChallenge(operator);
  const { origin, rpID } = getWebAuthnConfig();
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registrasi passkey gagal.');
  }
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const credentials = parseCredentials(operator.webauthnCredentials);
  credentials.push({
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: body.response?.transports || [],
  });
  const prisma = getPrisma();
  await prisma.platformOperator.update({
    where: { id: operator.id },
    data: { webauthnCredentials: credentials },
  });
  await writePlatformAudit({
    actorType: 'OPERATOR',
    actorId: operator.id,
    action: 'PASSKEY_REGISTERED',
    targetType: 'OPERATOR',
    targetId: operator.id,
  });
  return { ok: true };
}

export async function createPasskeyLoginOptions(emailRaw) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const operator = await loadOperatorByEmail(emailRaw);
  if (!operator || operator.status !== 'ACTIVE') {
    throw new Error('Operator tidak ditemukan.');
  }
  const credentials = parseCredentials(operator.webauthnCredentials);
  if (!credentials.length) throw new Error('Belum ada passkey terdaftar untuk akun ini.');
  const { rpID } = getWebAuthnConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key',
      transports: c.transports,
    })),
    userVerification: 'preferred',
  });
  await storeChallenge(operator.id, options.challenge);
  return { options, operatorId: operator.id };
}

export async function verifyPasskeyLogin(emailRaw, body) {
  const operator = await loadOperatorByEmail(emailRaw);
  if (!operator) throw new Error('Operator tidak ditemukan.');
  const expectedChallenge = await consumeChallenge(operator);
  const credentials = parseCredentials(operator.webauthnCredentials);
  const cred = credentials.find((c) => c.credentialId === body.id);
  if (!cred) throw new Error('Passkey tidak dikenali.');
  const { origin, rpID } = getWebAuthnConfig();
  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: cred.credentialId,
      publicKey: Buffer.from(cred.publicKey, 'base64url'),
      counter: cred.counter,
      transports: cred.transports,
    },
    requireUserVerification: false,
  });
  if (!verification.verified) throw new Error('Login passkey gagal.');
  const newCounter = verification.authenticationInfo.newCounter;
  const updated = credentials.map((c) =>
    c.credentialId === cred.credentialId ? { ...c, counter: newCounter } : c,
  );
  const prisma = getPrisma();
  const fresh = await prisma.platformOperator.update({
    where: { id: operator.id },
    data: {
      webauthnCredentials: updated,
      lastLoginAt: new Date(),
    },
  });
  await writePlatformAudit({
    actorType: 'OPERATOR',
    actorId: operator.id,
    action: 'OPERATOR_LOGIN_PASSKEY',
    targetType: 'OPERATOR',
    targetId: operator.id,
  });
  return fresh;
}

const localLoginAttempts = new Map();

export async function loginOperatorLocal(emailRaw, password) {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const email = String(emailRaw || '').toLowerCase().trim();
  const key = `local:${email}`;
  const now = Date.now();
  const attempt = localLoginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > attempt.resetAt) {
    attempt.count = 0;
    attempt.resetAt = now + 15 * 60 * 1000;
  }
  if (attempt.count >= 8) throw new Error('Terlalu banyak percobaan. Coba lagi nanti.');
  attempt.count += 1;
  localLoginAttempts.set(key, attempt);

  const operator = await loadOperatorByEmail(email);
  if (!operator || operator.status !== 'ACTIVE' || !operator.passwordHash) {
    throw new Error('Email atau kata sandi salah.');
  }
  if (!verifyPassword(password, operator.passwordHash)) {
    throw new Error('Email atau kata sandi salah.');
  }
  localLoginAttempts.delete(key);
  const prisma = getPrisma();
  const fresh = await prisma.platformOperator.update({
    where: { id: operator.id },
    data: { lastLoginAt: new Date() },
  });
  await writePlatformAudit({
    actorType: 'OPERATOR',
    actorId: operator.id,
    action: 'OPERATOR_LOGIN_LOCAL',
    targetType: 'OPERATOR',
    targetId: operator.id,
  });
  return fresh;
}

export async function upsertOperator({ id, email, displayName, password }) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const normalized = String(email).toLowerCase().trim();
  const data = {
    email: normalized,
    displayName: displayName || 'Platform Operator',
    isRoot: true,
    isProtected: true,
    status: 'ACTIVE',
  };
  if (password) data.passwordHash = hashPassword(password);
  return prisma.platformOperator.upsert({
    where: { email: normalized },
    create: { id: id || crypto.randomBytes(32).toString('hex'), ...data },
    update: {
      displayName: data.displayName,
      ...(password ? { passwordHash: data.passwordHash } : {}),
    },
  });
}

/** Mock passkey login for E2E when WEBAUTHN_MOCK=true */
export async function mockPasskeyLogin(emailRaw) {
  if (process.env.WEBAUTHN_MOCK !== 'true') {
    throw new Error('Mock passkey tidak diaktifkan.');
  }
  const operator = await loadOperatorByEmail(emailRaw);
  if (!operator) throw new Error('Operator tidak ditemukan.');
  const prisma = getPrisma();
  return prisma.platformOperator.update({
    where: { id: operator.id },
    data: { lastLoginAt: new Date() },
  });
}
