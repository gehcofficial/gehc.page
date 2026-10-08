import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Maximize } from 'lucide-react';
import {
  KIND_LABEL,
  LivePayload,
  activeSection,
  loadLiturgyCode,
  parseLiturgyHash,
  saveLiturgyCode,
} from '../../lib/liturgy-live';
import { PortalBackButton } from './PortalBackButton';

/**
 * Layar tata ibadah — proyektor + HP jemaat (read-only, ikut momen aktif).
 * Rute `#/ibadah/<eventKey>/layar`. Akses: login ATAU kode proyektor.
 * Polling 15 dtk + pause saat tab tersembunyi (pola MentoringScreen).
 */
export const LiturgyScreen: React.FC = () => {
  const parsed = parseLiturgyHash(typeof window !== 'undefined' ? window.location.hash : '');
  const eventKey = parsed?.eventKey || '';
  const [code, setCode] = useState(() => loadLiturgyCode(eventKey));
  const [codeDraft, setCodeDraft] = useState('');
  const [data, setData] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!eventKey) return;
    try {
      const q = code ? `?code=${encodeURIComponent(code)}` : '';
      const r = await fetch(`/api/events/${encodeURIComponent(eventKey)}/liturgy-live${q}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const d = (await r.json().catch(() => ({}))) as LivePayload & { error?: string; needCode?: boolean };
      if (r.status === 401) {
        setErr(d.error || 'Butuh login atau kode proyektor.');
        setData(null);
      } else if (!r.ok) {
        throw new Error(d.error || `HTTP ${r.status}`);
      } else {
        setErr('');
        setData(d);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat.');
    } finally {
      setLoading(false);
    }
  }, [eventKey, code]);

  useEffect(() => {
    setLoading(true);
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const submitCode = () => {
    const c = codeDraft.trim().toUpperCase();
    if (!c) return;
    saveLiturgyCode(eventKey, c);
    setCode(c);
    setLoading(true);
  };

  if (!eventKey) {
    return <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center p-6">Event tidak dikenal.</div>;
  }

  if (!code && !data && !loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3 text-center">
          <KeyRound className="w-8 h-8 mx-auto opacity-70" />
          <h1 className="text-xl font-black">Layar Tata Ibadah</h1>
          <p className="text-sm text-white/60">Masukkan kode sesi proyektor dari Liturgia, atau buka dengan akun jemaat yang sudah login.</p>
          <input
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
            placeholder="XXXXXX"
            maxLength={16}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-center text-2xl font-black tracking-[0.3em] focus:outline-none focus:border-white/60"
          />
          {err && <p className="text-sm text-amber-300">{err}</p>}
          <button type="button" onClick={submitCode} className="w-full px-4 py-3 rounded-xl bg-white text-black font-black">
            Buka Layar
          </button>
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const currentId = data?.state?.currentItemId || null;
  const currentIdx = currentId ? items.findIndex((i) => i.id === currentId) : -1;
  const current = currentIdx >= 0 ? items[currentIdx] : null;
  const next = currentIdx >= 0 ? items[currentIdx + 1] || null : items[0] || null;
  const status = data?.state?.status || 'DRAFT';

  return (
    <div className="min-h-screen bg-[#141414] text-[#F5F3EE] flex flex-col">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Tata Ibadah · {status}</p>
          <h1 className="text-lg font-black truncate">{data?.eventName || '…'}</h1>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin opacity-60" />}
        <PortalBackButton dark />
        <button
          type="button"
          title="Layar penuh"
          onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => undefined); }}
          className="p-2 rounded-lg border border-white/20 text-white/70 hover:text-white"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 gap-4">
        {err && !current && <p className="text-amber-300">{err}</p>}
        {!err && !current && (
          <div className="space-y-2">
            <p className="text-2xl font-black">{status === 'DONE' ? 'Ibadah selesai. Tuhan memberkati.' : 'Ibadah belum dimulai.'}</p>
            {next && status !== 'DONE' && <p className="text-white/50">Berikutnya: {next.serviceSong?.song?.title || next.title || KIND_LABEL[next.kind] || next.kind}</p>}
          </div>
        )}
        {current && <CurrentMoment item={current} sectionIndex={data?.state?.sectionIndex || 0} />}
      </main>

      {next && current && (
        <footer className="px-5 py-3 border-t border-white/10 text-center text-sm text-white/50">
          Berikutnya: <strong className="text-white/80">{next.serviceSong?.song?.title || next.title || KIND_LABEL[next.kind] || next.kind}</strong>
        </footer>
      )}
    </div>
  );
};

const CurrentMoment: React.FC<{ item: NonNullable<LivePayload['items'][number]>; sectionIndex: number }> = ({ item, sectionIndex }) => {
  const d = item.display;
  if (!d) return <p className="text-white/60">Memuat…</p>;
  if (d.kind === 'text') {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-200">{KIND_LABEL[item.kind] || item.kind}</p>
        <h2 className="text-3xl md:text-4xl font-black">{d.title}</h2>
        {!!d.body && <p className="text-xl md:text-2xl leading-relaxed whitespace-pre-wrap text-white/90">{d.body}</p>}
        {!!d.owner && <p className="text-sm text-white/50">{d.owner}</p>}
      </div>
    );
  }
  const secs = d.sections || [];
  const sec = activeSection(d, sectionIndex);
  return (
    <div className="max-w-3xl w-full space-y-4">
      <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-200">{d.moment || 'Lagu'}</p>
      <h2 className="text-3xl md:text-5xl font-black">{d.title}</h2>
      {d.sourceRef && <p className="text-sm text-white/50">{d.sourceRef}</p>}
      {!d.hasLyrics || !sec ? (
        <div className="space-y-3">
          <p className="text-xl text-white/60 italic">Lirik belum diisi pemusik.</p>
          {d.sourceUrl && (
            <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="inline-block px-4 py-2 rounded-xl bg-white text-black text-sm font-bold">
              Buka teks sumber
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">
            {sec.name} · {Math.min(sectionIndex + 1, secs.length)}/{secs.length}
          </p>
          <div className="space-y-2">
            {sec.lines.map((l, i) => (
              <p key={i} className="text-2xl md:text-4xl font-bold leading-snug">{l}</p>
            ))}
          </div>
          {secs.length > 1 && (
            <div className="flex justify-center gap-1.5 pt-2">
              {secs.map((s, i) => (
                <span key={i} title={s.name} className={`h-1.5 rounded-full ${i === Math.min(sectionIndex, secs.length - 1) ? 'w-6 bg-amber-200' : 'w-1.5 bg-white/25'}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiturgyScreen;
