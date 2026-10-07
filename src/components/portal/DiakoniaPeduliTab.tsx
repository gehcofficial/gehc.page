import React, { useCallback, useEffect, useState } from 'react';
import { HandHeart, Loader2, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PastoralCareBoard } from './PastoralCareBoard';
import { nextCaseStatus } from '../../lib/diakonia';

type Visit = { id: string; visitedOn: string; visitors?: string | null; result?: string | null };
type CaseItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  subjectRef?: string | null;
  needSummary?: string | null;
  fundingLink?: string | null;
  visits?: Visit[];
};

/**
 * Tab Peduli Diakonia — pipeline kasus mercy + kunjungan + Portal Doa (embed).
 * Nominal dana tidak disimpan di sini — hanya link pengajuan BZP/Bendahara.
 */
export const DiakoniaPeduliTab: React.FC = () => {
  const { addToast } = useApp();
  const [items, setItems] = useState<CaseItem[]>([]);
  const [canSeeSubject, setCanSeeSubject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [visitFor, setVisitFor] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState('');
  const [visitResult, setVisitResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/diakonia/cases', { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setItems(d.items || []);
      setCanSeeSubject(Boolean(d.canSeeSubject));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    const r = await fetch('/api/diakonia/cases', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal' }); return; }
    setTitle('');
    setShowForm(false);
    await load();
  };

  const advance = async (c: CaseItem) => {
    const next = nextCaseStatus(c.status);
    if (!next) return;
    let fundingLink: string | undefined;
    if (next === 'BANTUAN') {
      fundingLink = window.prompt('Link pengajuan dana ke BZP/Bendahara (opsional, kosongkan bila swadaya):', c.fundingLink || '') || undefined;
      if (fundingLink === undefined && c.fundingLink) fundingLink = c.fundingLink;
    }
    const r = await fetch(`/api/diakonia/cases/${c.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, fundingLink }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal' }); return; }
    await load();
  };

  const addVisit = async (c: CaseItem) => {
    if (!visitDate) { addToast({ type: 'error', title: 'Isi tanggal kunjungan dulu.' }); return; }
    const r = await fetch(`/api/diakonia/cases/${c.id}/visits`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitedOn: visitDate, result: visitResult }),
    });
    if (r.ok) { setVisitFor(null); setVisitDate(''); setVisitResult(''); await load(); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <HandHeart className="w-4 h-4 text-[#EA580C]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Kasih Peduli & Kedermawanan</h3>
          <span className="text-[11px] text-[#8C8880]">lapor → assess (H+3) → bantuan → follow-up (H+7) → tutup</span>
          <button type="button" onClick={() => setShowForm((v) => !v)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Kasus baru
          </button>
        </div>
        {!canSeeSubject && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Mode terbatas: nama subjek disembunyikan untuk peranmu.</p>
        )}
        {showForm && (
          <div className="mt-3 flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} placeholder="Judul kasus — mis. Kunjungan sdr. A pasca operasi" className="flex-1 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
            <button type="button" onClick={() => void create()} disabled={!title.trim()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">Lapor</button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat kasus…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-[#8C8880] text-center py-4">Belum ada kasus mercy. Semoga tetap begitu. 🙏</p>
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const next = nextCaseStatus(c.status);
            return (
              <div key={c.id} className="rounded-xl border border-[#D9D7D0]/60 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black text-[#1B1B1B]">{c.title}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880]">{c.kind} · {c.status}</span>
                  {next && (
                    <button type="button" onClick={() => void advance(c)} className="ml-auto text-[11px] font-bold text-white bg-[#1B1B1B] rounded-lg px-2.5 py-1">→ {next}</button>
                  )}
                </div>
                {c.subjectRef && <p className="text-[11px] text-[#5C5850] mt-1">Subjek: {c.subjectRef}</p>}
                {c.fundingLink && <a href={c.fundingLink} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-sky-700 hover:underline">Link pengajuan dana ↗</a>}
                {(c.visits || []).length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-[#EFEDE8] pt-2">
                    {c.visits!.map((v) => (
                      <p key={v.id} className="text-[11px] text-[#5C5850]">🗓 {String(v.visitedOn).slice(0, 10)}{v.visitors ? ` · ${v.visitors}` : ''}{v.result ? ` — ${v.result}` : ''}</p>
                    ))}
                  </div>
                )}
                {visitFor === c.id ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-[11px]" />
                    <input value={visitResult} onChange={(e) => setVisitResult(e.target.value)} placeholder="Hasil singkat kunjungan…" className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-[11px]" />
                    <button type="button" onClick={() => void addVisit(c)} className="text-[11px] font-bold text-white bg-[#1B1B1B] rounded-lg px-2.5 py-1.5">Simpan</button>
                    <button type="button" onClick={() => setVisitFor(null)} className="text-[11px] text-[#8C8880]">Batal</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setVisitFor(c.id); setVisitDate(new Date().toISOString().slice(0, 10)); }} className="mt-2 text-[11px] font-bold text-sky-700">+ Catat kunjungan</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-2">Portal Doa — sumber laporan</p>
        <PastoralCareBoard embed ownerLabel="Diakonia · Kasih Peduli" />
      </div>
    </div>
  );
};
