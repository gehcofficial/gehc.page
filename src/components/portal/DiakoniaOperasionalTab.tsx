import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type OpsArea = 'LOGISTIK' | 'KONSUMSI' | 'KESEHATAN';

const AREA_META: Record<OpsArea, { label: string; hint: string }> = {
  LOGISTIK: { label: 'Logistik & Fasilitas', hint: 'Venue, layout, peralatan, transport. H-7 cek inventaris.' },
  KONSUMSI: { label: 'Konsumsi & Keramahan', hint: 'Menu, porsi, vendor/self-made, jadwal distribusi.' },
  KESEHATAN: { label: 'Kesehatan & Keselamatan', hint: 'Kit P3K, petugas standby + lokasi kit, protokol darurat.' },
};

type Transport = { id: string; pickupPoint: string; driver?: string | null; seats?: number | null };
type InvItem = { id: string; name: string; unit: string; qtyTotal: number; condition: string; location?: string | null };
type Checkout = { id: string; inventoryId: string; qty: number; status: string; note?: string | null; inventory?: { name: string; unit: string } };

/**
 * Tab operasional Diakonia per area — status kesiapan + catatan +
 * (Logistik) inventaris & pinjam-kembali + carpool,
 * (Konsumsi) rencana konsumsi terstruktur,
 * (Kesehatan) standby + log insiden.
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
      const c = ((d.checks || []) as Array<{ area: string; status: string; note?: string | null }>).find((x) => x.area === area);
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
          placeholder={area === 'KONSUMSI' ? 'Catatan umum konsumsi…' : area === 'KESEHATAN' ? 'Catatan umum kesehatan…' : 'Venue, layout, peralatan, kebutuhan transport…'}
          className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black"
        />
        <button type="button" onClick={() => void save()} disabled={saving} className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Simpan kesiapan'}
        </button>
      </div>

      {area === 'LOGISTIK' && (
        <>
          <InventorySection eventId={eventId} />
          <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Titik jemput carpool</p>
            <p className="text-[11px] text-[#8C8880] mt-0.5">Otomatis dibaca caption Ajak & Jemput Koinonia.</p>
            <div className="mt-2 space-y-1.5">
              {transport.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2">
                  <p className="flex-1 text-xs"><strong>{t.pickupPoint}</strong>{t.driver && <span className="text-[#8C8880]"> · {t.driver}</span>}</p>
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
        </>
      )}

      {area === 'KONSUMSI' && <ConsumptionSection eventId={eventId} />}
      {area === 'KESEHATAN' && <SafetySection eventId={eventId} />}
    </div>
  );
};

/** Master inventaris + pinjam-kembali event ini. */
const InventorySection: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast } = useApp();
  const [items, setItems] = useState<InvItem[]>([]);
  const [loans, setLoans] = useState<Checkout[]>([]);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [pickId, setPickId] = useState('');

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch('/api/diakonia/inventory', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/checkout`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
    ]);
    setItems(a.items || []);
    setLoans(b.items || []);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const addItem = async () => {
    if (!name.trim()) return;
    const r = await fetch('/api/diakonia/inventory', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), qtyTotal: Number(qty) || 0 }),
    });
    if (r.ok) { setName(''); setQty('1'); await load(); }
    else addToast({ type: 'error', title: 'Gagal menambah barang' });
  };

  const checkout = async () => {
    if (!pickId) return;
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/checkout`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryId: pickId, qty: 1 }),
    });
    if (r.ok) { setPickId(''); await load(); }
  };

  const setLoanStatus = async (id: string, status: string) => {
    const r = await fetch(`/api/diakonia/checkout/${id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (r.ok) await load();
  };

  const openLoans = loans.filter((l) => l.status === 'KELUAR');

  return (
    <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Inventaris & pinjam-kembali</p>
      {openLoans.length > 0 && (
        <div className="space-y-1.5">
          {openLoans.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/60 border border-amber-200 px-3 py-2">
              <p className="flex-1 text-xs"><strong>{l.inventory?.name || '—'}</strong> × {l.qty} <span className="text-amber-700 font-bold">· keluar</span></p>
              <button type="button" onClick={() => void setLoanStatus(l.id, 'KEMBALI')} className="text-[11px] font-bold text-emerald-700">Kembali</button>
              <button type="button" onClick={() => void setLoanStatus(l.id, 'RUSAK')} className="text-[11px] font-bold text-amber-700">Rusak</button>
              <button type="button" onClick={() => void setLoanStatus(l.id, 'HILANG')} className="text-[11px] font-bold text-red-600">Hilang</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <select value={pickId} onChange={(e) => setPickId(e.target.value)} className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs">
          <option value="">Pinjam barang untuk event ini…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name} (stok {i.qtyTotal} {i.unit})</option>)}
        </select>
        <button type="button" onClick={() => void checkout()} disabled={!pickId} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">Pinjam</button>
      </div>
      <div className="space-y-1">
        {items.map((i) => (
          <p key={i.id} className="text-[11px] text-[#5C5850]">• <strong className="text-[#1B1B1B]">{i.name}</strong> — {i.qtyTotal} {i.unit}{i.location ? ` · ${i.location}` : ''}{i.condition !== 'BAIK' ? ` · ⚠ ${i.condition}` : ''}</p>
        ))}
        {items.length === 0 && <p className="text-[11px] text-[#8C8880]">Belum ada barang. Daftarkan di bawah.</p>}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#EFEDE8] pt-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addItem(); }} placeholder="Nama barang — mis. Kabel roll 20m" className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="Stok" className="w-20 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs" />
        <button type="button" onClick={() => void addItem()} disabled={!name.trim()} className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-bold disabled:opacity-40">+ Barang</button>
      </div>
    </div>
  );
};

/** Rencana konsumsi terstruktur per event. */
const ConsumptionSection: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast } = useApp();
  const [menu, setMenu] = useState('');
  const [portions, setPortions] = useState('');
  const [vendor, setVendor] = useState('');
  const [dist, setDist] = useState('');
  const [leftover, setLeftover] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/consumption`, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    const c = d.item;
    if (c) {
      setMenu(c.menu || ''); setPortions(c.portions?.toString() || '');
      setVendor(c.vendor || ''); setDist(c.distributionNote || ''); setLeftover(c.leftoverNote || '');
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/consumption`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu, portions: portions === '' ? null : portions, vendor, distributionNote: dist, leftoverNote: leftover }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) addToast({ type: 'error', title: d.error || 'Gagal menyimpan' });
    else addToast({ type: 'success', title: 'Rencana konsumsi tersimpan' });
  };

  const cls = 'w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black';
  return (
    <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Rencana konsumsi</p>
      <textarea value={menu} onChange={(e) => setMenu(e.target.value)} rows={2} placeholder="Menu — mis. Nasi + ayam + teh (200 pax + buffer 20)" className={cls} />
      <div className="flex flex-wrap gap-2">
        <input value={portions} onChange={(e) => setPortions(e.target.value)} inputMode="numeric" placeholder="Porsi" className={`${cls} flex-1 min-w-[100px]`} />
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor / self-made (PIC)" className={`${cls} flex-[2] min-w-[160px]`} />
      </div>
      <textarea value={dist} onChange={(e) => setDist(e.target.value)} rows={2} placeholder="Jadwal & alur distribusi…" className={cls} />
      <textarea value={leftover} onChange={(e) => setLeftover(e.target.value)} rows={1} placeholder="Sisa & reimburse (link BZP bila perlu)…" className={cls} />
      <button type="button" onClick={() => void save()} className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">Simpan konsumsi</button>
    </div>
  );
};

type Incident = { id: string; description: string; severity: string; followupCaseId?: string | null };

/** Standby medis + log insiden per event. */
const SafetySection: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast } = useApp();
  const [standby, setStandby] = useState('');
  const [kit, setKit] = useState('');
  const [proto, setProto] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [desc, setDesc] = useState('');
  const [sev, setSev] = useState('RINGAN');

  const load = useCallback(async () => {
    const [s, list] = await Promise.all([
      fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/safety`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<{ item?: { standbyName?: string | null; kitLocation?: string | null; protocolNote?: string | null } }>,
      fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/incidents`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })) as Promise<{ items?: Incident[] }>,
    ]);
    if (s.item) { setStandby(s.item.standbyName || ''); setKit(s.item.kitLocation || ''); setProto(s.item.protocolNote || ''); }
    setIncidents(list.items || []);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/safety`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standbyName: standby, kitLocation: kit, protocolNote: proto }),
    });
    if (r.ok) addToast({ type: 'success', title: 'Standby tersimpan' });
  };

  const addIncident = async () => {
    if (!desc.trim()) return;
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/incidents`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc.trim(), severity: sev }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal' }); return; }
    setDesc('');
    await load();
  };

  const toCase = async (inc: Incident) => {
    // Buat kasus peduli dari insiden BERAT, lalu tautkan balik.
    const cr = await fetch('/api/diakonia/cases', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Tindak lanjut insiden: ${inc.description.slice(0, 120)}`, kind: 'SAKIT', needSummary: inc.description }),
    });
    const cd = await cr.json().catch(() => ({}));
    if (!cr.ok) { addToast({ type: 'error', title: cd.error || 'Gagal membuat kasus' }); return; }
    await fetch(`/api/diakonia/incidents/${inc.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followupCaseId: cd.item?.id }),
    });
    addToast({ type: 'success', title: 'Kasus peduli dibuat', description: 'Lanjut di tab Peduli.' });
    await load();
  };

  const cls = 'w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black';
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Petugas standby</p>
        <div className="flex flex-wrap gap-2">
          <input value={standby} onChange={(e) => setStandby(e.target.value)} placeholder="Nama petugas standby" className={`${cls} flex-1 min-w-[140px]`} />
          <input value={kit} onChange={(e) => setKit(e.target.value)} placeholder="Lokasi kit P3K" className={`${cls} flex-1 min-w-[140px]`} />
        </div>
        <textarea value={proto} onChange={(e) => setProto(e.target.value)} rows={2} placeholder="Protokol darurat venue ini…" className={cls} />
        <button type="button" onClick={() => void save()} className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">Simpan standby</button>
      </div>
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Log insiden ({incidents.length})</p>
        {incidents.map((i) => (
          <div key={i.id} className={`rounded-xl border px-3 py-2 ${i.severity === 'BERAT' ? 'border-red-200 bg-red-50/60' : 'bg-[#FAF9F5] border-[#D9D7D0]'}`}>
            <p className="text-xs text-[#1B1B1B]">{i.description}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8C8880]">
              {i.severity}
              {i.followupCaseId ? (
                <span className="text-emerald-700">→ kasus peduli ✓</span>
              ) : i.severity === 'BERAT' ? (
                <button type="button" onClick={() => void toCase(i)} className="text-sky-700 hover:underline">Buat kasus peduli →</button>
              ) : null}
            </p>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addIncident(); }} placeholder="Catat insiden… (Enter)" className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
          <select value={sev} onChange={(e) => setSev(e.target.value)} className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold">
            <option value="RINGAN">Ringan</option>
            <option value="BERAT">Berat</option>
          </select>
          <button type="button" onClick={() => void addIncident()} disabled={!desc.trim()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">Catat</button>
        </div>
      </div>
    </div>
  );
};
