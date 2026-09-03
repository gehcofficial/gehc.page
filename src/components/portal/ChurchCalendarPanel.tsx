import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Scope = 'BPMJ' | 'KOMISI' | 'KOLOM';

type ChurchProgram = {
  id: string;
  scope: Scope;
  parentId?: string | null;
  kolomId?: string | null;
  season?: string | null;
  name: string;
  description?: string | null;
  year?: number | null;
  events: Array<{ id: string; name: string; slug: string; status: string; kind: string }>;
};

const SCOPE_LABEL: Record<Scope, string> = {
  BPMJ: 'BPMJ (jemaat)',
  KOMISI: 'Komisi (pemuda)',
  KOLOM: 'Kolom (teritorial)',
};

function scopesForRole(role?: string | null): Scope[] {
  if (role === 'SUPERADMIN') return ['BPMJ', 'KOMISI', 'KOLOM'];
  if (role === 'BPMJ') return ['BPMJ'];
  if (role === 'KOMISI') return ['KOMISI', 'KOLOM'];
  return [];
}

export const ChurchCalendarPanel: React.FC = () => {
  const { addToast, currentRole } = useApp();
  const allowedScopes = useMemo(() => scopesForRole(currentRole), [currentRole]);
  const [programs, setPrograms] = useState<ChurchProgram[]>([]);
  const [kolom, setKolom] = useState<Array<{ id: string; number: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    scope: (scopesForRole(currentRole)[0] || 'KOMISI') as Scope,
    parentId: '',
    kolomId: '',
    season: 'REGULAR',
    name: '',
    year: String(new Date().getFullYear()),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: '', season: 'REGULAR', year: '', description: '' });

  const canCreate = allowedScopes.length > 0;
  const canMutateScope = (scope: Scope) => allowedScopes.includes(scope);

  const load = useCallback(async () => {
    const [pRes, kRes] = await Promise.all([
      fetch('/api/church-programs', { credentials: 'include' }),
      fetch('/api/kolom', { credentials: 'include' }),
    ]);
    const p = await pRes.json();
    const k = kRes.ok ? await kRes.json() : {};
    if (!pRes.ok) throw new Error(p.error || 'Gagal memuat payung');
    setPrograms(p.programs || []);
    setKolom(k.kolom || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => addToast({ type: 'error', title: e.message })).finally(() => setLoading(false));
  }, [load, addToast]);

  useEffect(() => {
    setForm((f) => {
      if (allowedScopes.includes(f.scope) || allowedScopes.length === 0) return f;
      return { ...f, scope: allowedScopes[0], parentId: '', kolomId: '' };
    });
  }, [allowedScopes]);

  // Payung Komisi maupun Kolom sama-sama bernaung di bawah payung BPMJ.
  const parents = useMemo(() => programs.filter((p) => p.scope === 'BPMJ'), [programs]);

  const kolomLabel = useCallback(
    (id?: string | null) => {
      if (!id) return null;
      const k = kolom.find((x) => x.id === id);
      return k ? `Kolom ${k.number} · ${k.name}` : 'Kolom (tidak dikenal)';
    },
    [kolom],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/church-programs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: form.scope,
          name: form.name.trim(),
          parentId: form.parentId || null,
          kolomId: form.scope === 'KOLOM' ? form.kolomId || null : null,
          season: form.season,
          year: Number(form.year),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan');
      setForm((f) => ({ ...f, name: '' }));
      await load();
      addToast({ type: 'success', title: 'Payung disimpan' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setSaving(false);
    }
  };

  const byScope = (s: Scope) => programs.filter((p) => p.scope === s);

  const saveEdit = async (id: string) => {
    if (!edit.name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/church-programs/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: edit.name.trim(),
          season: edit.season || null,
          year: edit.year ? Number(edit.year) : null,
          description: edit.description.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan');
      setEditingId(null);
      await load();
      addToast({ type: 'success', title: 'Payung diperbarui' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: ChurchProgram) => {
    if (!window.confirm(`Hapus payung "${p.name}"?`)) return;
    try {
      const r = await fetch(`/api/church-programs/${p.id}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menghapus');
      await load();
      addToast({ type: 'success', title: 'Payung dihapus' });
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    }
  };

  const startEdit = (p: ChurchProgram) => {
    setEditingId(p.id);
    setEdit({
      name: p.name,
      season: p.season || 'REGULAR',
      year: p.year ? String(p.year) : '',
      description: p.description || '',
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-black text-[#1B1B1B]">Payung gerejawi</h3>
        <p className="text-xs text-[#8C8880] mt-0.5">
          BPMJ (Natal Jemaat) → Komisi (Natal Pemuda) / Kolom, lalu Tim Kerja menamai event operasional di tab Event.
        </p>
      </div>

      {canCreate && (
        <form onSubmit={submit} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <select
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as Scope, parentId: '' }))}
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
            >
              {allowedScopes.map((s) => (
                <option key={s} value={s}>{SCOPE_LABEL[s]}</option>
              ))}
            </select>
            <select
              value={form.season}
              onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
            >
              {['REGULAR', 'NATAL', 'PASKAH', 'HUT'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {form.scope !== 'BPMJ' && (
            <select
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
            >
              <option value="">Induk BPMJ (opsional)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {form.scope === 'KOLOM' && (
            <select
              value={form.kolomId}
              onChange={(e) => setForm((f) => ({ ...f, kolomId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
            >
              <option value="">Pilih kolom…</option>
              {kolom.map((k) => (
                <option key={k.id} value={k.id}>Kolom {k.number} · {k.name}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Natal Pemuda 2026"
              className="flex-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
            />
            <input
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              className="w-24 px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
            />
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Buat
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-xs text-[#8C8880]">Memuat…</p>}

      {(['BPMJ', 'KOMISI', 'KOLOM'] as Scope[]).map((scope) => (
        <div key={scope}>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-2">{SCOPE_LABEL[scope]}</h4>
          <ul className="space-y-2">
            {byScope(scope).map((p) => (
              <li key={p.id} className="rounded-2xl border border-[#D9D7D0] bg-white px-4 py-3">
                {editingId === p.id ? (
                  <div className="space-y-2">
                    <input
                      value={edit.name}
                      onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                    />
                    <div className="grid sm:grid-cols-2 gap-2">
                      <select
                        value={edit.season}
                        onChange={(e) => setEdit((f) => ({ ...f, season: e.target.value }))}
                        className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-[#FAF9F5]"
                      >
                        {['REGULAR', 'NATAL', 'PASKAH', 'HUT'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <input
                        value={edit.year}
                        onChange={(e) => setEdit((f) => ({ ...f, year: e.target.value }))}
                        placeholder="Tahun"
                        className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
                      />
                    </div>
                    <textarea
                      value={edit.description}
                      onChange={(e) => setEdit((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Catatan payung (opsional)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(p.id)}
                        disabled={saving || !edit.name.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#5C5850]"
                      >
                        <X className="w-3.5 h-3.5" /> Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1B1B1B]">{p.name}</p>
                        <p className="text-[10px] text-[#8C8880]">
                          {p.season || 'REGULAR'} · {p.year || '—'}
                          {kolomLabel(p.kolomId) ? ` · ${kolomLabel(p.kolomId)}` : ''}
                        </p>
                      </div>
                      {canMutateScope(scope) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            title="Ubah"
                            className="p-1.5 rounded-lg border border-[#D9D7D0] text-[#5C5850]"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(p)}
                            title="Hapus"
                            className="p-1.5 rounded-lg border border-[#D9D7D0] text-[#8C8880] hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-[#5C5850] mt-1 whitespace-pre-line">{p.description}</p>
                    )}
                    {p.events.length > 0 && (
                      <p className="text-xs text-[#5C5850] mt-1">
                        Event: {p.events.map((e) => e.name).join(', ')}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
            {byScope(scope).length === 0 && (
              <li className="text-xs text-[#8C8880]">Belum ada.</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
};
