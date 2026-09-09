import crypto from 'node:crypto';

const nid = () => `ntf-${crypto.randomUUID()}`;

/** userId pemegang peran Komisi/Superadmin (penerima antrean approval). */
export async function approverUserIds(prisma) {
  try {
    const rows = await prisma.userRole.findMany({
      where: { role: { in: ['KOMISI', 'SUPERADMIN'] } },
      select: { userId: true },
      take: 100,
    });
    return [...new Set(rows.map((r) => r.userId).filter(Boolean))];
  } catch {
    return [];
  }
}

/**
 * Notif instan 1 antrean — sekali per item (dedupe OPEN berkunci queue+itemId).
 * Aman dipanggil di tiap pembuatan antrean; duplikat sunyi.
 */
export async function notifyApprovalItem(prisma, { queue, itemId, title, message, url }) {
  if (!queue || !itemId) return 0;
  try {
    const recipients = await approverUserIds(prisma);
    if (!recipients.length) return 0;
    // Dedupe presisi: payload JSON tidak bisa di-where portabel → ambil kandidat
    // OPEN terbaru lalu cocokkan di memori (murah: antrean harian kecil).
    const open = await prisma.notification.findMany({
      where: { type: 'APPROVAL_ITEM', status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }).catch(() => []);
    const exists = open.some((n) => {
      const p = n.payload && typeof n.payload === 'object' ? n.payload : null;
      return p && p.queue === queue && String(p.itemId) === String(itemId);
    });
    if (exists) return 0;
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        id: nid(),
        type: 'APPROVAL_ITEM',
        memberId: userId,
        title,
        message,
        payload: { queue, itemId: String(itemId), url: url || null },
        status: 'OPEN',
      })),
    });
    return recipients.length;
  } catch (e) {
    console.warn('[approval-notify] gagal:', e?.message || e);
    return 0;
  }
}
