import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Check, CalendarClock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Role = { id: string; name: string; division: string; scope?: string; subDivision?: string | null };
type Schedule = { id: string; date: string; status: string; timeStart?: string; eventId?: string | null; role?: { id: string; name: string } | null; user?: { id: string; name: string } | null };
type Person = { id: string; name: string };

const CAN_EDIT = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE'];
const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-sky-50 text-sky-700',
  DONE: 'bg-emerald-50 text-emerald-700',
};

/** Penatalayanan lingkup jemaat (THL) — Stewardship / MDS. */
export const ChurchDutyPanel: React.FC<{ division: 'THL_STEWARDSHIP' | 'THL_MDS' }> = ({ division }) => {
  const { currentRole, addToast } = useApp();
  const canEdit = CAN_EDIT.includes(currentRole);
  const [roles, setRoles] = useState<Role[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleName, setRoleName] = useState('');
  const [form, setForm] = useState({ serviceRoleId: '', userId: '', date: '', timeStart: '', timeEnd: '' });

  const load = async () => {
    setLoading(true);
    try {
      const b = await fetch(`/api/penatalayan/board?scope=CHURCH&division=${division}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { roles: [], schedules: [] }));
      setRoles(Array.isArray(b?.roles) ? b.roles : []);
      setSchedules(Array.isArray(b?.schedules) ? b.schedules : []);
      const p = await fetch('/api/unit/members', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { members: [] }));
      setPeople((Array.isArray(p?.members) ? p.members : []).map((m: Person) => ({ id: m.id, name: m.name })));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [division]);

  const addRole = async () => {
    if (!roleName.trim()) return;
    const res = await fetch('/api/penatalayan/roles', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roleName.trim(), division, scope: 'CHURCH' }),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal menambah peran', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    setRoleName('');
    addToast({ type: 'success', title: 'Peran ditambahkan' });
    load();
  };

  const addSchedule = async () => {
    if (!form.serviceRoleId || !form.userId || !form.date) {
      addToast({ type: 'error', title: 'Pilih peran, petugas & tanggal' });
      return;
    }
    const res = await fetch('/api/penatalayan/schedules', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, scope: 'CHURCH' }),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal menjadwalkan', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    setForm({ serviceRoleId: '', userId: '', date: '', timeStart: '', timeEnd: '' });
    addToast({ type: 'success', title: 'Jadwal dibuat' });
    load();
  };

  const setStatus = async (s: Schedule, status: string) => {
    const res = await fetch(`/api/penatalayan/schedules/${s.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal ubah status', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    load();
  };

  const label = division === 'THL_MDS' ? 'MDS (Multimedia, Dokumentasi, Sound)' : 'Stewardship (Penatalayanan Ibadah)';
  const sorted = useMemo(() => [...schedules].sort((a, b) => String(a.date).localeCompare(String(b.date))), [schedules]);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#FF416C]" />
          <h3 className="text-sm font-black uppercase tracking-wide">THL · {label}</h3>
        </div>

        {loading ? (
          <p className="text-xs text-[#8C8880]">Memuat…</p>
        ) : roles.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada peran THL untuk bagian ini.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span key={r.id} className="px-3 py-1.5 rounded-full bg-[#F3F1EC] text-xs font-bold">
                {r.name}
                {r.subDivision ? <span className="opacity-60"> · {r.subDivision}</span> : null}
              </span>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-[1.6fr_auto] gap-2 items-center pt-2 border-t border-[#EFEDE8]">
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Nama peran baru (mis. Penerima Tamu, Sound Operator)" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            <button type="button" onClick={addRole} className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#F3F1EC] text-[#1B1B1B] text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Tambah peran
            </button>
          </div>
        )}

        {canEdit && roles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1.3fr_1fr_.8fr_.8fr_auto] gap-2 items-center pt-2 border-t border-[#EFEDE8]">
            <select value={form.serviceRoleId} onChange={(e) => setForm((s) => ({ ...s, serviceRoleId: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
              <option value="">Peran…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select value={form.userId} onChange={(e) => setForm((s) => ({ ...s, userId: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
              <option value="">Petugas…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            <input type="time" value={form.timeStart} onChange={(e) => setForm((s) => ({ ...s, timeStart: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            <input type="time" value={form.timeEnd} onChange={(e) => setForm((s) => ({ ...s, timeEnd: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            <button type="button" onClick={addSchedule} className="px-3 py-2 rounded-full bg-[#181818] text-white text-xs font-bold">Jadwalkan</button>
          </div>
        )}
      </div>

      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wide">Jadwal Petugas Jemaat</h4>
        {sorted.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada jadwal.</p>
        ) : (
          sorted.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-[#EFEDE8]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{s.role?.name || '—'} · {s.user?.name || '—'}</p>
                <p className="text-[10px] text-[#8C8880]">
                  {String(s.date).slice(0, 10)}{s.timeStart ? ` · ${s.timeStart}${s.timeEnd ? `–${s.timeEnd}` : ''}` : ''}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
              {s.status === 'SCHEDULED' && (
                <button type="button" onClick={() => setStatus(s, 'CONFIRMED')} className="p-1.5 rounded-lg text-sky-700 hover:bg-sky-50" title="Konfirmasi"><Check className="w-4 h-4" /></button>
              )}
              {s.status === 'CONFIRMED' && (
                <button type="button" onClick={() => setStatus(s, 'DONE')} className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Selesai</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChurchDutyPanel;
