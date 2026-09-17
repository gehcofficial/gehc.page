import { getPrisma } from '../db.mjs';
import { sendPushNotification } from '../push.mjs';

/** Kategori notifikasi (juga kolom boolean di notification_preferences). */
export const NOTIFY_CATEGORIES = ['announcement', 'warta', 'kegiatan', 'penatalayan', 'tugas', 'pengingat', 'birthday', 'materi'];

const CATEGORY_TO_TYPE = {
  announcement: 'ANNOUNCEMENT',
  warta: 'IDLE_FLAG',
  kegiatan: 'IDLE_FLAG',
  penatalayan: 'IDLE_FLAG',
  tugas: 'APPROVAL_ITEM',
  pengingat: 'RUNBOOK_DUE',
  birthday: 'BIRTHDAY_WISH',
  materi: 'IDLE_FLAG',
};

const CAP_PUBLIC = {
  audiences: ['PUBLIC', 'ROLE', 'DIVISION', 'GROUP', 'USER'],
  categories: [...NOTIFY_CATEGORIES],
};
const CAP_BOD = {
  audiences: ['ROLE', 'DIVISION', 'GROUP', 'USER'],
  categories: ['announcement', 'kegiatan', 'penatalayan', 'tugas', 'pengingat', 'materi'],
};
const CAP_PIC = {
  audiences: ['DIVISION', 'GROUP', 'USER'],
  categories: ['kegiatan', 'penatalayan', 'pengingat', 'tugas', 'materi'],
};
const CAP_MENTOR = {
  audiences: ['GROUP', 'USER'],
  categories: ['announcement', 'penatalayan', 'pengingat', 'tugas'],
};

/**
 * Kapabilitas pengirim: audiens & kategori yang boleh + scope divisi/grup.
 * @param {{ roles?: Array<{role:string}>, email?: string }} user
 * @param {string|null} strukturDivision
 */
export function senderCapabilities(user, strukturDivision = null) {
  const roles = (user?.roles || []).map((r) => String(r.role).toUpperCase());
  if (roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('BPMJ')) {
    return { ...CAP_PUBLIC, role: roles.includes('BPMJ') ? 'BPMJ' : roles.includes('KOMISI') ? 'KOMISI' : 'SUPERADMIN', scopeDivision: null, isBod: true };
  }
  if (roles.includes('COMMITTEE')) {
    const div = String(strukturDivision || '').toUpperCase();
    const isBod = !div || div === 'TIMKERJA';
    return { ...(isBod ? CAP_BOD : CAP_PIC), role: isBod ? 'COMMITTEE' : 'COMMITTEE', scopeDivision: isBod ? null : div, isBod };
  }
  if (roles.includes('MENTOR') || roles.includes('CO_MENTOR')) {
    return { ...CAP_MENTOR, role: roles.includes('MENTOR') ? 'MENTOR' : 'CO_MENTOR', scopeDivision: null, isBod: false };
  }
  return { audiences: [], categories: [], role: roles[0] || 'MENTEE', scopeDivision: null, isBod: false };
}

async function readJsonIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

/** Resolve audiens → daftar userId unik. */
export async function resolveAudience(prisma, audience = {}) {
  const { type } = audience;
  if (type === 'PUBLIC') {
    const rows = await prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] }).catch(() => []);
    return [...new Set(rows.map((r) => r.userId))];
  }
  if (type === 'USER') {
    return [...new Set(await readJsonIds(audience.userIds))];
  }
  if (type === 'ROLE') {
    const roles = await readJsonIds(audience.roles);
    if (!roles.length) return [];
    const rows = await prisma.roleAssignment.findMany({
      where: { isActive: true, role: { in: roles } },
      select: { userId: true },
    }).catch(() => []);
    return [...new Set(rows.map((r) => r.userId))];
  }
  if (type === 'GROUP') {
    const groupIds = await readJsonIds(audience.groupIds);
    if (!groupIds.length) return [];
    const rows = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds }, status: 'ACTIVE', userId: { not: null } },
      select: { userId: true },
    }).catch(() => []);
    return [...new Set(rows.map((r) => r.userId).filter(Boolean))];
  }
  if (type === 'DIVISION') {
    const divisions = await readJsonIds(audience.divisions);
    if (!divisions.length) return [];
    const [ra, sm] = await Promise.all([
      prisma.roleAssignment.findMany({
        where: { isActive: true, division: { in: divisions } },
        select: { userId: true },
      }).catch(() => []),
      prisma.strukturMember.findMany({
        where: { division: { in: divisions } },
        select: { email: true },
      }).catch(() => []),
    ]);
    const userIds = new Set(ra.map((r) => r.userId));
    const emails = sm.map((r) => r.email).filter(Boolean);
    if (emails.length) {
      const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } }).catch(() => []);
      for (const u of users) userIds.add(u.id);
    }
    return [...userIds];
  }
  return [];
}

async function preferencesByCategory(prisma, userIds, category) {
  try {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, [category]: true },
    });
    const off = new Set(rows.filter((r) => r[category] === false).map((r) => r.userId));
    return (userId) => !off.has(userId);
  } catch {
    return () => true;
  }
}

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Kirim notifikasi: tulis inbox per penerima + push (opsional), hormati preferensi.
 */
export async function sendNotification({
  type,
  category = 'announcement',
  title,
  message = '',
  href = null,
  payload = null,
  senderRole = null,
  audience,
  priority = 'INFO',
  push = true,
  announcementId = null,
}) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  let userIds = await resolveAudience(prisma, audience);
  if (!userIds.length) return { count: 0, pushed: 0 };

  const allowed = await preferencesByCategory(prisma, userIds, category);
  userIds = userIds.filter(allowed);

  const normHref = href ? (String(href).startsWith('/') ? String(href) : `/${href}`) : null;
  const notifType = type || CATEGORY_TO_TYPE[category] || 'ANNOUNCEMENT';
  const rows = userIds.map((userId) => ({
    id: genId('ntf'),
    type: notifType,
    memberId: userId,
    title: String(title || '').slice(0, 190),
    message: message || null,
    payload: { ...(payload || {}), href: normHref, category, senderRole, priority },
    category,
    announcementId,
    senderRole,
    status: 'OPEN',
  }));
  for (let i = 0; i < rows.length; i += 100) {
    await prisma.notification.createMany({ data: rows.slice(i, i + 100) }).catch((e) => {
      console.warn('[notify] createMany gagal:', e?.message || e);
    });
  }

  let pushed = 0;
  if (push) pushed = await pushToUsers(prisma, userIds, { title, message, href: normHref, category, senderRole, priority, announcementId });
  return { count: userIds.length, pushed };
}

/** Kirim web-push ke semua langganan user; bersihkan yang kedaluwarsa. */
export async function pushToUsers(prisma, userIds, info) {
  if (!userIds.length) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }).catch(() => []);
  if (!subs.length) return 0;
  const payload = {
    title: info.title || 'GEHC Youth',
    body: info.message || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: info.announcementId ? `ann-${info.announcementId}` : `ntf-${Date.now()}`,
    requireInteraction: info.priority === 'URGENT',
    data: {
      type: info.category || 'announcement',
      url: info.href || '/#/portal',
      category: info.category,
      senderRole: info.senderRole,
      announcementId: info.announcementId || null,
    },
  };
  let sent = 0;
  for (const sub of subs) {
    const result = await sendPushNotification(
      prisma,
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    );
    if (result === 'expired') {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    } else if (result) {
      sent += 1;
      await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSeenAt: new Date(), failureCount: 0 } }).catch(() => {});
    } else {
      const next = (sub.failureCount || 0) + 1;
      if (next >= 5) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      else await prisma.pushSubscription.update({ where: { id: sub.id }, data: { failureCount: next } }).catch(() => {});
    }
  }
  return sent;
}
