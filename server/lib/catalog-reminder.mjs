import { genId64 } from '../role-assign.mjs';
import { sendPushNotification } from '../push.mjs';

export function catalogReminderHref(catalog) {
  if (catalog === 'recreational') return '#/portal/account/profile?section=recreational';
  return '#/portal/account/profile?section=life';
}

export function catalogReminderCopy(catalog, itemLabel) {
  const label = String(itemLabel || '').trim() || 'katalog';
  if (catalog === 'recreational') {
    return {
      title: 'Minat baru bisa dipilih',
      message: `Minat “${label}” sudah ada di katalog. Buka profil → Minat untuk mencentang sendiri.`,
    };
  }
  return {
    title: 'Kampus baru bisa dipilih',
    message: `Kampus “${label}” sudah ada di katalog. Buka profil → Kuliah untuk memilih sendiri.`,
  };
}

export function institutionListQuery({ q, id } = {}) {
  const ident = String(id || '').trim();
  if (ident) return { mode: 'id', id: ident };
  const term = String(q || '').trim();
  if (term.length >= 2) return { mode: 'search', q: term, take: 40 };
  return { mode: 'empty' };
}

export function uniqueUserIds(ids) {
  return [...new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean))];
}

export async function sendCatalogReminder(prisma, { userIds, catalog, itemId, itemLabel, href }) {
  const ids = uniqueUserIds(userIds);
  if (!ids.length || !prisma) return { sent: 0 };
  const copy = catalogReminderCopy(catalog, itemLabel);
  const link = href || catalogReminderHref(catalog);
  const payload = { href: link, catalog, itemId: itemId || null };

  await prisma.notification.createMany({
    data: ids.map((memberId) => ({
      id: genId64(),
      type: 'CATALOG_REMINDER',
      memberId,
      title: copy.title,
      message: copy.message,
      payload,
      status: 'OPEN',
    })),
  });

  for (const memberId of ids) {
    try {
      const subs = await prisma.notification.findMany({
        where: { type: 'IDLE_FLAG', memberId, title: 'Push Subscription' },
        select: { message: true },
        take: 5,
      });
      const pushPayload = {
        title: copy.title,
        body: copy.message,
        icon: '/icons/icon-192.png',
        data: { type: 'CATALOG_REMINDER', url: `/${link}` },
      };
      for (const sub of subs) {
        try {
          const subData = JSON.parse(sub.message || '{}');
          if (subData.endpoint) await sendPushNotification(prisma, subData, pushPayload);
        } catch {
          /* skip bad sub */
        }
      }
    } catch {
      /* push optional */
    }
  }

  return { sent: ids.length };
}
