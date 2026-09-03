import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Week = { index: number; date?: string; theme?: string; verse?: string; liturgiaPic?: string };
type Deliverable = {
  id: string;
  weekIndex: number;
  division: string;
  kind?: string | null;
  title: string;
  status: string;
};

const DIV_LABEL: Record<string, string> = {
  LITURGIA: 'Liturgia',
  DIDASKALIA: 'Didaskalia',
  KOINONIA: 'Koinonia',
  DIAKONIA: 'Diakonia',
  MARTURIA: 'Marturia',
  BENZARPR: 'BZP',
};

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tanggal hari Minggu, ditampilkan singkat: "6 Sep". */
function shortDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const MonthlyPlanPanel: React.FC = () => {
  const { addToast } = useApp();
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [theme, setTheme] = useState('');
  const [weeks, setWeeks] = useState<Week[]>([1, 2, 3, 4].map((index) => ({ index })));
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [divisions, setDivisions] = useState<string[]>(Object.keys(DIV_LABEL));
  const [kinds, setKinds] = useState<string[]>(['MODULE', 'RUNDOWN', 'BENZUAR', 'BENZINEMA', 'LOGISTICS']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ weekIndex: 1, division: 'DIDASKALIA', kind: 'MODULE', title: '' });

  const load = useCallback(async () => {
    const r = await fetch(`/api/ministry-plans/${yearMonth}`, { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Gagal memuat rencana');
    setTheme(d.plan?.theme || '');
    setWeeks(Array.isArray(d.plan?.weeks) && d.plan.weeks.length ? d.plan.weeks : [1, 2, 3, 4].map((index) => ({ index })));
    setDeliverables(d.plan?.deliverables || []);
    if (d.divisions) setDivisions(d.divisions);
    if (d.kinds) setKinds(d.kinds);
  }, [yearMonth]);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => addToast({ type: 'error', title: e.message })).finally(() => setLoading(false));
  }, [load, addToast]);

  const saveMeta = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/ministry-plans/${yearMonth}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, weeks }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal simpan');
      addToast({ type: 'success', title: 'Rencana bulan disimpan' });
    } catch (e: any) {
      addToast({ type: 'error', title: e.message });
    } finally {
      setSaving(false);
    }
  };

  const addDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/ministry-plans/${yearMonth}/deliverables`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menambah');
      setDraft((x) => ({ ...x, title: '' }));
      await load();
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: Deliverable) => {
    const next = item.status === 'DONE' ? 'TODO' : 'DONE';
    await fetch(`/api/ministry-plans/deliverables/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    await load();
  };

  const removeDeliverable = async (item: Deliverable) => {
    if (!window.confirm(`Hapus "${item.title}"?`)) return;
    const r = await fetch(`/api/ministry-plans/deliverables/${item.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      addToast({ type: 'error', title: d.error || 'Gagal menghapus' });
      return;
    }
    await load();
  };

  const itemsFor = (week: number, division: string) =>
    deliverables.filter((d) => d.weekIndex === week && d.division === division);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h3 className="text-sm font-black text-[#1B1B1B]">Rencana pelayanan bulanan</h3>
          <p className="text-xs text-[#8C8880]">Tema bulan + deliverable per minggu per divisi (BenZuar / BenZinema di Koinonia).</p>
        </div>
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="ml-auto px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
        />
      </div>

      <div className="flex gap-2">
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Tema bulan"
          className="flex-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
        />
        <button
          type="button"
          onClick={saveMeta}
          disabled={saving}
          className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Simpan tema'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880]">Memuat…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#D9D7D0]">
          <table className="min-w-full text-xs">
            <thead className="bg-[#FAF9F5] text-[#8C8880]">
              <tr>
                <th className="p-2 text-left font-bold">Minggu</th>
                {divisions.map((d) => (
                  <th key={d} className="p-2 text-left font-bold">{DIV_LABEL[d] || d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.index} className="border-t border-[#EFEDE8] align-top">
                  <td className="p-2 w-28">
                    <p className="font-bold text-[#1B1B1B]">
                      W{w.index}
                      {w.date && <span className="ml-1 font-medium text-[#8C8880]">· {shortDate(w.date)}</span>}
                    </p>
                    <input
                      value={w.theme || ''}
                      onChange={(e) => setWeeks((prev) => prev.map((x) => x.index === w.index ? { ...x, theme: e.target.value } : x))}
                      placeholder="Tema minggu"
                      className="mt-1 w-full px-2 py-1 rounded-lg border border-[#D9D7D0]"
                    />
                  </td>
                  {divisions.map((div) => (
                    <td key={div} className="p-2">
                      <ul className="space-y-1">
                        {itemsFor(w.index, div).map((item) => (
                          <li key={item.id} className="flex items-start gap-1">
                            <button
                              type="button"
                              onClick={() => toggleStatus(item)}
                              className={`flex-1 text-left rounded-lg px-2 py-1 border ${
                                item.status === 'DONE' ? 'bg-emerald-50 border-emerald-200 line-through' : 'bg-white border-[#D9D7D0]'
                              }`}
                            >
                              {item.kind ? `${item.kind} · ` : ''}{item.title}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDeliverable(item)}
                              title="Hapus"
                              className="p-1 rounded-lg text-[#8C8880] hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={addDeliverable} className="rounded-2xl border border-[#D9D7D0] bg-white p-3 grid sm:grid-cols-5 gap-2">
        <select
          value={draft.weekIndex}
          onChange={(e) => setDraft((d) => ({ ...d, weekIndex: Number(e.target.value) }))}
          className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs"
        >
          {weeks.map((w) => <option key={w.index} value={w.index}>Minggu {w.index}</option>)}
        </select>
        <select
          value={draft.division}
          onChange={(e) => setDraft((d) => ({ ...d, division: e.target.value }))}
          className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs"
        >
          {divisions.map((d) => <option key={d} value={d}>{DIV_LABEL[d] || d}</option>)}
        </select>
        <select
          value={draft.kind}
          onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
          className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs"
        >
          {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Modul W1 / BenZinema / rundown"
          className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs sm:col-span-1"
        />
        <button
          type="submit"
          disabled={saving || !draft.title.trim()}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </form>
    </div>
  );
};
