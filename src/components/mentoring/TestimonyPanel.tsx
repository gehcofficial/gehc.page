import React, { useCallback, useEffect, useState } from 'react';
import { Dices, Loader2, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import type { TestimonyPick } from '../../lib/mentoring';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';

type PoolInfo = { total: number; byRole: Record<string, number> };

/**
 * Panel undian kesaksian (control room): pool kehadiran per peran,
 * tombol Putar (default 2 Mentee + 1 Mentor + 1 Co-mentor; `freeForAll`
 * = 3 acak bebas untuk MONOLOG, tanpa ulang),
 * daftar terpilih + reset. Hasil tampil di layar proyektor.
 */
export const TestimonyPanel: React.FC<{ sessionId: string; freeForAll?: boolean }> = ({ sessionId, freeForAll }) => {
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [picks, setPicks] = useState<TestimonyPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ userId: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ userId: string; name: string }[]>([]);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/testimony`, {
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat undian.');
      setPool(d.pool || null);
      setPicks(d.picks || []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const draw = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/testimony/draw`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mengundi.');
      setPicks(d.picks || []);
      setMsg(`Terundi ${(d.fresh || []).length} orang — tampil di layar.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengundi.');
    } finally {
      setBusy(false);
    }
  };

  const sendToMarturia = async (p: TestimonyPick) => {
    setBusy(true);
    try {
      const r = await fetch('/api/marturia/testimony-leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name: p.name, role: p.role }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mengirim.');
      setSent((prev) => new Set(prev).add(p.userId));
      setMsg(d?.duplicate ? `${p.name} sudah ada di antrean kurasi.` : `${p.name} masuk antrean kurasi Marturia.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengirim.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Hapus semua hasil undian sesi ini?')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/testimony/reset`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Gagal mereset.');
      setPicks([]);
      setMsg('Undian dikosongkan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mereset.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
        const d = await r.json().catch(() => ({}));
        const users = (Array.isArray(d.users) ? d.users : []).map((u: { id: string; name: string }) => ({
          userId: String(u.id),
          name: String(u.name || 'Peserta'),
        }));
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [query]);

  const toggleSelect = (u: { userId: string; name: string }) => {
    setSelected((prev) => (prev.some((s) => s.userId === u.userId) ? prev.filter((s) => s.userId !== u.userId) : [...prev, u]));
  };

  const addManual = async () => {
    if (!selected.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(sessionId)}/testimony/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds: selected.map((s) => s.userId) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menambah manual.');
      setPicks(d.picks || []);
      setSelected([]);
      setQuery('');
      setResults([]);
      setMsg(`Ditambah manual ${(d.fresh || []).length} orang — tampil di layar.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menambah.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Dices className="w-4 h-4 text-brand" />
        <p className="text-sm font-black">Undian kesaksian</p>
        <span className="ml-auto text-[11px] text-[#8C8880]">
          Pool hadir: <b className="tabular-nums">{pool?.total ?? '…'}</b>
          {pool && ` (Mentee ${pool.byRole.MENTEE || 0} · Mentor ${pool.byRole.MENTOR || 0} · Co ${pool.byRole.CO_MENTOR || 0})`}
        </span>
      </div>
      <p className="text-[11px] text-[#8C8880] mt-1">
        {freeForAll
          ? 'Tiap putaran: 3 acak bebas dari yang hadir (nama + grup tampil di layar; tanpa ulang).'
          : 'Komposisi tiap putaran: 2 Mentee + 1 Mentor + 1 Co-mentor (dilengkapi acak bila peran kurang; tanpa ulang).'}
      </p>
      {picks.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {picks.map((p) => (
            <li key={`${p.slot}-${p.userId}`} className="flex items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] px-3 py-2">
              <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] font-black grid place-items-center shrink-0">
                {p.slot}
              </span>
                <span className="text-xs font-bold flex-1 truncate">{p.name}</span>
                <span className="text-[10px] text-[#8C8880]">{[p.groupName, p.role].filter(Boolean).join(' · ')}</span>
              <button
                type="button"
                disabled={busy || sent.has(p.userId)}
                onClick={() => void sendToMarturia(p)}
                title="Kirim ke antrean kurasi Marturia"
                className="text-[10px] font-bold text-[#DC2626] disabled:opacity-40 disabled:text-[#8C8880]"
              >
                {sent.has(p.userId) ? 'Terkirim ✓' : '→ Marturia'}
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void draw()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand to-brand-end text-white text-xs font-bold disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Putar undian
        </button>
        {picks.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#8C8880] disabled:opacity-60"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>
      <div className="mt-3 rounded-xl border border-[#EFEDE8] p-3 space-y-2">
        <p className="text-[11px] font-bold">Pilih manual <span className="font-normal text-[#8C8880]">(bila undian tidak jadi)</span></p>
        <label className="flex items-center gap-1.5 rounded-xl border border-[#D9D7D0] bg-white px-3 py-2">
          <Search className="w-3.5 h-3.5 text-[#8C8880] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik min. 2 huruf nama…"
            className="w-full text-xs focus:outline-none"
          />
          {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C8880]" />}
        </label>
        {results.length > 0 && (
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {results.map((u) => {
              const active = selected.some((s) => s.userId === u.userId);
              return (
                <li key={u.userId}>
                  <button
                    type="button"
                    onClick={() => toggleSelect(u)}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold border ${active ? 'bg-brand/10 border-brand text-brand' : 'border-[#EFEDE8] hover:border-brand'}`}
                  >
                    {active ? '✓ ' : ''}{u.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <span key={s.userId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand/10 text-brand text-[11px] font-bold">
                {s.name}
                <button type="button" onClick={() => toggleSelect(s)} title="Hapus" className="hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => void addManual()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60"
        >
          Tambah manual ({selected.length})
        </button>
      </div>
      {msg && <p className="mt-2 text-[11px] text-[#8C8880]">{msg}</p>}
    </div>
  );
};
