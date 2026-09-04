import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, GraduationCap, Loader2, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { buildRecreationalTree, type RecreationalNode } from '../../lib/recreational';

type RecSuggestion = {
  id: string;
  name: string;
  kind: string;
  parentId?: string | null;
  status: string;
  user?: { id: string; name: string; email?: string | null };
};

type InstSuggestion = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  status: string;
  user?: { id: string; name: string; email?: string | null };
};

type Institution = { id: string; name: string; city?: string | null; country?: string | null };

type Tab = 'minat' | 'kampus';

export const CatalogReviewPanel: React.FC = () => {
  const { addToast } = useApp();
  const [tab, setTab] = useState<Tab>('minat');
  const [recFlat, setRecFlat] = useState<RecreationalNode[]>([]);
  const [recPending, setRecPending] = useState<RecSuggestion[]>([]);
  const [instPending, setInstPending] = useState<InstSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRec, setSelectedRec] = useState<string[]>([]);
  const [selectedInst, setSelectedInst] = useState<string[]>([]);
  const [targetRecId, setTargetRecId] = useState('');
  const [targetInstId, setTargetInstId] = useState('');
  const [instQuery, setInstQuery] = useState('');
  const [instHits, setInstHits] = useState<Institution[]>([]);
  const [busy, setBusy] = useState('');
  const [addRec, setAddRec] = useState({ name: '', kind: 'SPORTS', parentId: '' });
  const [addInst, setAddInst] = useState({ name: '', city: '', country: 'Indonesia' });

  const tree = useMemo(() => buildRecreationalTree(recFlat), [recFlat]);
  const selectableRec = useMemo(
    () => recFlat.filter((r) => r.selectable !== false && r.parentId),
    [recFlat],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, recSugRes, instSugRes] = await Promise.all([
        fetch('/api/recreational', { credentials: 'include' }),
        fetch('/api/recreational/suggestions?status=PENDING', { credentials: 'include' }),
        fetch('/api/institutions/suggestions?status=PENDING', { credentials: 'include' }),
      ]);
      const rec = recRes.ok ? await recRes.json() : {};
      const rs = recSugRes.ok ? await recSugRes.json() : {};
      const is_ = instSugRes.ok ? await instSugRes.json() : {};
      setRecFlat(rec.recreational || []);
      setRecPending(rs.suggestions || []);
      setInstPending(is_.suggestions || []);
    } catch {
      addToast({ type: 'error', title: 'Gagal memuat', description: 'Katalog tidak bisa dimuat.' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const q = instQuery.trim();
    if (q.length < 2) {
      setInstHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/institutions?kind=UNIVERSITY&q=${encodeURIComponent(q)}`, { credentials: 'include' });
      const d = res.ok ? await res.json() : {};
      setInstHits(d.institutions || []);
    }, 250);
    return () => clearTimeout(t);
  }, [instQuery]);

  const toggle = (list: string[], id: string, set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const mapRec = async () => {
    if (!selectedRec.length || !targetRecId) return;
    setBusy('map-rec');
    try {
      const res = await fetch('/api/recreational/suggestions/map', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: selectedRec, groupId: targetRecId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal memetakan minat');
      addToast({ type: 'success', title: 'Reminder terkirim', description: `${d.mapped} pengusul diingatkan.` });
      setSelectedRec([]);
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy('');
    }
  };

  const approveRec = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/recreational/suggestions/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menyetujui');
      addToast({ type: 'success', title: 'Minat ditambah', description: 'Pengusul mendapat reminder.' });
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy('');
    }
  };

  const rejectRec = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/recreational/suggestions/${id}/reject`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Gagal menolak');
      await load();
    } finally {
      setBusy('');
    }
  };

  const mapInst = async () => {
    if (!selectedInst.length || !targetInstId) return;
    setBusy('map-inst');
    try {
      const res = await fetch('/api/institutions/suggestions/map', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: selectedInst, institutionId: targetInstId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal memetakan kampus');
      addToast({ type: 'success', title: 'Reminder terkirim', description: `${d.mapped} pengusul diingatkan.` });
      setSelectedInst([]);
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy('');
    }
  };

  const approveInst = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/institutions/suggestions/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menyetujui');
      addToast({ type: 'success', title: 'Kampus ditambah', description: 'Pengusul mendapat reminder.' });
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy('');
    }
  };

  const rejectInst = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`/api/institutions/suggestions/${id}/reject`, { method: 'POST', credentials: 'include' });
      await load();
    } finally {
      setBusy('');
    }
  };

  const createRec = async () => {
    if (!addRec.name.trim()) return;
    setBusy('add-rec');
    try {
      const body: Record<string, string> = { name: addRec.name.trim() };
      if (addRec.parentId) body.parentId = addRec.parentId;
      else body.kind = addRec.kind;
      const res = await fetch('/api/recreational', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menambah');
      setAddRec({ name: '', kind: 'SPORTS', parentId: '' });
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy('');
    }
  };

  const archiveRec = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/recreational/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectable: false }),
      });
      if (!res.ok) throw new Error('Gagal arsip');
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy('');
    }
  };

  const createInst = async () => {
    if (!addInst.name.trim()) return;
    setBusy('add-inst');
    try {
      const res = await fetch('/api/institutions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addInst.name.trim(),
          city: addInst.city.trim() || null,
          country: addInst.country.trim() || 'Indonesia',
          kind: 'UNIVERSITY',
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menambah kampus');
      addToast({ type: 'success', title: 'Kampus ditambah', description: d.institution?.name });
      setAddInst({ name: '', city: '', country: 'Indonesia' });
      if (d.institution?.id) setTargetInstId(d.institution.id);
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy('');
    }
  };

  const cats = recFlat.filter((r) => !r.parentId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-[#1B1B1B]">Katalog Minat & Kampus</h1>
        <p className="text-sm text-[#8C8880] mt-1">
          Kelola daftar default. Request “Lainnya” dipilih ke satu opsi, lalu reminder ke pengusul — mereka mencentang sendiri di profil.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('minat')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${tab === 'minat' ? 'bg-[#181818] text-white' : 'bg-white border border-[#D9D7D0] text-[#8C8880]'}`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Minat ({recPending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('kampus')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${tab === 'kampus' ? 'bg-[#181818] text-white' : 'bg-white border border-[#D9D7D0] text-[#8C8880]'}`}
        >
          <GraduationCap className="w-3.5 h-3.5" /> Universitas ({instPending.length})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
      ) : tab === 'minat' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Antrian saran minat</p>
            {recPending.length === 0 ? (
              <p className="text-xs text-amber-900">Tidak ada request PENDING.</p>
            ) : recPending.map((s) => (
              <label key={s.id} className="flex items-start gap-2 py-1.5 border-b border-amber-100 last:border-0">
                <input
                  type="checkbox"
                  checked={selectedRec.includes(s.id)}
                  onChange={() => toggle(selectedRec, s.id, setSelectedRec)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{s.name}</p>
                  <p className="text-[10px] text-amber-800">{s.kind} · {s.user?.name || '—'}</p>
                </div>
                <button type="button" disabled={!!busy} onClick={() => approveRec(s.id)} className="px-2 py-1 rounded-lg bg-[#181818] text-white text-[9px] font-bold">Buat baru + reminder</button>
                <button type="button" disabled={!!busy} onClick={() => rejectRec(s.id)} className="px-2 py-1 rounded-lg border border-amber-200 text-[9px] font-bold">Tolak</button>
              </label>
            ))}
            {recPending.length > 0 && (
              <div className="flex flex-wrap gap-2 items-end pt-2">
                <label className="flex-1 min-w-[180px] space-y-1">
                  <span className="text-[10px] font-bold text-amber-900">Pakai opsi yang sudah ada</span>
                  <select value={targetRecId} onChange={(e) => setTargetRecId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-amber-200 text-xs bg-white">
                    <option value="">— Pilih chip —</option>
                    {selectableRec.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!selectedRec.length || !targetRecId || !!busy}
                  onClick={mapRec}
                  className="px-3 py-2 rounded-xl bg-[#181818] text-white text-[10px] font-bold disabled:opacity-50"
                >
                  {busy === 'map-rec' ? '…' : 'Reminder ke pengusul terpilih'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
            <p className="text-[10px] font-black uppercase text-[#8C8880]">Tambah ke katalog</p>
            <div className="flex flex-wrap gap-2">
              <input value={addRec.name} onChange={(e) => setAddRec((f) => ({ ...f, name: e.target.value }))} placeholder="Nama" className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
              <select value={addRec.parentId} onChange={(e) => setAddRec((f) => ({ ...f, parentId: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
                <option value="">Kategori baru (Sports/Arts)</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!addRec.parentId && (
                <select value={addRec.kind} onChange={(e) => setAddRec((f) => ({ ...f, kind: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
                  <option value="SPORTS">SPORTS</option>
                  <option value="ARTS">ARTS</option>
                </select>
              )}
              <button type="button" disabled={!!busy} onClick={createRec} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#181818] text-white text-[10px] font-bold">
                <Plus className="w-3 h-3" /> Simpan
              </button>
            </div>
            {(['SPORTS', 'ARTS'] as const).map((kind) => (
              <div key={kind} className="text-xs">
                <p className="font-bold">{kind === 'SPORTS' ? 'Sports' : 'Arts'}</p>
                {tree.filter((c) => c.kind === kind).map((cat) => (
                  <div key={cat.id} className="ml-3 mt-1">
                    <p className="font-semibold text-[#8C8880]">{cat.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(cat.children || []).map((leaf) => (
                        <button
                          key={leaf.id}
                          type="button"
                          title="Arsipkan (sembunyikan dari picker)"
                          onClick={() => archiveRec(leaf.id)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${leaf.selectable === false ? 'bg-gray-200 text-gray-400 line-through' : 'bg-[#F3F1EC] text-[#8C8880]'}`}
                        >
                          {leaf.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-sky-800">Antrian saran kampus</p>
            {instPending.length === 0 ? (
              <p className="text-xs text-sky-900">Tidak ada request PENDING.</p>
            ) : instPending.map((s) => (
              <label key={s.id} className="flex items-start gap-2 py-1.5 border-b border-sky-100 last:border-0">
                <input type="checkbox" checked={selectedInst.includes(s.id)} onChange={() => toggle(selectedInst, s.id, setSelectedInst)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{s.name}</p>
                  <p className="text-[10px] text-sky-800">{[s.city, s.country].filter(Boolean).join(' · ') || '—'} · {s.user?.name || '—'}</p>
                </div>
                <button type="button" disabled={!!busy} onClick={() => approveInst(s.id)} className="px-2 py-1 rounded-lg bg-[#181818] text-white text-[9px] font-bold">Buat baru + reminder</button>
                <button type="button" disabled={!!busy} onClick={() => rejectInst(s.id)} className="px-2 py-1 rounded-lg border border-sky-200 text-[9px] font-bold">Tolak</button>
              </label>
            ))}
            {instPending.length > 0 && (
              <div className="space-y-2 pt-2">
                <input
                  value={instQuery}
                  onChange={(e) => setInstQuery(e.target.value)}
                  placeholder="Cari kampus di katalog (min. 2 huruf)…"
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 text-xs bg-white"
                />
                <div className="flex flex-wrap gap-1">
                  {instHits.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setTargetInstId(i.id)}
                      className={`px-2 py-1 rounded-full text-[9px] font-bold ${targetInstId === i.id ? 'bg-[#181818] text-white' : 'bg-white border border-sky-200'}`}
                    >
                      {i.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!selectedInst.length || !targetInstId || !!busy}
                  onClick={mapInst}
                  className="px-3 py-2 rounded-xl bg-[#181818] text-white text-[10px] font-bold disabled:opacity-50"
                >
                  {busy === 'map-inst' ? '…' : 'Reminder ke pengusul terpilih'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-2">
            <p className="text-[10px] font-black uppercase text-[#8C8880]">Tambah kampus manual (termasuk luar negeri)</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <input value={addInst.name} onChange={(e) => setAddInst((f) => ({ ...f, name: e.target.value }))} placeholder="Nama kampus" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
              <input value={addInst.city} onChange={(e) => setAddInst((f) => ({ ...f, city: e.target.value }))} placeholder="Kota" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
              <input value={addInst.country} onChange={(e) => setAddInst((f) => ({ ...f, country: e.target.value }))} placeholder="Negara" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            </div>
            <button type="button" disabled={!!busy} onClick={createInst} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#181818] text-white text-[10px] font-bold">
              <Plus className="w-3 h-3" /> Simpan kampus
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
