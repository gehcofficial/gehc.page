/**
 * Ruang Kontrol Ibadah — agregasi read-only sisi klien (tanpa endpoint baru).
 * Sumber: day-timeline (Koinonia) + liturgy-live (Liturgia) + worship (Didaskalia).
 * Aksi tulis tetap di ruang kontrol masing-masing (guard divisi utuh).
 */

export type DayBlock = {
  id: string;
  kind: string;
  eventId?: string | null;
  title?: string | null;
  owner?: string | null;
  minutes?: number | null;
  event?: {
    id: string;
    name: string;
    orderCount?: number | null;
    liveStatus?: string | null;
  } | null;
};

export type LiveMini = {
  eventId: string;
  status?: string | null;
  currentTitle?: string | null;
  totalMoments?: number | null;
};

export type WorshipMini = {
  eventId: string;
  slug?: string | null;
  title?: string | null;
  status?: string | null;
  patternCode?: string | null;
  patternName?: string | null;
};

export type DayBlockView = DayBlock & {
  liveStatus?: string | null;
  liveCurrent?: string | null;
  worshipStatus?: string | null;
  worshipSlug?: string | null;
  worshipPattern?: string | null;
};

/** Gabungkan blok hari + status live ibadah + sesi mentoring per event. */
export function mergeDayStatus(
  blocks: DayBlock[],
  lives: LiveMini[],
  sessions: WorshipMini[],
): DayBlockView[] {
  const liveBy = new Map(lives.map((l) => [l.eventId, l]));
  const sesBy = new Map(sessions.map((s) => [s.eventId, s]));
  return (blocks || []).map((b) => {
    const live = b.eventId ? liveBy.get(b.eventId) : undefined;
    const ses = b.eventId ? sesBy.get(b.eventId) : undefined;
    return {
      ...b,
      liveStatus: live?.status ?? b.event?.liveStatus ?? null,
      liveCurrent: live?.currentTitle ?? null,
      worshipStatus: ses?.status ?? null,
      worshipSlug: ses?.slug ?? null,
      worshipPattern: ses?.patternCode ?? ses?.patternName ?? null,
    };
  });
}

/**
 * FreeShow external API (satu endpoint root, aksi via JSON body).
 * Buat show: POST / {action:'create_show', name?, text?} (via convertText).
 * Maju slide: POST / {action:'next_slide'}. 200/204 = sukses.
 * Dijalankan dari browser operator (Marturia), bukan server.
 */
export async function pushToFreeShow(
  items: Array<{ name?: string; text: string }>,
  baseUrl = 'http://localhost:5506',
): Promise<{ ok: number; fail: number; errors: string[] }> {
  let ok = 0;
  let fail = 0;
  const errors: string[] = [];
  const root = baseUrl.replace(/\/+$/, '') || 'http://localhost:5506';
  for (const s of items || []) {
    try {
      const r = await fetch(`${root}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_show', name: s.name || 'GEHC', text: s.text }),
      });
      if (r.status !== 200 && r.status !== 204) throw new Error(`HTTP ${r.status}`);
      ok += 1;
    } catch (e) {
      fail += 1;
      if (errors.length < 3) errors.push(e instanceof Error ? e.message : 'gagal');
    }
  }
  return { ok, fail, errors };
}

/** Maju 1 slide di FreeShow operator (remote next_slide). */
export async function freeShowNextSlide(baseUrl = 'http://localhost:5506'): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl.replace(/\/+$/, '') || 'http://localhost:5506'}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'next_slide' }),
    });
    return r.status === 200 || r.status === 204;
  } catch {
    return false;
  }
}
