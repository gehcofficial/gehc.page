/**
 * Hapus akun jemaat — relasi FK dulu, lalu row users.
 */
import { PLATFORM_OPS_USER_ID } from '../role-assign.mjs';

export const DELETE_CONFIRM_PHRASE = 'HAPUS';

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

export function confirmTokensForUser(user) {
  const tokens = new Set();
  if (!user) return tokens;
  if (user.id) tokens.add(norm(user.id));
  if (user.loginUsername) {
    const u = norm(user.loginUsername);
    tokens.add(u);
    tokens.add(`@${u}`);
  }
  if (user.email) tokens.add(norm(user.email));
  if (user.name) tokens.add(norm(user.name));
  return tokens;
}

export function confirmMatchesUser(user, raw) {
  const typed = norm(raw);
  if (!typed) return false;
  return confirmTokensForUser(user).has(typed);
}

export function isGoogleLinkedUser(user) {
  return Boolean(user?.googleSub && String(user.linkStatus || '').toUpperCase() === 'LINKED');
}

export function assertUserDeleteAllowed({ actorId, target, confirm, confirmPhrase }) {
  if (!target) {
    const err = new Error('User tidak ditemukan.');
    err.status = 404;
    throw err;
  }
  if (target.id === PLATFORM_OPS_USER_ID || target.accountKind === 'SYSTEM_LEGACY') {
    const err = new Error('Akun sistem tidak dapat dihapus.');
    err.status = 403;
    throw err;
  }
  if (actorId && target.id === actorId) {
    const err = new Error('Tidak bisa menghapus akun yang sedang dipakai.');
    err.status = 403;
    throw err;
  }
  if (!confirmMatchesUser(target, confirm)) {
    const err = new Error('Konfirmasi tidak cocok. Ketik username, email, atau nama lengkap persis.');
    err.status = 400;
    throw err;
  }
  if (isGoogleLinkedUser(target) && norm(confirmPhrase) !== norm(DELETE_CONFIRM_PHRASE)) {
    const err = new Error(`Akun Google tertaut. Ketik ${DELETE_CONFIRM_PHRASE} untuk konfirmasi kedua.`);
    err.status = 400;
    throw err;
  }
}

async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[user-delete] ${label}:`, err.message);
  }
}

export async function purgeUserRelations(prisma, userId) {
  await safe('orgAssignment', () =>
    prisma.orgAssignment.deleteMany({ where: { OR: [{ userId }, { assignedBy: userId }] } }),
  );
  await safe('roleAssignment', () =>
    prisma.roleAssignment.deleteMany({ where: { OR: [{ userId }, { assignedBy: userId }] } }),
  );
  await safe('userRole', () => prisma.userRole.deleteMany({ where: { userId } }));
  await safe('waitingPool', () => prisma.waitingPool.deleteMany({ where: { userId } }));
  await safe('groupMember', () => prisma.groupMember.deleteMany({ where: { userId } }));
  await safe('recreationalMembership', () => prisma.recreationalMembership.deleteMany({ where: { userId } }));
  await safe('recreationalSuggestion', () => prisma.recreationalSuggestion.deleteMany({ where: { userId } }));
  await safe('churchDataRequest', () => prisma.profileChurchDataRequest.deleteMany({ where: { userId } }));
  await safe('monitoring', () => prisma.monitoringRecord.deleteMany({ where: { mentorId: userId } }));
  await safe('mentorTransition', () =>
    prisma.mentorTransition.deleteMany({
      where: { OR: [{ outgoingUserId: userId }, { incomingUserId: userId }, { createdById: userId }] },
    }),
  );
  await safe('attendance recorder', () =>
    prisma.attendanceRecord.updateMany({ where: { recordedById: userId }, data: { recordedById: null } }),
  );
  await safe('eventAttendee', () => prisma.eventAttendee.deleteMany({ where: { userId } }));
  await safe('eventCheckIn', () => prisma.eventCheckIn.deleteMany({ where: { userId } }));
  await safe('eventQuestionAnswer', () => prisma.eventQuestionAnswer.deleteMany({ where: { userId } }));
  await safe('eventDivisionMember', () => prisma.eventDivisionMember.deleteMany({ where: { userId } }));
  await safe('eq request reviewer', () =>
    prisma.eventQuestionRequest.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } }),
  );
  await safe('eq request creator', () => prisma.eventQuestionRequest.deleteMany({ where: { createdById: userId } }));
  await safe('notification', () => prisma.notification.deleteMany({ where: { memberId: userId } }));
  await safe('testimonial', () => prisma.testimonial.deleteMany({ where: { userId } }));
  await safe('strukturMember', () => prisma.strukturMember.deleteMany({ where: { userId } }));
  await safe('platformAdminGrant', () => prisma.platformAdminGrant.deleteMany({ where: { userId } }));
  await safe('accessGroupMember', () => prisma.accessGroupMember.deleteMany({ where: { userId } }));
  await safe('order', () => prisma.order.deleteMany({ where: { userId } }));
  await safe('product', () => prisma.product.deleteMany({ where: { createdById: userId } }));
  await safe('serviceSchedule', () => prisma.serviceSchedule.deleteMany({ where: { userId } }));
}

export async function deleteCongregationUser(prisma, { actorId, target, confirm, confirmPhrase }) {
  assertUserDeleteAllowed({ actorId, target, confirm, confirmPhrase });
  await purgeUserRelations(prisma, target.id);
  await prisma.user.delete({ where: { id: target.id } });
  return { ok: true, id: target.id };
}
