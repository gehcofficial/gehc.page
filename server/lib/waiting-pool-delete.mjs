import { normalizePhone } from './baku-tau.mjs';

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

export function confirmTokensForPoolEntry(entry) {
  const tokens = new Set();
  if (!entry) return tokens;
  if (entry.id) tokens.add(norm(entry.id));
  if (entry.name) tokens.add(norm(entry.name));
  if (entry.email) tokens.add(norm(entry.email));
  if (entry.phone) {
    const raw = String(entry.phone).trim();
    tokens.add(norm(raw));
    const digits = raw.replace(/\D/g, '');
    if (digits) tokens.add(digits);
    const n = normalizePhone(raw);
    if (n) tokens.add(n);
  }
  return tokens;
}

export function confirmMatchesPoolEntry(entry, raw) {
  const typed = String(raw || '').trim();
  if (!typed) return false;
  const tokens = confirmTokensForPoolEntry(entry);
  if (tokens.has(norm(typed))) return true;
  const digits = typed.replace(/\D/g, '');
  if (digits && tokens.has(digits)) return true;
  const n = normalizePhone(typed);
  if (n && tokens.has(n)) return true;
  return false;
}

export function assertPoolRegistrationDeleteAllowed({ entry, confirm }) {
  if (!entry) {
    const err = new Error('Entri tidak ditemukan.');
    err.status = 404;
    throw err;
  }
  if (entry.status !== 'REGISTERED') {
    const err = new Error(
      'Hanya Quick Register (counter tanpa akun) yang bisa dihapus di sini. Akun portal dihapus di Orang & Undangan.',
    );
    err.status = 400;
    throw err;
  }
  if (entry.userId) {
    const err = new Error('Entri ini sudah tertaut akun. Hapus akun di Orang & Undangan → Semua Akun.');
    err.status = 409;
    throw err;
  }
  if (!confirmMatchesPoolEntry(entry, confirm)) {
    const err = new Error('Konfirmasi tidak cocok. Ketik nama lengkap atau nomor WhatsApp persis.');
    err.status = 400;
    throw err;
  }
}

async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[waiting-pool-delete] ${label}:`, err.message);
  }
}

export async function deleteQuickRegisterEntry(prisma, { entry, confirm }) {
  assertPoolRegistrationDeleteAllowed({ entry, confirm });
  await safe('eventCheckIn', () => prisma.eventCheckIn.deleteMany({ where: { waitingPoolId: entry.id } }));
  await prisma.waitingPool.delete({ where: { id: entry.id } });
  return { ok: true, id: entry.id };
}
