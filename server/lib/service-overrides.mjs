/**
 * Kondisi khusus minggu layanan (GABUNGAN/LIBUR/ALIH/GESER).
 * Raw SQL agar jalan walau generated Prisma client lebih lama dari migrasi.
 * GESER: ibadah pindah tanggal (newEventDate = tanggal efektif), pekan materi tetap.
 */

export const OVERRIDE_CONDITIONS = ['GABUNGAN', 'LIBUR', 'ALIH', 'GESER'];

function toISODate(v) {
  if (!v) return null;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Map iso YYYY-MM-DD -> { condition, note, partnerLabel, linkedEventId, newEventDate } */
export async function listOverrides(prisma, fromISO, toISO) {
  const map = new Map();
  if (!prisma) return map;
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT event_date AS eventDate, `condition`, note, partner_label AS partnerLabel, linked_event_id AS linkedEventId, new_event_date AS newEventDate FROM service_week_overrides WHERE event_date >= ? AND event_date <= ?',
      fromISO,
      toISO,
    );
    for (const r of rows || []) {
      const iso = toISODate(r.eventDate);
      if (iso) map.set(iso, {
        condition: String(r.condition || '').toUpperCase(),
        note: r.note || null,
        partnerLabel: r.partnerLabel || null,
        linkedEventId: r.linkedEventId || null,
        newEventDate: toISODate(r.newEventDate),
      });
    }
  } catch {
    /* tabel/kolom belum migrasi -> anggap semua NORMAL */
  }
  return map;
}

/**
 * Tanggal efektif ibadah: bila ada override GESER yang valid, pakai newEventDate.
 * Pekan materi TIDAK ikut — tetap dari grid Minggu.
 */
export function effectiveDate(iso, overrides) {
  const base = toISODate(iso);
  if (!base) return null;
  const ov = overrides instanceof Map ? overrides.get(base) : null;
  if (ov && String(ov.condition || '').toUpperCase() === 'GESER') {
    const target = toISODate(ov.newEventDate);
    if (target && target !== base) return target;
  }
  return base;
}

export async function upsertOverride(prisma, { eventDate, condition, note, partnerLabel, linkedEventId, newEventDate, createdById }) {
  const iso = toISODate(eventDate);
  if (!iso) throw new Error('Tanggal tidak valid (YYYY-MM-DD).');
  const cond = String(condition || '').toUpperCase();
  if (!OVERRIDE_CONDITIONS.includes(cond)) {
    throw new Error(`condition harus salah satu dari ${OVERRIDE_CONDITIONS.join(', ')}.`);
  }
  let target = null;
  if (cond === 'GESER') {
    target = toISODate(newEventDate);
    if (!target) throw new Error('GESER wajib menyertakan newEventDate (YYYY-MM-DD).');
    if (target === iso) throw new Error('Tanggal geser harus berbeda dari tanggal asal.');
  }
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO service_week_overrides (event_date, \`condition\`, note, partner_label, linked_event_id, new_event_date, created_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`condition\` = VALUES(\`condition\`), note = VALUES(note),
         partner_label = VALUES(partner_label), linked_event_id = VALUES(linked_event_id),
         new_event_date = VALUES(new_event_date)`,
      iso,
      cond,
      note ? String(note).slice(0, 500) : null,
      partnerLabel ? String(partnerLabel).slice(0, 190) : null,
      linkedEventId || null,
      target,
      createdById || null,
    );
  } catch (e) {
    throw new Error(`Gagal simpan kondisi (DB belum migrasi? npm run db:migrate:local): ${e.message}`);
  }
  return { eventDate: iso, condition: cond, ...(target ? { newEventDate: target } : {}) };
}

export async function deleteOverride(prisma, eventDate) {
  const iso = toISODate(eventDate);
  if (!iso) throw new Error('Tanggal tidak valid (YYYY-MM-DD).');
  try {
    await prisma.$executeRawUnsafe('DELETE FROM service_week_overrides WHERE event_date = ?', iso);
  } catch (e) {
    throw new Error(`Gagal hapus kondisi: ${e.message}`);
  }
  return { eventDate: iso, deleted: true };
}
