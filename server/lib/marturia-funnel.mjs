/**
 * Funnel invite-a-friend (Sprint B): klik → daftar → hadir.
 *
 * - Klik: GET /api/r/:code (marturia.mjs).
 * - Daftar: recordReferralSignup() dipanggil non-blocking dari kedua jalur
 *   registrasi (google + local): registrations +1 dan jiwa BARU tercatat
 *   otomatis (nickname = nama pendaftar).
 * - Hadir: souls PATCH → HADIR menaikkan attendances referral terkait.
 */
import { newEntityId } from './drive-ownership.mjs';

export function normalizeRefCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  return /^GB-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code) ? code : null;
}

/** Pendaftar baru lewat link referral: catat +1 dan buat jiwa BARU. Non-blocking. */
export async function recordReferralSignup(prisma, { refCode, name }) {
  try {
    const code = normalizeRefCode(refCode);
    if (!prisma?.marturiaReferral || !code) return null;
    const ref = await prisma.marturiaReferral.findUnique({ where: { code } });
    if (!ref) return null;
    await prisma.marturiaReferral.update({
      where: { id: ref.id },
      data: { registrations: { increment: 1 } },
    });
    const nickname = String(name || '').trim().slice(0, 120) || 'Teman baru';
    const soul = await prisma.marturiaSoul.create({
      data: {
        id: newEntityId('msoul'),
        eventId: null,
        nickname,
        inviterId: ref.inviterId,
        referralCode: code,
      },
    });
    return { ref, soul };
  } catch {
    return null;
  }
}

/** Jiwa HADIR: naikkan attendances referral penaut (bila ada). Non-blocking. */
export async function recordSoulAttendance(prisma, soul) {
  try {
    const code = normalizeRefCode(soul?.referralCode);
    if (!prisma?.marturiaReferral || !code) return;
    const ref = await prisma.marturiaReferral.findUnique({ where: { code } });
    if (!ref) return;
    await prisma.marturiaReferral.update({
      where: { id: ref.id },
      data: { attendances: { increment: 1 } },
    });
  } catch { /* abaikan */ }
}
