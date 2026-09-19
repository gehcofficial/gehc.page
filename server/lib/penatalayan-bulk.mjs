/**
 * Penugasan penatalayan massal: cross-product komponen × orang × tanggal.
 * Murni (tanpa DB) supaya mudah diuji; batas baris menjaga request tetap wajar.
 */

export const MAX_BULK_ROWS = 500;

const uniq = (list) => [...new Set((list || []).map((x) => String(x || '').trim()).filter(Boolean))];

export const dayKey = (value) => {
  // Prisma @db.Date mengembalikan Date → normalisasi ke ISO dulu.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

export function formatDayID(iso) {
  const s = dayKey(iso);
  if (!s) return '';
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Bangun daftar penugasan (role × user × date).
 * @returns {{ rows: Array<{serviceRoleId:string,userId:string,date:string}>, total:number, overCap:boolean }}
 */
export function buildAssignments({ roleIds = [], userIds = [], dates = [] } = {}) {
  const roles = uniq(roleIds);
  const users = uniq(userIds);
  const days = uniq(dates.map(dayKey).filter(Boolean));
  const total = roles.length * users.length * days.length;
  if (total > MAX_BULK_ROWS) return { rows: [], total, overCap: true };
  const rows = [];
  for (const serviceRoleId of roles) {
    for (const userId of users) {
      for (const date of days) rows.push({ serviceRoleId, userId, date });
    }
  }
  return { rows, total, overCap: false };
}

/** Kunci unik baris (untuk deteksi duplikat). */
export const rowKey = (serviceRoleId, userId, date) => `${serviceRoleId}|${userId}|${dayKey(date)}`;

/**
 * Ringkas penugasan per orang → satu pesan notifikasi (hindari spam).
 * @returns {Array<{ userId:string, count:number, message:string }>}
 */
export function summarizeByUser(rows = [], { roleNames = {}, maxItems = 4 } = {}) {
  const byUser = new Map();
  for (const r of rows || []) {
    const key = r.userId;
    if (!key) continue;
    const list = byUser.get(key) || [];
    const role = roleNames[r.serviceRoleId] || 'Petugas';
    list.push(`${role} (${formatDayID(r.date)})`);
    byUser.set(key, list);
  }
  return [...byUser.entries()].map(([userId, items]) => {
    const shown = items.slice(0, maxItems).join(', ');
    const rest = items.length > maxItems ? `, +${items.length - maxItems} lain` : '';
    return {
      userId,
      count: items.length,
      message: `Anda dijadwalkan: ${shown}${rest}.`,
    };
  });
}
