import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, Home, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { InternalWartaPanel } from './InternalWartaPanel';

type Kost = { id: string; area: string; priceRange?: string | null; contact?: string | null; note?: string | null; status: string };

/**
 * Tab Perantau Diakonia — Info & Peluang kerja (embed, milik Diakonia) + info kos.
 * Burnout check-in menyusul Sprint C; care klinis dirujuk ke mentor.
 */
export const DiakoniaPerantauTab: React.FC = () => {
  const { addToast } = useApp();
  const [kost, setKost] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState('');
  const [price, setPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/diakonia/kost', { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setKost(d.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const suggest = async () => {
    if (!area.trim()) return;
    const r = await fetch('/api/diakonia/kost', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: area.trim(), priceRange: price.trim() || undefined }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal' }); return; }
    setArea('');
    setPrice('');
    addToast({ type: 'success', title: 'Usulan kos terkirim', description: 'Tampil setelah dimoderasi Diakonia.' });
    await load();
  };

  const moderate = async (k: Kost, status: string) => {
    const r = await fetch(`/api/diakonia/kost/${k.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal' }); return; }
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <h3 className="text-sm font-black text-[#1B1B1B] flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#EA580C]" /> Lowongan & Peluang</h3>
        <p className="text-[11px] text-[#8C8880] mt-0.5">Dari jemaat & rekanan — moderasi Diakonia sebelum tampil.</p>
        <div className="mt-2">
          <InternalWartaPanel ownerLabel="Diakonia · Dukungan Perantau" lockCategory="LOWONGAN" />
        </div>
      </div>

      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <h3 className="text-sm font-black text-[#1B1B1B] flex items-center gap-2"><Home className="w-4 h-4 text-[#EA580C]" /> Info kos Cikarang</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area — mis. Cikarang Barat / Jababeka" className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Kisaran harga (opsional)" className="w-44 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
          <button type="button" onClick={() => void suggest()} disabled={!area.trim()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">Usulkan</button>
        </div>
        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
          ) : kost.length === 0 ? (
            <p className="text-[11px] text-[#8C8880]">Belum ada info kos. Usulan pertama sangat berarti buat perantau baru. 🏠</p>
          ) : kost.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2">
              <p className="text-xs"><strong>{k.area}</strong>{k.priceRange && <span className="text-[#8C8880]"> · {k.priceRange}</span>}{k.contact && <span className="text-[#8C8880]"> · {k.contact}</span>}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#D9D7D0] text-[#8C8880]">{k.status}</span>
              {k.status !== 'TAMPIL' && (
                <button type="button" onClick={() => void moderate(k, 'TAMPIL')} className="ml-auto text-[11px] font-bold text-emerald-700">Tampilkan</button>
              )}
              {k.status === 'TAMPIL' && (
                <button type="button" onClick={() => void moderate(k, 'ARSIP')} className="ml-auto text-[11px] font-bold text-[#8C8880]">Arsipkan</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
