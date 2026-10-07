import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Palette, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { nextAssetStatus } from '../../lib/marturia';

type Asset = {
  id: string;
  title: string;
  brief?: string | null;
  requesterDiv?: string | null;
  status: string;
  handoffTo?: string | null;
  versions?: Array<{ id: string; url: string; note?: string | null }>;
};

/**
 * Tab Desain Marturia — antrean request asset: brief → versi → handoff ke Hubungan.
 * Peminta boleh divisi mana pun; penggerak status hanya Marturia (dijaga server).
 */
export const MarturiaDesainTab: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast } = useApp();
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [versionUrl, setVersionUrl] = useState<Record<string, string>>({});
  const [requesterFilter, setRequesterFilter] = useState('');
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; kind: string; url: string }>>([]);
  const [tplTitle, setTplTitle] = useState('');
  const [tplUrl, setTplUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(eventId)}/marturia/assets`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })),
        fetch('/api/marturia/templates', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      ]);
      setItems(a.items || []);
      setTemplates(t.items || []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/marturia/assets`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), brief: brief.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal membuat request' }); return; }
    setTitle('');
    setBrief('');
    await load();
  };

  const advance = async (a: Asset) => {
    const next = nextAssetStatus(a.status);
    if (!next) return;
    const handoffTo = next === 'HANDOFF' ? window.prompt('Serahkan ke divisi mana? (default: KOINONIA Hubungan)', 'KOINONIA') || 'KOINONIA' : undefined;
    const r = await fetch(`/api/marturia/assets/${a.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, handoffTo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal memajukan status' }); return; }
    await load();
  };

  const addVersion = async (a: Asset) => {
    const url = (versionUrl[a.id] || '').trim();
    if (!url) return;
    const r = await fetch(`/api/marturia/assets/${a.id}/versions`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (r.ok) { setVersionUrl((p) => ({ ...p, [a.id]: '' })); await load(); }
  };

  if (loading) {
    return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat antrean desain…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <h3 className="text-sm font-black text-[#1B1B1B] flex items-center gap-2"><Palette className="w-4 h-4 text-[#DC2626]" /> Desain & Publikasi</h3>
        <p className="text-[11px] text-[#8C8880] mt-1">Marturia mengerjakan asset · Koinonia Hubungan yang memposting. Final asset H-7.</p>
        <div className="mt-3 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul asset — mis. Poster Mentoring 18 Okt" className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Brief: ukuran, teks, warna, deadline…" rows={2} className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
          <button type="button" onClick={() => void create()} disabled={!title.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" /> Minta desain
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Brand kit (pakai ulang)</p>
        <div className="mt-2 space-y-1.5">
          {templates.map((t) => (
            <a key={t.id} href={t.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] font-bold text-sky-700 hover:underline">
              [{t.kind}] {t.title} ↗
            </a>
          ))}
          {templates.length === 0 && <p className="text-[11px] text-[#8C8880]">Belum ada template. Tambahkan kanvas/Figma master di bawah.</p>}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Nama template" className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] focus:outline-none focus:border-black" />
          <input value={tplUrl} onChange={(e) => setTplUrl(e.target.value)} placeholder="Link kanvas" className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] focus:outline-none focus:border-black" />
          <button
            type="button"
            disabled={!tplTitle.trim() || !tplUrl.trim()}
            onClick={() => void (async () => {
              const r = await fetch('/api/marturia/templates', {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: tplTitle.trim(), url: tplUrl.trim() }),
              });
              if (r.ok) { setTplTitle(''); setTplUrl(''); await load(); }
            })()}
            className="px-3 py-1.5 rounded-lg bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-40"
          >
            + Template
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Antrean event ini</p>
        <select value={requesterFilter} onChange={(e) => setRequesterFilter(e.target.value)} className="ml-auto px-2.5 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[11px] font-bold text-[#5C5850]">
          <option value="">Semua peminta</option>
          {Array.from(new Set(items.map((i) => i.requesterDiv).filter(Boolean))).map((d) => (
            <option key={d as string} value={d as string}>{d}</option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[#8C8880] text-center py-6">Belum ada request asset untuk event ini.</p>
      ) : (
        <div className="space-y-2">
          {items.filter((a) => !requesterFilter || a.requesterDiv === requesterFilter).map((a) => {
            const next = nextAssetStatus(a.status);
            return (
              <div key={a.id} className="rounded-xl border border-[#D9D7D0]/60 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black text-[#1B1B1B]">{a.title}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880]">{a.status}</span>
                  {a.requesterDiv && <span className="text-[10px] font-bold text-sky-700">peminta: {a.requesterDiv}</span>}
                  {a.handoffTo && <span className="text-[10px] font-bold text-emerald-700">→ {a.handoffTo}</span>}
                  {next && (
                    <button type="button" onClick={() => void advance(a)} className="ml-auto text-[11px] font-bold text-white bg-[#1B1B1B] rounded-lg px-2.5 py-1">
                      → {next === 'HANDOFF' ? 'Serahkan' : next}
                    </button>
                  )}
                </div>
                {a.brief && <p className="text-[11px] text-[#5C5850] mt-1">{a.brief}</p>}
                {(a.versions || []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {a.versions!.map((v, i) => (
                      <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] font-bold text-sky-700 hover:underline">v{i + 1} — buka asset ↗</a>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    value={versionUrl[a.id] || ''}
                    onChange={(e) => setVersionUrl((p) => ({ ...p, [a.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void addVersion(a); }}
                    placeholder="Tempel link Drive versi baru… (Enter)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] focus:outline-none focus:border-black"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
