import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, MonitorPlay, Music, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  LiveMini,
  WorshipMini,
  freeShowNextSlide,
  mergeDayStatus,
  pushToFreeShow,
} from '../../lib/control-room';

type DayBlock = {
  id: string; kind: string; eventId?: string | null; title?: string | null;
  owner?: string | null; minutes?: number | null;
  event?: { id: string; name: string; orderCount?: number | null; liveStatus?: string | null } | null;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
  return d as T;
}

const KIND_LABEL: Record<string, string> = {
  'ibadah-block': 'Ibadah',
  pengumuman: 'Pengumuman',
  selebrasi: 'Selebrasi',
  makan: 'Makan',
  games: 'Games',
  sambutan: 'Sambutan',
  lainnya: 'Lainnya',
};

function todayWib(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Ruang Kontrol Ibadah — agregator read-only: timeline hari (Koinonia) +
 * live Liturgia + sesi Didaskalia + operasi display Marturia (FreeShow lokal).
 * Aksi tulis tetap di ruang kontrol masing-masing (guard divisi utuh).
 */
export const ControlRoomPanel: React.FC<{ eventId: string; eventDate?: string | null }> = ({ eventId, eventDate }) => {
  const { addToast } = useApp();
  const [day] = useState(() => String(eventDate || '').slice(0, 10) || todayWib());
  const [blocks, setBlocks] = useState<ReturnType<typeof mergeDayStatus>>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api<{ items: DayBlock[] }>(`/api/day-timeline?day=${encodeURIComponent(day)}`);
      const rows = t.items || [];
      const evIds = [...new Set(rows.map((b) => b.eventId).filter(Boolean))] as string[];
      const lives: LiveMini[] = [];
      const sessions: WorshipMini[] = [];
      await Promise.all(evIds.map(async (id) => {
        try {
          const l = await api<{ state?: { status?: string; currentItemId?: string | null } | null; items?: Array<{ id: string; serviceSong?: { song?: { title?: string | null } | null } | null; title?: string | null }> }>(
            `/api/events/${id}/liturgy-live`,
          );
          const cur = (l.items || []).find((i) => i.id === l.state?.currentItemId);
          lives.push({
            eventId: id,
            status: l.state?.status || null,
            currentTitle: cur?.serviceSong?.song?.title || cur?.title || null,
            totalMoments: (l.items || []).length,
          });
        } catch { /* event tanpa live — abaikan */ }
        try {
          const w = await api<{ session?: { slug?: string; title?: string; status?: string; patternCode?: string; patternName?: string } | null }>(
            `/api/events/${id}/worship`,
          );
          if (w.session) {
            sessions.push({
              eventId: id,
              slug: w.session.slug, title: w.session.title, status: w.session.status,
              patternCode: w.session.patternCode, patternName: w.session.patternName,
            });
          }
        } catch { /* tanpa sesi mentoring — abaikan */ }
      }));
      setBlocks(mergeDayStatus(rows, lives, sessions));
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal muat ruang kontrol', description: e instanceof Error ? e.message : '' });
    } finally {
      setLoading(false);
    }
  }, [day, eventId, addToast]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const pushEventSongs = async (evId: string) => {
    setPushing(true);
    setPushMsg('');
    try {
      const d = await api<{ items: Array<{ song?: { title?: string | null } | null; quickLyrics?: string | null }> }>(
        `/api/events/${evId}/songs/export`,
      );
      const shows = (d.items || [])
        .filter((i) => i.song && i.quickLyrics)
        .map((i) => ({ name: i.song?.title || 'GEHC', text: i.quickLyrics as string }));
      if (!shows.length) {
        setPushMsg('Tidak ada lagu ber-lirik untuk didorong.');
        return;
      }
      const r = await pushToFreeShow(shows);
      setPushMsg(r.fail ? `Terkirim ${r.ok}, gagal ${r.fail} (${r.errors.join('; ') || 'periksa FreeShow → Connections → API aktif + satu jaringan'}).` : `Terkirim ${r.ok} show ke FreeShow.`);
      addToast({ type: r.fail ? 'error' : 'success', title: 'Dorong FreeShow', description: `${r.ok} ok, ${r.fail} gagal` });
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : 'Gagal mendorong.');
    } finally {
      setPushing(false);
    }
  };

  const nextSlide = async () => {
    const ok = await freeShowNextSlide();
    addToast({ type: ok ? 'success' : 'error', title: ok ? 'Slide berikut' : 'FreeShow tak terjangkau (cek API lokal)' });
  };

  const copy = (url: string, label: string) => {
    void navigator.clipboard?.writeText(url);
    addToast({ type: 'success', title: `${label} disalin` });
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const btnGhost =
    'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D9D7D0] text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B] disabled:opacity-50';

  return (
    <div className="p-4 rounded-2xl bg-white border border-[#D9D7D0] space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#1B1B1B]">
          <MonitorPlay className="w-4 h-4" /> Ruang Kontrol
        </span>
        <span className="text-[11px] text-[#8C8880]">timeline hari + live ibadah + sesi mentoring + display Marturia</span>
        <span className="flex-1" />
        <a href={`#/hari/${encodeURIComponent(day)}/layar`} target="_blank" rel="noreferrer" className={btnGhost} title="Layar gabungan hari">
          Layar hari
        </a>
        <button type="button" onClick={() => void load()} disabled={loading} className={btnGhost}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat status…</p>
      ) : !blocks.length ? (
        <p className="text-xs text-[#8C8880] italic">Belum ada timeline hari {day} — susun di panel Koinonia.</p>
      ) : (
        <ol className="space-y-2">
          {blocks.map((b, idx) => (
            <li key={b.id} className={`p-2.5 rounded-xl border ${b.eventId === eventId ? 'bg-[#FAF9F5] border-[#1B1B1B]' : 'bg-white border-[#D9D7D0]'}`}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1B1B1B] text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1B1B1B] truncate">
                    [{KIND_LABEL[b.kind] || b.kind}] {b.kind === 'ibadah-block' ? b.event?.name || b.title || '—' : b.title || '—'}
                  </p>
                  <p className="text-[10px] text-[#8C8880] truncate">
                    {[
                      b.liveStatus ? `live: ${b.liveStatus}${b.liveCurrent ? ` · ${b.liveCurrent}` : ''}` : null,
                      b.worshipStatus ? `mentoring: ${b.worshipStatus}${b.worshipPattern ? ` · ${b.worshipPattern}` : ''}` : null,
                      b.owner, b.minutes ? `${b.minutes} mnt` : null,
                    ].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {b.kind === 'ibadah-block' && b.eventId && (
                  <>
                    <a href={`#/ibadah/${encodeURIComponent(b.eventId)}/layar`} target="_blank" rel="noreferrer" className={btnGhost} title="Buka layar">Layar</a>
                    <a href={`#/ibadah/${encodeURIComponent(b.eventId)}/kontrol`} target="_blank" rel="noreferrer" className={btnGhost} title="Buka kontrol Liturgia">Kontrol</a>
                    {b.worshipSlug && (
                      <a href={`#/mentoring/${encodeURIComponent(b.worshipSlug)}/kontrol`} target="_blank" rel="noreferrer" className={btnGhost} title="Buka kontrol mentoring">Mentoring</a>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] space-y-2">
        <p className="text-[11px] font-black text-[#1B1B1B]">Operasi display — Marturia</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => void pushEventSongs(eventId)} disabled={pushing} className={btnGhost} title="Buat show tiap lagu event ini di FreeShow lokal (create_show)">
            <Music className="w-3 h-3" /> {pushing ? 'Mendorong…' : 'Buat show di FreeShow'}
          </button>
          <button type="button" onClick={() => void nextSlide()} className={btnGhost} title="Remote next_slide ke FreeShow lokal">
            Slide berikut
          </button>
          <button
            type="button"
            onClick={() => copy(`${origin}/#/ibadah/${encodeURIComponent(eventId)}/layar`, 'Link layar')}
            className={btnGhost}
          >
            <Copy className="w-3 h-3" /> Salin link layar
          </button>
        </div>
        {!!pushMsg && <p className="text-[11px] text-[#8C8880]">{pushMsg}</p>}
      </div>
    </div>
  );
};

export default ControlRoomPanel;
