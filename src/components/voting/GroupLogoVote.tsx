import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Vote, RefreshCw, Lock, Unlock, Trophy } from 'lucide-react';

type Option = { id: string; optionNo: number; label: string; imageFileId: string | null; voteCount: number };
type GroupCard = {
  groupId: string;
  name: string;
  philosophy: string;
  canVote: boolean;
  myOptionId: string | null;
  total: number;
  options: Option[];
};
type VotingData = {
  session: { id: string; title: string; description?: string | null; status: string; closesAt?: string | null } | null;
  open?: boolean;
  canAdmin: boolean;
  myGroupIds: string[];
  groups: GroupCard[];
};

/** Standalone page: pemilihan logo kelompok (Beyonders). Route #/voting */
export default function GroupLogoVote() {
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error' | 'denied'; message?: string }>({ status: 'loading' });
  const [data, setData] = useState<VotingData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/voting', { credentials: 'include', cache: 'no-store' });
      if (r.status === 401) {
        window.location.hash = `#/login?next=${encodeURIComponent('#/voting')}`;
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setState({ status: 'error', message: d.error || `Gagal memuat (server ${r.status}).` }); return; }
      setData(d);
      setState({ status: 'ok' });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal memuat.' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const vote = async (optionId: string) => {
    setBusy(optionId);
    try {
      const r = await fetch('/api/voting/ballot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ optionId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan pilihan.');
      await load();
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal menyimpan pilihan.' });
      setData((prev) => prev); // pertahankan data
    } finally {
      setBusy(null);
    }
  };

  const toggleSession = async (action: 'open' | 'close') => {
    setBusy(action);
    try {
      await fetch('/api/voting/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]">
      <header className="border-b border-[#D9D7D0]/60 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#1B1B1B] text-white"><Vote className="w-4 h-4" /></span>
          <div>
            <h1 className="text-lg font-black">{data?.session?.title || 'Pemilihan Logo Kelompok'}</h1>
            <p className="text-xs text-[#8C8880]">{data?.session?.description || 'Pilih satu dari dua opsi logo untuk kelompok Anda.'}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {data?.session && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${data.session.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {data.session.status === 'OPEN' ? 'Dibuka' : data.session.status === 'CLOSED' ? 'Ditutup' : 'Draft'}
              </span>
            )}
            {data?.canAdmin && (
              <>
                <button type="button" onClick={() => void toggleSession('open')} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
                  <Unlock className="w-3.5 h-3.5" /> Buka
                </button>
                <button type="button" onClick={() => void toggleSession('close')} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
                  <Lock className="w-3.5 h-3.5" /> Tutup
                </button>
              </>
            )}
            <button type="button" onClick={() => void load()} disabled={!!busy} className="p-2 rounded-xl border border-[#D9D7D0] bg-white disabled:opacity-50" title="Muat ulang">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6 space-y-5">
        {state.status === 'loading' && (
          <p className="text-sm text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
        )}
        {state.status === 'error' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</div>
        )}

        {state.status === 'ok' && data && !data.session && (
          <div className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-10 text-center">
            <p className="text-sm font-bold">Belum ada sesi pemilihan.</p>
            <p className="text-xs text-[#8C8880] mt-1">Hubungi Komisi/Didaskalia untuk membuka sesi.</p>
          </div>
        )}

        {state.status === 'ok' && data && data.session && data.groups.length === 0 && (
          <div className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-10 text-center">
            <p className="text-sm font-bold">Belum ada logo untuk kelompok Anda.</p>
            <p className="text-xs text-[#8C8880] mt-1">Pastikan Anda terdaftar di salah satu kelompok Beyonders.</p>
          </div>
        )}

        {state.status === 'ok' && data && data.groups.map((g) => (
          <section key={g.groupId} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black">{g.name}</h2>
              {g.myOptionId && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> Pilihan tersimpan</span>}
              <span className="ml-auto text-[11px] text-[#8C8880]">{g.total} suara</span>
            </div>
            {g.philosophy && <p className="text-xs text-[#5C5850] leading-relaxed whitespace-pre-line">{g.philosophy}</p>}

            <div className="grid sm:grid-cols-2 gap-4">
              {g.options.map((o) => {
                const mine = g.myOptionId === o.id;
                const pct = g.total ? Math.round(((o.voteCount || 0) / g.total) * 100) : 0;
                const src = o.imageFileId ? (o.imageFileId.startsWith('/') ? o.imageFileId : `/api/voting/asset/${o.imageFileId}`) : '';
                return (
                  <div key={o.id} className={`rounded-2xl border p-4 space-y-3 transition-colors ${mine ? 'border-emerald-400 bg-emerald-50/40' : 'border-[#D9D7D0] bg-[#FAF9F5]'}`}>
                    <div className="aspect-square rounded-xl bg-white border border-[#EFEDE8] overflow-hidden flex items-center justify-center">
                      {src
                        ? <img src={src} alt={`${g.name} ${o.label}`} className="w-full h-full object-contain p-4" loading="lazy" />
                        : <span className="text-[11px] text-[#8C8880]">Gambar belum tersedia</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{o.label}</p>
                      <span className="text-[11px] font-bold text-[#8C8880]">{o.voteCount || 0} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#EFEDE8] overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    {g.canVote ? (
                      <button
                        type="button"
                        onClick={() => void vote(o.id)}
                        disabled={!!busy}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 ${mine ? 'bg-emerald-600 text-white' : 'bg-[#1B1B1B] text-white'}`}
                      >
                        {busy === o.id ? 'Menyimpan…' : mine ? 'Pilihan Anda' : `Pilih ${o.label}`}
                      </button>
                    ) : (
                      <p className="text-[11px] text-[#8C8880] text-center">
                        {data.open ? 'Anda tidak terdaftar di kelompok ini.' : 'Pemilihan belum dibuka / sudah ditutup.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {state.status === 'ok' && data?.canAdmin && data.groups.length > 0 && (
          <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4">
            <p className="text-xs font-black flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Rekap sementara</p>
            <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.groups.map((g) => {
                const top = [...g.options].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))[0];
                const tie = g.options.length > 1 && g.options[0].voteCount === g.options[1].voteCount && g.total > 0;
                return (
                  <div key={g.groupId} className="rounded-xl bg-[#FAF9F5] px-3 py-2">
                    <p className="text-[11px] font-bold">{g.name}</p>
                    <p className="text-[11px] text-[#8C8880]">
                      {g.total === 0 ? 'Belum ada suara' : tie ? 'Seri' : `Unggul: ${top.label} (${top.voteCount})`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[11px] text-[#8C8880] text-center pt-2">Beyonders · GEHC Youth — satu suara per orang per kelompok.</p>
      </main>
    </div>
  );
}
