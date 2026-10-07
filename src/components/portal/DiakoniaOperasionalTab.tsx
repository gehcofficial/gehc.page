import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type OpsArea = 'LOGISTIK' | 'KONSUMSI' | 'KESEHATAN';

const AREA_META: Record<OpsArea, { label: string; sub: string; hint: string }> = {
  LOGISTIK: { label: 'Logistik & Fasilitas', sub: 'Logistik & Fasilitas', hint: 'Venue, layout, peralatan, transport. H-7 cek inventaris.' },
  KONSUMSI: { label: 'Konsumsi & Keramahan', sub: 'Konsumsi & Keramahan', hint: 'Menu, porsi, vendor/self-made, jadwal distribusi.' },
  KESEHATAN: { label: 'Kesehatan & Keselamatan', sub: 'Kesehatan & Keselamatan', hint: 'Kit P3K, petugas standby + lokasi kit, protokol darurat.' },
};

type Transport = { id: string; pickupPoint: string; driver?: string | null; seats?: number | null; contact?: string | null };

/**
 * Tab operasional Diakonia per area — status kesiapan + catatan + (khusus
 * Logistik) titik jemput carpool yang menjadi sumber caption Ajak Koinonia.
 */
export const DiakoniaOperasionalTab: React.FC<{ eventId: string; area: OpsArea }> = ({ eventId, area }) => {
  const { addToast } = useApp();
  const meta = AREA_META[area];
  const [status, setStatus] = useState('BELUM');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [transport, setTransport] = useState<Transport[]>([]);
  const [pickup, setPickup] = useState('');
  const [driver, setDriver] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/readiness`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      const c = (d.checks || []).find((x: { area: string }) => x.area === area);
      if (c) { setStatus(c.status); setNote(c.note || ''); }
      if (area === 'LOGISTIK') setTransport(d.transport || []);
    } catch { /* abaikan */ }
  }, [eventId, area]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/checks`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, status, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan');
      addToast({ type: 'success', title: `${meta.label}: ${status}` });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal menyimpan', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const addTransport = async () => {
    if (!pickup.trim()) return;
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/transport`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickupPoint: pickup.trim(), driver: driver.trim() || undefined }),
    });
    if (r.ok) { setPickup(''); setDriver(''); await load(); }
  };

  const removeTransport = async (id: string) => {
    await fetch(`/api/diakonia/transport/${id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
        <div>
          <h3 className="text-sm font-black text-[#1B1B1B]">{meta.label}</h3>
          <p className="text-[11px] text-[#8C8880] mt-0.5">{meta.hint}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['BELUM', 'SIAP', 'KENDALA'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${status === s ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={area === 'KONSUMSI' ? 'Menu, porsi (estimasi hadir + buffer), vendor, jadwal distribusi…' : area === 'KESEHATAN' ? 'Petugas standby + lokasi kit, catatan protokol…' : 'Venue, layout, peralatan, kebutuhan transport…'}
          className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black"
        />
        <button type="button" onClick={() => void save()} disabled={saving} className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Simpan kesiapan'}
        </button>
      </div>

      {area === 'LOGISTIK' && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Titik jemput carpool</p>
          <p className="text-[11px] text-[#8C8880] mt-0.5">Otomatis dibaca caption Ajak & Jemput Koinonia.</p>
          <div className="mt-2 space-y-1.5">
            {transport.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2">
                <p className="flex-1 text-xs"><strong>{t.pickupPoint}</strong>{t.driver && <span className="text-[#8C8880]"> · {t.driver}</span>}{t.seats ? <span className="text-[#8C8880]"> · {t.seats} kursi</span> : null}</p>
                <button type="button" onClick={() => void removeTransport(t.id)} className="text-[#8C8880] hover:text-red-500" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Titik jemput — mis. Gerbang Citywalk" className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
            <input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Driver (opsional)" className="w-36 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
            <button type="button" onClick={() => void addTransport()} disabled={!pickup.trim()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">Tambah</button>
          </div>
        </div>
      )}
    </div>
  );
};
