import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Archive, RotateCcw } from 'lucide-react';
import type { ServiceRole } from '../../types/penatalayan';

type Props = {
  /** Divisi yang dikelola, mis. ['LITURGIA'] atau ['LITURGIA','MARTURIA']. */
  divisions: string[];
  /** Label bahasa Indonesia untuk divisi. */
  divisionLabel?: (division: string) => string;
  onChanged?: () => void;
};

type Edit = { name: string; division: string; subDivision: string; serviceTypes: string[]; checklist: string; sortOrder: number };

const TYPES = [
  { id: 'SERVING_DAY', label: 'Serving' },
  { id: 'MENTORING_DAY', label: 'Mentoring' },
];

function parseTypes(csv?: string | null): string[] {
  const list = String(csv || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  return list.length ? list : ['SERVING_DAY', 'MENTORING_DAY'];
}

function editFrom(role: ServiceRole): Edit {
  return {
    name: role.name,
    division: role.division,
    subDivision: role.subDivision || '',
    serviceTypes: parseTypes(role.serviceTypes),
    checklist: (role.checklistTemplate || []).join('\n'),
    sortOrder: role.sortOrder,
  };
}

/**
 * Editor daftar komponen penatalayan (ServiceRole) per divisi.
 * Mendukung sub-divisi, jenis ibadah (Serving/Mentoring), dan template checklist.
 */
export const PenatalayanRolesEditor: React.FC<Props> = ({ divisions, divisionLabel, onChanged }) => {
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', division: divisions[0] || 'LITURGIA', subDivision: '' });
  const [edits, setEdits] = useState<Record<string, Edit>>({});

  const query = divisions.join(',');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/penatalayan/roles?division=${encodeURIComponent(query)}&includeInactive=1`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setRoles(d.roles || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat komponen.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  const label = (division: string) => (divisionLabel ? divisionLabel(division) : division);

  const addRole = async () => {
    if (!draft.name.trim()) return;
    setBusy('new');
    try {
      const r = await fetch('/api/penatalayan/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: draft.name.trim(), division: draft.division, subDivision: draft.subDivision.trim() || undefined }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menambah komponen.');
      }
      setDraft({ name: '', division: draft.division, subDivision: draft.subDivision });
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah komponen.');
    } finally {
      setBusy(null);
    }
  };

  const saveRole = async (role: ServiceRole) => {
    const e = edits[role.id];
    if (!e) return;
    setBusy(role.id);
    try {
      const checklist = e.checklist.split('\n').map((s) => s.trim()).filter(Boolean);
      const r = await fetch(`/api/penatalayan/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: e.name,
          division: e.division,
          subDivision: e.subDivision.trim(),
          serviceTypes: e.serviceTypes.join(','),
          checklistTemplate: checklist,
          sortOrder: e.sortOrder,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menyimpan komponen.');
      }
      setEdits((prev) => { const next = { ...prev }; delete next[role.id]; return next; });
      await load();
      onChanged?.();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Gagal menyimpan komponen.');
    } finally {
      setBusy(null);
    }
  };

  const toggleArchive = async (role: ServiceRole) => {
    setBusy(role.id);
    try {
      if (role.isActive) {
        const r = await fetch(`/api/penatalayan/roles/${role.id}`, { method: 'DELETE', credentials: 'include' });
        if (!r.ok) throw new Error('Gagal mengarsipkan komponen.');
      } else {
        const r = await fetch(`/api/penatalayan/roles/${role.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isActive: true }),
        });
        if (!r.ok) throw new Error('Gagal mengaktifkan komponen.');
      }
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah komponen.');
    } finally {
      setBusy(null);
    }
  };

  const grouped = divisions.map((division) => ({
    division,
    items: roles.filter((r) => String(r.division).toUpperCase() === division),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-[#1B1B1B]">Komponen Penatalayan</h3>
          <p className="text-[11px] text-[#8C8880]">Jabatan/komponen yang bisa ditugaskan, beserta sub-divisi, jenis ibadah, dan checklist persiapan.</p>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <div className="py-8 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat komponen…
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ division, items }) => (
            <div key={division} className="rounded-2xl border border-[#D9D7D0]/60 bg-white overflow-hidden">
              <div className="px-4 py-2 bg-[#FAF9F5] border-b border-[#D9D7D0]/50 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#8C8880]">{label(division)}</span>
                <span className="text-[10px] font-bold text-[#8C8880]">{items.filter((r) => r.isActive).length} aktif</span>
              </div>
              <div className="divide-y divide-[#D9D7D0]/40">
                {items.length === 0 && (
                  <p className="px-4 py-3 text-xs text-[#8C8880]">Belum ada komponen di divisi ini.</p>
                )}
                {items.map((role) => {
                  const edit = edits[role.id] || editFrom(role);
                  const dirty = edits[role.id] !== undefined;
                  const setEdit = (patch: Partial<Edit>) => setEdits((prev) => ({ ...prev, [role.id]: { ...edit, ...patch } }));
                  const toggleType = (id: string) => setEdit({ serviceTypes: edit.serviceTypes.includes(id) ? edit.serviceTypes.filter((x) => x !== id) : [...edit.serviceTypes, id] });
                  return (
                    <div key={role.id} className={`px-4 py-3 space-y-2 ${role.isActive ? '' : 'opacity-50'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={edit.name}
                          onChange={(e) => setEdit({ name: e.target.value })}
                          className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-[#D9D7D0] text-xs font-semibold"
                        />
                        <input
                          value={edit.subDivision}
                          onChange={(e) => setEdit({ subDivision: e.target.value })}
                          placeholder="Sub-divisi"
                          className="w-40 px-2 py-1.5 rounded-lg border border-[#D9D7D0] text-xs"
                        />
                        <select
                          value={edit.division}
                          onChange={(e) => setEdit({ division: e.target.value })}
                          className="px-2 py-1.5 rounded-lg border border-[#D9D7D0] text-xs"
                        >
                          {divisions.map((d) => <option key={d} value={d}>{label(d)}</option>)}
                        </select>
                        <input
                          type="number"
                          value={edit.sortOrder}
                          onChange={(e) => setEdit({ sortOrder: Number(e.target.value) || 0 })}
                          className="w-16 px-2 py-1.5 rounded-lg border border-[#D9D7D0] text-xs"
                          title="Urutan"
                        />
                        {dirty && (
                          <button
                            type="button"
                            onClick={() => void saveRole(role)}
                            disabled={busy === role.id}
                            className="p-1.5 rounded-lg bg-[#181818] text-white hover:bg-black disabled:opacity-40"
                            title="Simpan"
                          >
                            {busy === role.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void toggleArchive(role)}
                          disabled={busy === role.id}
                          className="p-1.5 rounded-lg hover:bg-[#F3F1EC] text-[#8C8880] disabled:opacity-40"
                          title={role.isActive ? 'Arsipkan' : 'Aktifkan kembali'}
                        >
                          {busy === role.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : role.isActive ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#8C8880]">Jenis ibadah:</span>
                        {TYPES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleType(t.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${edit.serviceTypes.includes(t.id) ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
                          >
                            {t.label}
                          </button>
                        ))}
                        <textarea
                          value={edit.checklist}
                          onChange={(e) => setEdit({ checklist: e.target.value })}
                          rows={2}
                          placeholder="Checklist persiapan (satu per baris)"
                          className="flex-1 min-w-[240px] px-2 py-1 rounded-lg border border-[#D9D7D0] text-[11px]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-dashed border-[#D9D7D0] bg-white p-3 flex flex-wrap items-center gap-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Komponen baru (mis. Operator Slide)"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
            />
            <input
              value={draft.subDivision}
              onChange={(e) => setDraft((d) => ({ ...d, subDivision: e.target.value }))}
              placeholder="Sub-divisi"
              className="w-40 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
            />
            <select
              value={draft.division}
              onChange={(e) => setDraft((d) => ({ ...d, division: e.target.value }))}
              className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs"
            >
              {divisions.map((d) => <option key={d} value={d}>{label(d)}</option>)}
            </select>
            <button
              type="button"
              onClick={() => void addRole()}
              disabled={busy === 'new' || !draft.name.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF416C] text-white text-xs font-bold disabled:opacity-40"
            >
              {busy === 'new' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Tambah
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
