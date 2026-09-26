import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Pengurus = {
  id: string;
  name: string;
  position?: string | null;
  division?: string | null;
  subdivision?: string | null;
  period?: string | null;
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
  role?: string;
  roleOrder?: number;
  isDoubleRole?: boolean;
  isOpenRole?: boolean;
  sortOrder?: number;
  groupId?: string | null;
  [k: string]: unknown;
};

const EDIT_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE'];

const newRow = (order: number): Pengurus => ({
  id: `stk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  position: '',
  subdivision: '',
  period: '',
  phone: '',
  email: '',
  role: 'MENTEE',
  roleOrder: 0,
  isDoubleRole: false,
  isOpenRole: false,
  sortOrder: order,
});

/** Susunan pengurus unit aktif (di-scope server ke tenant host). */
export const UnitPengurusPanel: React.FC = () => {
  const { currentRole, addToast } = useApp();
  const canEdit = EDIT_ROLES.includes(currentRole);
  const [rows, setRows] = useState<Pengurus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/db/struktur', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => {
        if (cancelled) return;
        setRows(Array.isArray(d?.members) ? d.members : []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filled = useMemo(() => rows.filter((r) => (r.name || '').trim() || r.isOpenRole), [rows]);

  const patch = (id: string, key: keyof Pengurus, value: unknown) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setDirty(true);
  };

  const remove = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const add = () => {
    setRows((prev) => [...prev, newRow(prev.length)]);
    setDirty(true);
  };

  const save = async () => {
    const members = filled
      .filter((r) => (r.name || '').trim())
      .map((r, i) => ({ ...r, sortOrder: i, order: i, name: r.name.trim() }));
    setSaving(true);
    try {
      const res = await fetch('/api/db/sync-struktur', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const d = await res.json();
      setDirty(false);
      addToast({ type: 'success', title: 'Pengurus tersimpan', description: `${d.synced} baris disimpan.` });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal menyimpan', description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide">Pengurus Unit</h3>
          <p className="text-[11px] text-[#8C8880]">
            Susunan pengurus unit ini (ketua, sekretaris, bendahara, seksi). Hanya unit ini yang tampil.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F3F1EC] text-[#1B1B1B] text-xs font-bold hover:bg-[#E9E8E4]"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#181818] text-white text-xs font-bold disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880]">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#8C8880]">Belum ada pengurus unit ini.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1.4fr_1.2fr_1fr_auto] gap-2 items-center">
              <input
                value={r.name ?? ''}
                onChange={(e) => patch(r.id, 'name', e.target.value)}
                readOnly={!canEdit}
                placeholder="Nama pengurus"
                className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs read-only:bg-[#FAF9F5]"
              />
              <input
                value={r.position ?? ''}
                onChange={(e) => patch(r.id, 'position', e.target.value)}
                readOnly={!canEdit}
                placeholder="Jabatan (Ketua/Sekretaris/…)"
                className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs read-only:bg-[#FAF9F5]"
              />
              <input
                value={r.phone ?? ''}
                onChange={(e) => patch(r.id, 'phone', e.target.value)}
                readOnly={!canEdit}
                placeholder="Kontak (opsional)"
                className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs read-only:bg-[#FAF9F5]"
              />
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="p-2 rounded-xl text-[#B23A48] hover:bg-[#FDECEE]"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <UserRound className="w-4 h-4 text-[#BDBAB2]" />
              )}
            </div>
          ))}
        </div>
      )}

      {!canEdit && !loading && (
        <p className="text-[10px] text-[#BDBAB2]">Tampilan baca-saja. Penyuntingan oleh pengurus/komsi.</p>
      )}
    </div>
  );
};

export default UnitPengurusPanel;
