/**
 * GEHC login username — Moonton-style identifier (distinct from display name & email).
 */
const USERNAME_RE = /^[a-z][a-z0-9._]{3,29}$/;
const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const RESERVED = new Set([
  'admin', 'root', 'system', 'gehc', 'portal', 'login', 'register', 'api', 'operator', 'support',
]);

export function normalizeUsername(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

export function slugUsernameFromName(name) {
  const base = normalizeUsername(
    String(name || 'user')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  );
  const trimmed = base.slice(0, 28) || 'user';
  return trimmed.length >= 4 ? trimmed : `${trimmed}${Math.floor(Math.random() * 900 + 100)}`;
}

export function validateUsername(username) {
  const u = normalizeUsername(username);
  if (!u) return 'Username wajib.';
  if (u.length < 4) return 'Username minimal 4 karakter.';
  if (u.length > 30) return 'Username maksimal 30 karakter.';
  if (!USERNAME_RE.test(u)) {
    return 'Username: huruf kecil, angka, titik, underscore; harus diawali huruf.';
  }
  if (RESERVED.has(u)) return 'Username tidak tersedia.';
  return null;
}

export function canChangeUsername(user) {
  if (!user?.usernameChangedAt) return { ok: true };
  const elapsed = Date.now() - new Date(user.usernameChangedAt).getTime();
  if (elapsed < USERNAME_COOLDOWN_MS) {
    const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / 86400000);
    return { ok: false, error: `Username bisa diubah lagi dalam ${daysLeft} hari.` };
  }
  return { ok: true };
}

export async function findUserByLoginIdentifier(prisma, identifierRaw) {
  const raw = String(identifierRaw || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('@')) {
    return prisma.user.findUnique({ where: { email: lower }, include: { roles: true } });
  }
  const username = normalizeUsername(raw);
  if (username) {
    const byUsername = await prisma.user.findFirst({
      where: { loginUsername: username },
      include: { roles: true },
    });
    if (byUsername) return byUsername;
  }
  return prisma.user.findUnique({ where: { email: lower }, include: { roles: true } });
}

export async function ensureUniqueUsername(prisma, baseUsername, excludeUserId = null) {
  let candidate = normalizeUsername(baseUsername);
  const err = validateUsername(candidate);
  if (err) throw new Error(err);

  for (let i = 0; i < 20; i++) {
    const existing = await prisma.user.findFirst({
      where: {
        loginUsername: candidate,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
    });
    if (!existing) return candidate;
    candidate = `${candidate.slice(0, 24)}${i + 2}`;
  }
  throw new Error('Tidak bisa menghasilkan username unik.');
}
