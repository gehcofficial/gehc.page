/**
 * Kondisi khusus minggu layanan (GABUNGAN/LIBUR/ALIH).
 * Raw SQL agar jalan walau generated Prisma client lebih lama dari migrasi.
 */

export const OVERRIDE_CONDITIONS = ['GABUNGAN', 'LIBUR', 'ALIH'];

function toISODate(v) {
  if (!v) return null;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Map iso YYYY-MM-DD -> { condition, note, partnerLabel, linkedEventId } */
export async function listOverrides(prisma, fromISO, toISO) {
  const map = new Map();
  if (!prisma) return map;
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT event_date AS eventDate, `condition`, note, partner_label AS partnerLabel, linked_event_id AS linkedEventId FROM service_week_overrides WHERE event_date >= ? AND event_date <= ?',
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
      });
    }
  } catch {
    /* tabel belum migrasi -> anggap semua NORMAL */
  }
  return map;
}

export async function upsertOverride(prisma, { eventDate, condition, note, partnerLabel, linkedEventId, createdById }) {
  const iso = toISODate(eventDate);
  if (!iso) throw new Error('Tanggal tidak valid (YYYY-MM-DD).');
  const cond = String(condition || '').toUpperCase();
  if (!OVERRIDE_CONDITIONS.includes(cond)) {
    throw new Error(`condition harus salah satu dari ${OVERRIDE_CONDITIONS.join(', ')}.`);
  }
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO service_week_overrides (event_date, \`condition\`, note, partner_label, linked_event_id, created_by_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`condition\` = VALUES(\`condition\`), note = VALUES(note),
         partner_label = VALUES(partner_label), linked_event_id = VALUES(linked_event_id)`,
      iso,
      cond,
      note ? String(note).slice(0, 500) : null,
      partnerLabel ? String(partnerLabel).slice(0, 190) : null,
      linkedEventId || null,
      createdById || null,
    );
  } catch (e) {
    throw new Error(`Gagal simpan kondisi (DB belum migrasi? npm run db:migrate:local): ${e.message}`);
  }
  return { eventDate: iso, condition: cond };
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
