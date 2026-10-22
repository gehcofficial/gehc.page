import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Maximize } from 'lucide-react';
import { DayBlockView, LiveMini, WorshipMini, mergeDayStatus } from '../../lib/control-room';
import { parseDayHash } from '../../lib/liturgy-live';
import { PortalBackButton } from './PortalBackButton';
import { fetchWithEtag, startVisiblePoll, type EtagSlot } from '../../lib/visible-poll';

function dayFromHash(): string {
  return parseDayHash(typeof window !== 'undefined' ? window.location.hash : '')?.day || '';
}

/**
 * Layar gabungan hari — blok timeline (Koinonia) + momen live ibadah
 * + status sesi mentoring. Butuh login (baca API portal).
 */
export const DayScreen: React.FC = () => {
  const [day] = useState(() => dayFromHash());
  const [blocks, setBlocks] = useState<DayBlockView[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const slots = useRef(new Map<string, EtagSlot>());
  const last = useRef<{ rows: DayBlockView[]; lives: LiveMini[]; sessions: WorshipMini[] }>({ rows: [], lives: [], sessions: [] });
  const slotFor = (url: string) => {
    let slot = slots.current.get(url);
    if (!slot) {
      slot = { etag: null };
      slots.current.set(url, slot);
    }
    return slot;
  };
  const load = useCallback(async () => {
    if (!day) return false;
    try {
      const timelineUrl = `/api/day-timeline?day=${encodeURIComponent(day)}`;
      const timeline = await fetchWithEtag(timelineUrl, slotFor(timelineUrl), { credentials: 'include' });
      if (!timeline.response.ok && !timeline.unchanged) {
        const errBody = timeline.data as { error?: string } | null;
        throw new Error(errBody?.error || `HTTP ${timeline.response.status}`);
      }
      const rows = timeline.unchanged
        ? last.current.rows
        : ((timeline.data as { items?: DayBlockView[] } | null)?.items || []);
      const evIds = [...new Set(rows.map((b) => b.eventId).filter(Boolean))] as string[];
      let changed = !timeline.unchanged;
      const lives: LiveMini[] = [];
      const sessions: WorshipMini[] = [];
      await Promise.all(evIds.map(async (id) => {
        try {
          const url = `/api/events/${id}/liturgy-live`;
          const polled = await fetchWithEtag(url, slotFor(url), { credentials: 'include' });
          if (polled.unchanged || !polled.response.ok) {
            const prev = last.current.lives.find((row) => row.eventId === id);
            if (prev) lives.push(prev);
          } else {
            changed = true;
            const l = (polled.data || {}) as { state?: { status?: string; currentItemId?: string | null } | null; items?: Array<{ id: string; serviceSong?: { song?: { title?: string | null } | null } | null; title?: string | null }> };
            const cur = (l.items || []).find((i) => i.id === l.state?.currentItemId);
            lives.push({
              eventId: id, status: l.state?.status || null,
              currentTitle: cur?.serviceSong?.song?.title || cur?.title || null,
              totalMoments: (l.items || []).length,
            });
          }
        } catch { /* abaikan */ }
        try {
          const url = `/api/events/${id}/worship`;
          const polled = await fetchWithEtag(url, slotFor(url), { credentials: 'include' });
          if (polled.unchanged || !polled.response.ok) {
            const prev = last.current.sessions.find((row) => row.eventId === id);
            if (prev) sessions.push(prev);
          } else {
            changed = true;
            const w = (polled.data || {}) as { session?: { slug?: string; status?: string; patternCode?: string } | null };
            if (w.session) {
              sessions.push({ eventId: id, slug: w.session.slug, status: w.session.status, patternCode: w.session.patternCode });
            }
          }
        } catch { /* abaikan */ }
      }));
      if (!changed) return false;
      last.current = { rows, lives, sessions };
      setErr('');
      setBlocks(mergeDayStatus(rows, lives, sessions));
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat. Buka dengan akun jemaat yang sudah login.');
      return true;
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    setLoading(true);
    return startVisiblePoll(() => load(), 20000, 40000);
  }, [load]);

  return (
    <div className="min-h-screen bg-[#141414] text-[#F5F3EE] flex flex-col">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Acara hari ini</p>
          <h1 className="text-lg font-black truncate">{day || '—'}</h1>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin opacity-60" />}
        <PortalBackButton dark label="Portal" />
        <button
          type="button"
          title="Layar penuh"
          onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => undefined); }}
          className="p-2 rounded-lg border border-white/20 text-white/70 hover:text-white"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </header>
      <main className="flex-1 px-6 py-8 space-y-3 max-w-3xl w-full mx-auto">
        {err && <p className="text-amber-300 text-center">{err}</p>}
        {!err && !loading && !blocks.length && (
          <p className="text-center text-white/60">Belum ada susunan hari ini.</p>
        )}
        {blocks.map((b, idx) => (
          <div key={b.id} className={`p-4 rounded-2xl border ${b.liveStatus === 'LIVE' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10'}`}>
            <p className="text-[11px] font-black uppercase tracking-widest opacity-60">
              {idx + 1} · {b.kind === 'ibadah-block' ? 'Ibadah' : b.kind}{b.liveStatus === 'LIVE' ? ' · LIVE' : ''}
            </p>
            <p className="text-2xl font-black">
              {b.kind === 'ibadah-block' ? b.event?.name || b.title || 'Ibadah' : b.title || b.kind}
            </p>
            {b.liveCurrent && <p className="text-lg font-bold opacity-80">▶ {b.liveCurrent}</p>}
            {b.worshipStatus && <p className="text-sm opacity-60">Mentoring: {b.worshipStatus}{b.worshipPattern ? ` · ${b.worshipPattern}` : ''}</p>}
          </div>
        ))}
      </main>
    </div>
  );
};

export default DayScreen;
