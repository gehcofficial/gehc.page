/**
 * Satu-satunya penulis pola ibadah pekanan: dipakai dropdown Studio/Inti DAN
 * katalog Pola & Sesi agar keduanya selalu sync.
 *
 * Alur per penerapan: PATCH patternCode pekan → pastikan shell sesi kosong
 * (idempoten per event+pola, tanggal + slug ikut tanggal efektif event) →
 * pancarkan event agar panel lain ikut segar tanpa reload penuh.
 */
import { effectiveSessionDay, sessionSlugStem } from './effective-date';

export const WEEK_PATTERN_CHANGED_EVENT = 'gehc:week-pattern-changed';

export type WeekPatternChangedDetail = {
  ym: string;
  weekIndex: number;
  patternCode: string;
};

export type ApplyPatternSession = 'created' | 'exists' | 'no-event' | 'failed';

function slugify(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

type SessionLite = { id: string; eventId?: string | null; pattern?: { code?: string | null } | null };

async function readJson(r: Response): Promise<Record<string, unknown>> {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function ensurePatternSession(
  ev: { id: string; name?: string | null; eventDate?: string | null },
  code: string,
  weekDate: string | null | undefined,
  ym: string,
): Promise<'created' | 'exists' | 'failed'> {
  try {
    const r = await fetch('/api/worship/sessions', { credentials: 'include' });
    const d = r.ok ? await readJson(r) : {};
    const list = (d.sessions || []) as SessionLite[];
    if (list.some((s) => s.eventId === ev.id && String(s.pattern?.code || '').toUpperCase() === code)) {
      return 'exists';
    }
  } catch {
    /* lanjut buat; server 409 bila slug duplikat */
  }
  const day = effectiveSessionDay(ev.eventDate ?? null, weekDate ?? null, ym);
  const slug = slugify(sessionSlugStem(day, code));
  const title = `${code === 'MONOLOG' ? 'Ibadah' : code} — ${ev.name || day}`;
  try {
    const c = await fetch('/api/worship/sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patternCode: code, slug, title, eventId: ev.id, sessionDate: day || null }),
    });
    if (!c.ok) return 'failed';
    return 'created';
  } catch {
    return 'failed';
  }
}

export function dispatchWeekPatternChanged(detail: WeekPatternChangedDetail): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(WEEK_PATTERN_CHANGED_EVENT, { detail }));
    }
  } catch {
    /* abaikan (SSR / unit test tanpa DOM) */
  }
}

export async function applyWeekPattern(opts: {
  ym: string;
  weekIndex: number;
  patternCode: string;
  event?: { id: string; name?: string | null; eventDate?: string | null } | null;
  weekDate?: string | null;
}): Promise<{ patternSaved: true; session: ApplyPatternSession }> {
  const code = String(opts.patternCode || 'MONOLOG').toUpperCase();
  // 1. Tulis pola — satu-satunya jalur tulis.
  const r = await fetch(`/api/didaskalia/studio/${opts.ym}/${opts.weekIndex}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patternCode: code }),
  });
  if (!r.ok) throw new Error('Gagal menyimpan pola.');
  // 2. Shell sesi kosong (idempoten). Tanpa event → hanya pola.
  let session: ApplyPatternSession = 'no-event';
  if (opts.event?.id) {
    session = await ensurePatternSession(opts.event as { id: string }, code, opts.weekDate ?? null, opts.ym);
  }
  // 3. Kabari panel lain (Studio ↔ Katalog).
  dispatchWeekPatternChanged({ ym: opts.ym, weekIndex: opts.weekIndex, patternCode: code });
  return { patternSaved: true, session };
}
