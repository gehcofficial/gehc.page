/**
 * Koinonia — Timeline Hari (server, murni tanpa DB).
 * Satu timeline per tanggal: blok ibadah (menunjuk event Liturgia) +
 * pengumuman/selebrasi/makan/games. Validasi/normalisasi payload.
 */

export const DAY_KINDS = [
  'ibadah-block',
  'pengumuman',
  'selebrasi',
  'makan',
  'games',
  'sambutan',
  'lainnya',
];

const str = (v, max = 500) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const intOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/** Normalisasi tanggal hari (WIB) → 'YYYY-MM-DD' atau null. */
export function normalizeDay(v) {
  const s = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

export function normalizeDayItemInput(body, existing = null) {
  const b = body || {};
  const data = {};
  if (b.day !== undefined || !existing) {
    const day = normalizeDay(b.day);
    if (!day) throw Object.assign(new Error('Tanggal hari (YYYY-MM-DD) wajib.'), { status: 400 });
    data.day = day;
  }
  if (b.kind !== undefined || !existing) {
    const kind = str(b.kind, 24)?.toLowerCase() || 'pengumuman';
    if (!DAY_KINDS.includes(kind)) throw Object.assign(new Error('Jenis blok tidak valid.'), { status: 400 });
    data.kind = kind;
  }
  const kind = data.kind || existing?.kind || 'pengumuman';
  if (b.eventId !== undefined) {
    const v = str(b.eventId, 64);
    if (kind === 'ibadah-block' && !v && !existing) {
      throw Object.assign(new Error('Blok ibadah wajib menunjuk event.'), { status: 400 });
    }
    data.eventId = v;
  } else if (!existing && kind === 'ibadah-block' && !b.eventId) {
    throw Object.assign(new Error('Blok ibadah wajib menunjuk event.'), { status: 400 });
  }
  if (b.title !== undefined) data.title = str(b.title, 200);
  if (b.body !== undefined) {
    const v = b.body === null ? null : String(b.body).slice(0, 20000);
    data.body = v && v.trim() ? v : null;
  }
  if (b.owner !== undefined) data.owner = str(b.owner, 100);
  if (b.minutes !== undefined) {
    const m = intOrNull(b.minutes);
    if (m !== null && (m < 0 || m > 1440)) throw Object.assign(new Error('Durasi 0–1440 menit.'), { status: 400 });
    data.minutes = m;
  }
  if (b.note !== undefined) data.note = str(b.note, 500);
  if (b.sortOrder !== undefined) data.sortOrder = intOrNull(b.sortOrder);
  return data;
}

export function serializeDayItem(row, eventSummary = null) {
  if (!row) return null;
  const day = row.day ?? null;
  return {
    id: row.id,
    tenantId: row.tenantId ?? row.tenant_id ?? null,
    day: day instanceof Date ? day.toISOString().slice(0, 10) : day,
    sortOrder: row.sortOrder ?? row.sort_order ?? 0,
    kind: row.kind ?? 'pengumuman',
    eventId: row.eventId ?? row.event_id ?? null,
    title: row.title ?? null,
    body: row.body ?? null,
    owner: row.owner ?? null,
    minutes: row.minutes ?? null,
    note: row.note ?? null,
    event: eventSummary || null,
  };
}
