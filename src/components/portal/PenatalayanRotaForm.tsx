import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Info, Loader2, Save, Send, HandHelping } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import type { SearchableOption } from '../../lib/searchable-options';
import type { ServiceRole } from '../../types/penatalayan';

/**
 * Bentuk antrean request minimal yang dipakai form ini.
 * (Duplikat ringan dari ServiceRoleRequest milik sesi paralel agar file ini
 * mandiri — rekonsiliasi saat types/penatalayan.ts mereka masuk main.)
 */
type ServiceRoleRequestLite = {
  serviceRoleId: string;
};

/** ServiceRole + penanda opsional (isRequired menyusul dari sesi paralel). */
type RoleRow = ServiceRole & { isRequired?: boolean };

type Props = {
  division: string;
  serviceType?: string | null;
  eventId?: string | null;
};

const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'];

/** 8 Minggu ke depan (termasuk hari ini bila Minggu), format YYYY-MM-DD. */
function nextSundays(n = 8): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

type Existing = { id: string; roleId: string; userId: string; userName: string; status: string };

/**
 * Form pengisian penatalayan satu tanggal × satu divisi: semua role tampil
 * beserta deskripsi + penanda wajib/opsional, isi nama per role, sekali simpan.
 * Role wajib yang kosong bisa diminta ke divisi (masuk antrean).
 */
export const PenatalayanRotaForm: React.FC<Props> = ({ division, serviceType, eventId }) => {
  const { currentRole } = useApp();
  const canWrite = WRITE_ROLES.includes(String(currentRole || ''));
  const [date, setDate] = useState(nextSundays(1)[0]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [existing, setExisting] = useState<Existing[]>([]);
  const [pending, setPending] = useState<ServiceRoleRequestLite[]>([]);
  const [picks, setPicks] = useState<Record<string, SearchableOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reqBusy, setReqBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sundays = useMemo(() => nextSundays(8), []);

  const load = useCallback(async () => {
    setLoading(true);
    setPicks({});
    try {
      const [rr, ss, qq] = await Promise.all([
        fetch(`/api/penatalayan/roles?division=${encodeURIComponent(division)}`, { credentials: 'include' }),
        fetch(`/api/penatalayan/schedules?from=${date}&to=${date}&division=${encodeURIComponent(division)}`, { credentials: 'include' }),
        fetch(`/api/penatalayan/requests?division=${encodeURIComponent(division)}&status=PENDING&from=${date}&to=${date}`, { credentials: 'include' }),
      ]);
      const dr = await rr.json().catch(() => ({}));
      const ds = await ss.json().catch(() => ({}));
      const dq = await qq.json().catch(() => ({}));
      setRoles(Array.isArray(dr.roles) ? dr.roles : []);
      const schedList: unknown[] = Array.isArray(ds.schedules) ? ds.schedules : [];
      setExisting(schedList.map((s) => {
        const o = s as Record<string, unknown>;
        const sr = o.serviceRole as { id?: string } | undefined;
        const u = o.user as { id?: string; name?: string } | undefined;
        return {
          id: String(o.id),
          roleId: String(sr?.id || (o.serviceRoleId as string) || ''),
          userId: String(u?.id || (o.userId as string) || ''),
          userName: String(u?.name || ''),
          status: String(o.status || ''),
        };
      }));
      setPending(Array.isArray(dq.requests) ? dq.requests : []);
    } catch {
      setRoles([]);
      setExisting([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [division, date]);

  useEffect(() => { void load(); }, [load]);

  const searchPeople = useCallback(async (q: string): Promise<SearchableOption[]> => {
    const r = await fetch(`/api/penatalayan/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d: unknown = await r.json().catch(() => ({}));
    const o = (typeof d === 'object' && d !== null ? d : {}) as { people?: unknown; users?: unknown };
    const list = Array.isArray(o.people) ? o.people : Array.isArray(o.users) ? o.users : [];
    return (list as Array<{ id: string; name: string }>).map((p) => ({ value: String(p.id), label: String(p.name) }));
  }, []);

  const assignedIds = useMemo(() => new Set(existing.map((e) => e.userId)), [existing]);
  const pendingIds = useMemo(() => new Set(pending.map((p) => p.serviceRoleId)), [pending]);
  const existingByRole = useMemo(() => {
    const m = new Map<string, Existing[]>();
    for (const e of existing) {
      if (!m.has(e.roleId)) m.set(e.roleId, []);
      m.get(e.roleId)!.push(e);
    }
    return m;
  }, [existing]);

  const submit = useCallback(async () => {
    const jobs = (Object.entries(picks) as Array<[string, SearchableOption[]]>)
      .map(([roleId, opts]) => ({ roleId, userIds: [...new Set(opts.map((o) => o.value))].filter((id) => !assignedIds.has(id)) }))
      .filter((j) => j.userIds.length > 0);
    if (!jobs.length) {
      setMsg({ ok: false, text: 'Belum ada nama baru yang dipilih.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      for (const j of jobs) {
        const r = await fetch('/api/penatalayan/schedules/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ serviceRoleIds: [j.roleId], userIds: j.userIds, dates: [date], eventId: eventId || undefined }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Gagal menyimpan jadwal.');
      }
      setMsg({ ok: true, text: `${jobs.reduce((n, j) => n + j.userIds.length, 0)} penugasan tersimpan — status Dijadwalkan.` });
      await load();
      window.dispatchEvent(new Event('penatalayan:changed'));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal menyimpan.' });
    } finally {
      setSaving(false);
    }
  }, [picks, assignedIds, date, eventId, load]);

  const sendRequest = useCallback(async (roleId: string) => {
    setReqBusy(roleId);
    try {
      const r = await fetch('/api/penatalayan/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ serviceRoleId: roleId, date, eventId: eventId || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal meminta divisi.');
      await load();
      window.dispatchEvent(new Event('penatalayan:changed'));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal meminta divisi.' });
    } finally {
      setReqBusy(null);
    }
  }, [date, eventId, load]);

  return (
    <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarPlus className="w-4 h-4 text-[#0EA5E9]" />
        <h4 className="text-sm font-black text-[#1B1B1B]">Isi Petugas per Tanggal</h4>
        <select value={date} onChange={(e) => setDate(e.target.value)} className="ml-auto text-xs px-2.5 py-1.5 rounded-xl border border-[#D9D7D0] font-bold">
          {sundays.map((s) => <option key={s} value={s}>{fmtDate(s)}</option>)}
        </select>
      </div>
      {serviceType && <p className="text-[11px] text-[#8C8880]">Jenis ibadah terpilih mengikuti event: {serviceType}</p>}
      {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

      {loading ? (
        <p className="py-6 text-center text-xs text-[#8C8880] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat role…
        </p>
      ) : roles.length === 0 ? (
        <p className="text-xs text-[#8C8880] italic">Belum ada role di divisi ini.</p>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => {
            const done = existingByRole.get(role.id) || [];
            const isPending = pendingIds.has(role.id);
            const optional = role.isRequired === false;
            return (
              <div key={role.id} className="rounded-xl border border-[#EFEDE8] bg-[#FAF9F5] p-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-[#1B1B1B]">{role.name}</p>
                  {optional
                    ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 border border-[#D9D7D0] text-[#8C8880] font-bold">opsional</span>
                    : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold">wajib</span>}
                  {role.subDivision && <span className="text-[10px] text-[#8C8880]">{role.subDivision}</span>}
                </div>
                {role.description && (
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] text-[#8C8880]">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" /> {role.description}
                  </p>
                )}
                {done.length > 0 && (
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Terisi: {done.map((d) => d.userName).join(', ')}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[220px]">
                    <SearchableMultiSelect
                      values={(picks[role.id] || []).map((o) => o.value)}
                      selectedOptions={picks[role.id] || []}
                      onSearch={searchPeople}
                      onChange={(_v, opts) => setPicks((p) => ({ ...p, [role.id]: opts }))}
                      exclude={[...assignedIds]}
                      placeholder={done.length ? 'Tambah orang lagi…' : 'Cari nama…'}
                      disabled={!canWrite}
                    />
                  </div>
                  {done.length === 0 && !optional && (
                    isPending ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700">
                        <HandHelping className="w-3.5 h-3.5" /> Menunggu divisi
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canWrite || reqBusy === role.id}
                        onClick={() => void sendRequest(role.id)}
                        title="Minta divisi menyiapkan orang untuk role ini"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold disabled:opacity-50"
                      >
                        {reqBusy === role.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Minta divisi
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            disabled={!canWrite || saving}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan jadwal {fmtDate(date)}
          </button>
          <p className="text-[10px] text-[#8C8880]">Yang tersimpan otomatis berstatus Dijadwalkan. Role opsional boleh dikosongkan.</p>
        </div>
      )}
    </div>
  );
};

export default PenatalayanRotaForm;
