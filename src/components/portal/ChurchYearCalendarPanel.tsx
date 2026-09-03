import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, ListChecks, Loader2, Plus, RefreshCw, Rocket, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Level = 'SINODE' | 'WILAYAH' | 'JEMAAT' | 'KOMISI' | 'KOLOM';
type Source = 'LITURGICAL' | 'GMIM_FIXED' | 'JEMAAT';

type CalendarEntry = {
  id: string;
  startDate: string;
  endDate?: string | null;
  level: Level;
  source: Source;
  season?: string | null;
  name: string;
  nameEn?: string | null;
  notes?: string | null;
  isPublic: boolean;
};

type Collision = { date: string; entries: CalendarEntry[] };

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const SOURCE_LABEL: Record<Source, string> = {
  LITURGICAL: 'Liturgis',
  GMIM_FIXED: 'GMIM',
  JEMAAT: 'Jemaat',
};

const SOURCE_STYLE: Record<Source, string> = {
  LITURGICAL: 'bg-violet-50 border-violet-200 text-violet-800',
  GMIM_FIXED: 'bg-amber-50 border-amber-200 text-amber-800',
  JEMAAT: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

const SEASON_STYLE: Record<string, string> = {
  NATAL: 'bg-rose-50 text-rose-700',
  PASKAH: 'bg-indigo-50 text-indigo-700',
  HUT: 'bg-amber-50 text-amber-700',
  REGULAR: 'bg-[#EFEDE8] text-[#5C5850]',
};

function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

function monthOf(iso: string) {
  return Number(iso.slice(5, 7)) - 1;
}

type Props = {
  /** Promosi entri kalender jadi event operasional lewat form Event Tim Kerja. */
  onPromote?: (entry: { name: string; startDate: string }) => void;
};

export const ChurchYearCalendarPanel: React.FC<Props> = ({ onPromote }) => {
  const { addToast, currentRole } = useApp();
  const [year, setYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startDate: '', name: '', level: 'JEMAAT' as Level, notes: '', isPublic: true });

  const canEdit = currentRole === 'KOMISI' || currentRole === 'BPMJ' || currentRole === 'SUPERADMIN';
  const canSync = currentRole === 'KOMISI' || currentRole === 'SUPERADMIN';

  const load = useCallback(async () => {
    const r = await fetch(`/api/church-calendar?year=${year}`, { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Gagal memuat kalender');
    setEntries(d.entries || []);
    setCollisions(d.collisions || []);
  }, [year]);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => addToast({ type: 'error', title: e.message })).finally(() => setLoading(false));
  }, [load, addToast]);

  const byMonth = useMemo(() => {
    const buckets: CalendarEntry[][] = Array.from({ length: 12 }, () => []);
    for (const e of entries) buckets[monthOf(e.startDate)]?.push(e);
    return buckets;
  }, [entries]);

  const collisionDates = useMemo(() => new Set(collisions.map((c) => c.date)), [collisions]);

  const sync = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/church-calendar/sync/${year}`, { method: 'POST', credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal sinkron');
      await load();
      addToast({
        type: 'success',
        title: d.added ? `${d.added} entri ditambahkan` : 'Kalender sudah lengkap',
      });
    } catch (e: any) {
      addToast({ type: 'error', title: e.message });
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/church-calendar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan');
      setForm({ startDate: '', name: '', level: 'JEMAAT', notes: '', isPublic: true });
      setShowForm(false);
      await load();
      addToast({ type: 'success', title: 'Agenda ditambahkan' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async (entry: CalendarEntry) => {
    const r = await fetch(`/api/church-calendar/${entry.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: !entry.isPublic }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      addToast({ type: 'error', title: d.error || 'Gagal mengubah' });
      return;
    }
    await load();
  };

  const generateRunbook = async (entry: CalendarEntry) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/church-calendar/${entry.id}/generate-runbook`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal membuat runbook');
      addToast({
        type: 'success',
        title: d.created
          ? `${d.created} deliverable dibuat di ${d.months.join(', ')}`
          : 'Runbook sudah ada, tidak ada yang ditambahkan',
      });
    } catch (e: any) {
      addToast({ type: 'error', title: e.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: CalendarEntry) => {
    if (!window.confirm(`Hapus "${entry.name}"?`)) return;
    const r = await fetch(`/api/church-calendar/${entry.id}`, { method: 'DELETE', credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal menghapus' });
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <h3 className="text-sm font-black text-[#1B1B1B]">Kalender gerejawi {year}</h3>
          <p className="text-xs text-[#8C8880] mt-0.5">
            Hari raya liturgis dihitung dari Paskah; tanggal tetap GMIM dan agenda jemaat menyusul.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="px-2.5 py-2 rounded-xl border border-[#D9D7D0] bg-white text-xs font-bold"
          >
            ‹
          </button>
          <span className="text-sm font-black text-[#1B1B1B] w-12 text-center">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="px-2.5 py-2 rounded-xl border border-[#D9D7D0] bg-white text-xs font-bold"
          >
            ›
          </button>
          {canSync && (
            <button
              type="button"
              onClick={sync}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] bg-white text-xs font-bold text-[#5C5850] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sinkron
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Agenda
            </button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <form onSubmit={submit} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-2">
          <div className="grid sm:grid-cols-3 gap-2">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
            />
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Pengucapan Syukur Jemaat"
              className="sm:col-span-2 px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <select
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as Level }))}
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-[#FAF9F5]"
            >
              {(['JEMAAT', 'KOMISI', 'KOLOM', 'WILAYAH', 'SINODE'] as Level[]).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan (opsional)"
              className="sm:col-span-2 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#5C5850]">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
            />
            Tampilkan di website publik
          </label>
          <button
            type="submit"
            disabled={saving || !form.startDate || !form.name.trim()}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Simpan agenda
          </button>
        </form>
      )}

      {collisions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" /> {collisions.length} tanggal bertumpuk
          </p>
          <ul className="mt-1 space-y-0.5">
            {collisions.map((c) => (
              <li key={c.date} className="text-xs text-amber-800">
                {dayLabel(c.date)} {MONTHS[monthOf(c.date)]} — {c.entries.map((e) => e.name).join(' + ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[#8C8880]">Memuat…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-[#D9D7D0] bg-white px-4 py-6 text-center">
          <p className="text-xs text-[#8C8880]">
            Belum ada entri untuk {year}.{canSync ? ' Tekan Sinkron untuk mengisi hari raya terhitung.' : ''}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MONTHS.map((label, idx) => (
            <div key={label} className="rounded-2xl border border-[#D9D7D0] bg-white overflow-hidden">
              <div className="px-3 py-2 bg-[#FAF9F5] border-b border-[#EFEDE8] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">{label}</span>
                <span className="text-[10px] font-bold text-[#8C8880]">{byMonth[idx].length || ''}</span>
              </div>
              {byMonth[idx].length === 0 ? (
                <p className="px-3 py-2 text-[10px] text-[#B8B4AC]">—</p>
              ) : (
                <ul className="divide-y divide-[#F4F2EE]">
                  {byMonth[idx].map((e) => (
                    <li key={e.id} className="px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1B1B1B] flex items-center gap-1">
                            {collisionDates.has(e.startDate) && (
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            )}
                            <span className="truncate">{e.name}</span>
                          </p>
                          <p className="text-[10px] text-[#8C8880] mt-0.5 flex items-center gap-1 flex-wrap">
                            <span>{dayLabel(e.startDate)}</span>
                            <span className={`px-1 rounded border ${SOURCE_STYLE[e.source]}`}>
                              {SOURCE_LABEL[e.source]}
                            </span>
                            {e.season && (
                              <span className={`px-1 rounded ${SEASON_STYLE[e.season] || SEASON_STYLE.REGULAR}`}>
                                {e.season}
                              </span>
                            )}
                          </p>
                          {e.notes && <p className="text-[10px] text-[#5C5850] mt-0.5">{e.notes}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => generateRunbook(e)}
                            disabled={saving}
                            title="Buat checklist runbook H-21 → H+7"
                            className="p-1 rounded text-[#8C8880] hover:text-[#1B1B1B] disabled:opacity-40"
                          >
                            <ListChecks className="w-3 h-3" />
                          </button>
                          {onPromote && (
                            <button
                              type="button"
                              onClick={() => onPromote({ name: e.name, startDate: e.startDate })}
                              title="Jadikan event operasional"
                              className="p-1 rounded text-[#8C8880] hover:text-[#1B1B1B]"
                            >
                              <Rocket className="w-3 h-3" />
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => togglePublic(e)}
                                title={e.isPublic ? 'Sembunyikan dari publik' : 'Tampilkan di publik'}
                                className="p-1 rounded text-[#8C8880] hover:text-[#1B1B1B]"
                              >
                                {e.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </button>
                              {e.source === 'JEMAAT' && (
                                <button
                                  type="button"
                                  onClick={() => remove(e)}
                                  title="Hapus"
                                  className="p-1 rounded text-[#8C8880] hover:text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
