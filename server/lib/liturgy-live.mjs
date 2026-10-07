/**
 * Liturgia — Tata Ibadah Live + Transpose Pemusik (server).
 *
 * Murni (tanpa DB): validasi/normalisasi + resolver lirik layar +
 * transpose efektif per pemusik. DB diakses di routes via Prisma.
 */
import crypto from 'node:crypto';
import {
  MOMENTS,
  parseSections,
  renderSelectedSections,
  resolveArrangement,
  stripChords,
} from './liturgy-songs.mjs';

export const ORDER_KINDS = ['lagu', 'bacaan', 'doa', 'firman', 'persembahan', 'pengumuman', 'mc'];
export const LIVE_STATUSES = ['DRAFT', 'LIVE', 'DONE'];

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

export function normalizeOrderItemInput(body, existing = null) {
  const b = body || {};
  const data = {};
  if (b.kind !== undefined || !existing) {
    const kind = str(b.kind, 24)?.toLowerCase() || 'lagu';
    if (!ORDER_KINDS.includes(kind)) throw Object.assign(new Error('Jenis momen tidak valid.'), { status: 400 });
    data.kind = kind;
  }
  const kind = data.kind || existing?.kind || 'lagu';
  if (b.serviceSongId !== undefined) {
    const v = str(b.serviceSongId, 64);
    if (kind === 'lagu' && !v && !existing) {
      throw Object.assign(new Error('Momen lagu wajib menunjuk lagu setlist.'), { status: 400 });
    }
    data.serviceSongId = v;
  } else if (!existing && kind === 'lagu' && !b.serviceSongId) {
    throw Object.assign(new Error('Momen lagu wajib menunjuk lagu setlist.'), { status: 400 });
  }
  if (b.title !== undefined) data.title = str(b.title, 200);
  if (b.body !== undefined) {
    const v = b.body === null ? null : String(b.body).slice(0, 20000);
    data.body = v && v.trim() ? v : null;
  }
  if (b.owner !== undefined) data.owner = str(b.owner, 100);
  if (b.minutes !== undefined) {
    const m = intOrNull(b.minutes);
    if (m !== null && (m < 0 || m > 600)) throw Object.assign(new Error('Durasi 0–600 menit.'), { status: 400 });
    data.minutes = m;
  }
  if (b.note !== undefined) data.note = str(b.note, 500);
  if (b.sortOrder !== undefined) data.sortOrder = intOrNull(b.sortOrder);
  return data;
}

export function serializeOrderItem(row, serviceSong = null) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.eventId ?? row.event_id ?? null,
    sortOrder: row.sortOrder ?? row.sort_order ?? 0,
    kind: row.kind ?? 'lagu',
    serviceSongId: row.serviceSongId ?? row.service_song_id ?? null,
    title: row.title ?? null,
    body: row.body ?? null,
    owner: row.owner ?? null,
    minutes: row.minutes ?? null,
    note: row.note ?? null,
    serviceSong: serviceSong || null,
  };
}

export function normalizeLiveStateInput(body) {
  const b = body || {};
  const data = {};
  if (b.status !== undefined) {
    const s = String(b.status || '').toUpperCase();
    if (!LIVE_STATUSES.includes(s)) throw Object.assign(new Error('Status tidak valid.'), { status: 400 });
    data.status = s;
  }
  if (b.currentItemId !== undefined) data.currentItemId = str(b.currentItemId, 64);
  if (b.sectionIndex !== undefined) {
    const n = intOrNull(b.sectionIndex) ?? 0;
    data.sectionIndex = Math.max(0, Math.min(200, n));
  }
  return data;
}

export function serializeLiveState(row) {
  if (!row) return null;
  return {
    eventId: row.eventId ?? row.event_id ?? null,
    status: row.status ?? 'DRAFT',
    currentItemId: row.currentItemId ?? row.current_item_id ?? null,
    sectionIndex: row.sectionIndex ?? row.section_index ?? 0,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
  };
}

export function randomAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.randomBytes(6);
  let out = '';
  for (const n of buf) out += chars[n % chars.length];
  return out;
}

export function normalizeSongSettingInput(body) {
  const b = body || {};
  const transpose = Math.max(-11, Math.min(11, intOrNull(b.transpose) || 0));
  const capo = b.capo === null || b.capo === undefined || b.capo === '' ? null : Math.max(0, Math.min(11, intOrNull(b.capo) || 0));
  return { transpose, capo };
}

export function serializeSongSetting(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceSongId: row.serviceSongId ?? row.service_song_id ?? null,
    userId: row.userId ?? row.user_id ?? null,
    transpose: row.transpose ?? 0,
    capo: row.capo ?? null,
  };
}

/** Transpose/capo efektif: setting personal menang, fallback ke nilai item. */
export function effectiveTranspose(serviceSongRow, settingRow = null) {
  const item = serviceSongRow || {};
  const baseTranspose = Number(item.transpose) || 0;
  const baseCapo = item.capo === undefined || item.capo === null ? null : item.capo;
  if (!settingRow) return { transpose: baseTranspose, capo: baseCapo };
  const t = settingRow.transpose === undefined || settingRow.transpose === null
    ? baseTranspose
    : Number(settingRow.transpose) || 0;
  const c = settingRow.capo === undefined || settingRow.capo === null ? baseCapo : settingRow.capo;
  return { transpose: t, capo: c };
}

/**
 * Lirik siap layar untuk satu momen tata ibadah.
 * - Non-lagu → { kind:'text', title, body }
 * - Lagu → { kind:'song', title, sections:[{name, lines[]}], hasLyrics, sourceUrl }
 *   (lirik bersih tanpa chord; transpose TIDAK diterapkan di layar)
 */
export function resolveLyrics(orderItem, songRow = null, serviceSongRow = null) {
  const item = orderItem || {};
  if ((item.kind || 'lagu') !== 'lagu') {
    return {
      kind: 'text',
      title: item.title || item.kind || 'Momen',
      body: item.body || '',
      owner: item.owner || null,
    };
  }
  const song = songRow || {};
  const usage = { sections: serviceSongRow?.sections ?? null };
  let sections = [];
  try {
    sections = resolveArrangement(String(song.lyricsChordPro || ''), usage.sections)
      .map((s) => ({
        name: s.label,
        lines: s.lines.map((l) => stripChords(l).trim()).filter((l) => l.length > 0),
      }))
      .filter((s) => s.lines.length > 0);
  } catch { sections = []; }
  return {
    kind: 'song',
    title: song.title || item.title || 'Lagu',
    sourceRef: song.sourceRef ?? song.source_ref ?? null,
    sourceUrl: song.sourceUrl ?? song.source_url ?? null,
    moment: serviceSongRow?.moment ?? null,
    sections,
    hasLyrics: sections.length > 0,
  };
}

export { MOMENTS };
