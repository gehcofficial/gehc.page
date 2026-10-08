/**
 * Liturgia Live — tipe + hash routing klien untuk layar & kontrol tata ibadah.
 * Rute: `#/ibadah/<eventKey>/layar` (proyektor + HP jemaat, read-only)
 *       `#/ibadah/<eventKey>/kontrol` (operator Liturgia, login).
 */

export type OrderKind = 'lagu' | 'bacaan' | 'doa' | 'firman' | 'persembahan' | 'pengumuman' | 'mc';

export interface DisplaySection {
  name: string;
  lines: string[];
}

export interface DisplayPayload {
  kind: 'song' | 'text';
  title: string;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  moment?: string | null;
  sections?: DisplaySection[];
  hasLyrics?: boolean;
  body?: string;
  owner?: string | null;
}

export interface OrderItem {
  id: string;
  eventId?: string | null;
  sortOrder: number;
  kind: OrderKind | string;
  serviceSongId?: string | null;
  segmentKey?: string | null;
  phaseNo?: number | null;
  title?: string | null;
  body?: string | null;
  owner?: string | null;
  minutes?: number | null;
  note?: string | null;
  serviceSong?: {
    id: string;
    moment?: string | null;
    baseKey?: string | null;
    transpose?: number;
    capo?: number | null;
    sections?: string[] | null;
    song?: { id: string; title: string; sourceRef?: string | null } | null;
  } | null;
  display?: DisplayPayload | null;
}

export interface LiveState {
  eventId?: string | null;
  status: 'DRAFT' | 'LIVE' | 'DONE';
  currentItemId?: string | null;
  sectionIndex: number;
  updatedAt?: string | null;
}

export interface LivePayload {
  eventId: string;
  eventName?: string | null;
  state: LiveState | null;
  items: OrderItem[];
}

export const KIND_LABEL: Record<string, string> = {
  lagu: 'Lagu',
  bacaan: 'Bacaan',
  doa: 'Doa',
  firman: 'Firman',
  persembahan: 'Persembahan',
  pengumuman: 'Pengumuman',
  mc: 'MC',
};

export function parseLiturgyHash(hash: string): { eventKey: string; view: 'layar' | 'kontrol' } | null {
  const h = String(hash || '').replace(/^#/, '');
  const m = /^\/?ibadah\/([^/]+)\/(layar|kontrol)\/?$/.exec(h);
  if (!m) return null;
  return { eventKey: decodeURIComponent(m[1]), view: m[2] as 'layar' | 'kontrol' };
}

export const isLiturgyHash = (hash: string) => parseLiturgyHash(hash) !== null;

export const liturgyCodeKey = (eventKey: string) => `gehc_liturgy_code_${eventKey}`;

export function loadLiturgyCode(eventKey: string): string {
  try {
    return String(localStorage.getItem(liturgyCodeKey(eventKey)) || '').toUpperCase();
  } catch {
    return '';
  }
}

export function saveLiturgyCode(eventKey: string, code: string) {
  try {
    localStorage.setItem(liturgyCodeKey(eventKey), String(code || '').toUpperCase());
  } catch { /* abaikan */ }
}

/** Bait lirik yang sedang aktif untuk momen lagu (clamp aman). */
export function activeSection(display: DisplayPayload | null | undefined, sectionIndex: number): DisplaySection | null {
  const secs = display && display.kind === 'song' ? display.sections || [] : [];
  if (!secs.length) return null;
  const i = Math.max(0, Math.min(secs.length - 1, sectionIndex || 0));
  return secs[i];
}

export interface PatternSegment {
  phaseNo: number;
  phaseTitle: string;
  key: string;
  label: string;
  kind: 'song' | 'firman';
  songs: number;
}

export interface PatternLite {
  code?: string | null;
  name?: string | null;
  defaultDurationMin?: number | null;
  phases?: Array<{
    no?: number | null;
    title?: string | null;
    minutes?: number | null;
    owner?: string | null;
    notes?: string | null;
    segments?: Array<{ key?: unknown; label?: unknown; kind?: unknown; songs?: unknown }> | null;
  }> | null;
}

/** Segmen pola yang menjadi kerangka tata ibadah (fase diskusi/dll dilewati). */
export function patternSegments(pattern?: PatternLite | null): PatternSegment[] {
  const phases = Array.isArray(pattern?.phases) ? pattern!.phases! : [];
  const out: PatternSegment[] = [];
  for (const ph of phases) {
    const segs = Array.isArray(ph?.segments) ? ph!.segments! : [];
    for (const s of segs) {
      if (!s || typeof s !== 'object') continue;
      const kind = String((s as { kind?: unknown }).kind || '').toLowerCase();
      if (kind !== 'song' && kind !== 'firman') continue;
      const key = String((s as { key?: unknown }).key || '').trim().slice(0, 40);
      if (!key) continue;
      out.push({
        phaseNo: Number((ph as { no?: unknown }).no) || 0,
        phaseTitle: String((ph as { title?: unknown }).title || ''),
        key,
        label: String((s as { label?: unknown }).label || key).slice(0, 80),
        kind: kind as 'song' | 'firman',
        songs: kind === 'song' ? Math.max(1, Math.min(12, Math.trunc(Number((s as { songs?: unknown }).songs) || 1))) : 0,
      });
    }
  }
  return out;
}

export interface SkeletonDraft {
  kind: string;
  title: string;
  body: null;
  segmentKey: string;
  phaseNo: number;
  serviceSongId: null;
}

/** Draf kerangka order dari segmen pola (slot lagu kosong, firman auto). */
export function skeletonFromPattern(pattern?: PatternLite | null): SkeletonDraft[] {
  const items: SkeletonDraft[] = [];
  for (const seg of patternSegments(pattern)) {
    if (seg.kind === 'firman') {
      items.push({
        kind: 'firman', title: seg.label, body: null,
        segmentKey: `${seg.phaseNo}:${seg.key}`, phaseNo: seg.phaseNo, serviceSongId: null,
      });
      continue;
    }
    for (let i = 0; i < seg.songs; i += 1) {
      items.push({
        kind: 'lagu', title: `${seg.label} ${i + 1}`, body: null,
        segmentKey: `${seg.phaseNo}:${seg.key}`, phaseNo: seg.phaseNo, serviceSongId: null,
      });
    }
  }
  return items;
}
