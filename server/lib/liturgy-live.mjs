/**
 * Liturgia — Tata Ibadah Live + Transpose Pemusik (server).
 *
 * Murni (tanpa DB): validasi/normalisasi + resolver lirik layar +
 * transpose efektif per pemusik. DB diakses di routes via Prisma.
 */
import crypto from 'node:crypto';
import {
  MOMENTS,
  effectiveArrangement,
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
  if (b.serviceSongId !== undefined) {
    // Boleh null = slot lagu kosong (dipilih nanti). Validasi kecocokan
    // event dilakukan di routes saat serviceSongId terisi.
    data.serviceSongId = str(b.serviceSongId, 64);
  }
  if (b.segmentKey !== undefined) data.segmentKey = str(b.segmentKey, 64);
  if (b.phaseNo !== undefined) data.phaseNo = intOrNull(b.phaseNo);
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
    segmentKey: row.segmentKey ?? row.segment_key ?? null,
    phaseNo: row.phaseNo ?? row.phase_no ?? null,
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
export function resolveLyrics(orderItem, songRow = null, serviceSongRow = null, pericope = null) {
  const item = orderItem || {};
  if ((item.kind || 'lagu') !== 'lagu') {
    if ((item.kind || '') === 'firman' && !String(item.body || '').trim() && (pericope?.ref || pericope?.text)) {
      return {
        kind: 'text',
        title: item.title || (pericope.ref ? `Firman — ${pericope.ref}` : 'Firman'),
        body: [pericope.ref, pericope.text, pericope.kitabFokus ? `Kitab fokus: ${pericope.kitabFokus}` : '']
          .filter(Boolean).join('\n\n'),
        owner: item.owner || null,
        auto: true,
      };
    }
    return {
      kind: 'text',
      title: item.title || item.kind || 'Momen',
      body: item.body || '',
      owner: item.owner || null,
      auto: false,
    };
  }
  const song = songRow || {};
  const usage = { sections: serviceSongRow?.sections ?? null };
  let sections = [];
  try {
    sections = resolveArrangement(String(song.lyricsChordPro || ''), effectiveArrangement(song, usage.sections))
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

/**
 * Spec segmen pola Didaskalia: [{key, label, kind:'song'|'firman', songs?}].
 * Hanya segmen berkind song/firman yang menjadi kerangka tata ibadah;
 * fase diskusi/MC/dll dilewati.
 */
export function patternSegments(pattern) {
  const phases = Array.isArray(pattern?.phases) ? pattern.phases : [];
  const out = [];
  for (const ph of phases) {
    const segs = Array.isArray(ph?.segments) ? ph.segments : [];
    for (const s of segs) {
      if (!s || typeof s !== 'object') continue;
      const kind = String(s.kind || '').toLowerCase();
      if (kind !== 'song' && kind !== 'firman') continue;
      const key = String(s.key || '').trim().slice(0, 40);
      if (!key) continue;
      const songs = kind === 'song' ? Math.max(1, Math.min(12, Math.trunc(Number(s.songs)) || 1)) : 0;
      out.push({
        phaseNo: Number(ph.no) || 0,
        phaseTitle: String(ph.title || ''),
        key,
        label: String(s.label || key).slice(0, 80),
        kind,
        songs,
      });
    }
  }
  return out;
}

/**
 * Bangun draf kerangka order dari segmen pola: tiap slot lagu = momen
 * kind lagu tanpa serviceSongId (diisi nanti); tiap firman = momen firman
 * kosong (auto perikop saat tampil, fallback body manual).
 */
export function skeletonFromPattern(pattern) {
  const items = [];
  for (const seg of patternSegments(pattern)) {
    if (seg.kind === 'firman') {
      items.push({
        kind: 'firman',
        title: seg.label,
        body: null,
        segmentKey: `${seg.phaseNo}:${seg.key}`,
        phaseNo: seg.phaseNo,
        serviceSongId: null,
      });
      continue;
    }
    for (let i = 0; i < seg.songs; i += 1) {
      items.push({
        kind: 'lagu',
        title: `${seg.label} ${i + 1}`,
        body: null,
        segmentKey: `${seg.phaseNo}:${seg.key}`,
        phaseNo: seg.phaseNo,
        serviceSongId: null,
      });
    }
  }
  return items;
}

/**
 * Baca perikop pekan dari Studio Didaskalia via tanggal event.
 * Return {ref, text, kitabFokus} atau null (Studio kosong/belum isi).
 */
export async function readWeekPericope(prisma, eventDateISO) {
  try {
    const day = String(eventDateISO || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth: day.slice(0, 7) } });
    const weeks = plan && Array.isArray(plan.weeks) ? plan.weeks : [];
    const week = weeks.find((w) => String(w?.date || '').slice(0, 10) === day);
    const studio = week?.studio || {};
    const firman = studio.fundamentalFirman || {};
    const ref = String(firman.ref || '').trim();
    const text = String(firman.text || '').trim();
    const kitabFokus = String(studio.kitabFokus || '').trim();
    if (!ref && !text) return null;
    return { ref, text, kitabFokus };
  } catch {
    return null;
  }
}

export { MOMENTS };
