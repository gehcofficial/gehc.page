import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Info, Loader2, Send } from 'lucide-react';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import type { SearchableOption } from '../../lib/searchable-options';
import type { ServiceRole } from '../../types/penatalayan';
import { parseHashSearch } from '../../lib/portal-routes';

const ALL_DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'] as const;

const DIVISION_LABEL: Record<string, string> = {
  LITURGIA: 'Liturgia',
  DIDASKALIA: 'Didaskalia',
  KOINONIA: 'Koinonia',
  DIAKONIA: 'Diakonia',
  MARTURIA: 'Marturia',
};

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

type RoleRow = ServiceRole & { isRequired?: boolean };
type Existing = { roleId: string; userId: string; userName: string };
type DayEvent = { id: string; name?: string | null; eventDate?: string | null };
type PendingMine = {
  id: string;
  serviceRoleId: string;
  roleName?: string | null;
  roleDivision?: string | null;
  proposedUserId?: string | null;
  proposedUserName?: string | null;
  status: string;
};

/** Tanggal & event awal dari deep-link routing (#/portal/<ns>/penatalayan-usulan?date=&event=). */
function initialHashTarget(): { date: string | null; eventId: string | null } {
  try {
    const q = parseHashSearch();
    const d = String(q.get('date') || '').slice(0, 10);
    const e = String(q.get('event') || '').trim();
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
      eventId: /^[A-Za-z0-9_-]{1,64}$/.test(e) ? e : null,
    };
  } catch {
    return { date: null, eventId: null };
  }
}

/**
 * Panel usulan Mentor/Co-mentor: semua divisi terbuka (read), multi-role x
 * multi-people dalam 1 tanggal, kirim sebagai antrean PENDING.
 * Approve tetap di tiap divisi (PenatalayanRequestQueue).
 */
export const MentorPenatalayanUsulanPanel: React.FC = () => {
  const hashTarget = useMemo(() => initialHashTarget(), []);
  const [date, setDate] = useState(hashTarget.date || nextSundays(1)[0]);
  const [linkedEventId, setLinkedEventId] = useState<string | null>(hashTarget.eventId);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [divisions, setDivisions] = useState<string[]>([...ALL_DIVISIONS]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [existing, setExisting] = useState<Existing[]>([]);
  const [pendingMine, setPendingMine] = useState<PendingMine[]>([]);
  const [picks, setPicks] = useState<Record<string, SearchableOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sundays = useMemo(() => nextSundays(8), []);
  const divParam = useMemo(() => divisions.join(','), [divisions]);

  const load = useCallback(async () => {
    setLoading(true);
    setPicks({});
    try {
      const divQ = divisions.length ? `?division=${encodeURIComponent(divisions.join(','))}` : '';
      const [rr, ss, qq] = await Promise.all([
        fetch(`/api/penatalayan/roles${divQ}`, { credentials: 'include' }),
        fetch(`/api/penatalayan/schedules?from=${date}&to=${date}${divisions.length ? `&division=${encodeURIComponent(divisions.join(','))}` : ''}`, { credentials: 'include' }),
        fetch(`/api/penatalayan/requests?mine=1&status=ALL&from=${date}&to=${date}`, { credentials: 'include' }),
      ]);
      const dr = await rr.json().catch(() => ({}));
      const ds = await ss.json().catch(() => ({}));
      const dq = await qq.json().catch(() => ({}));
      setRoles(Array.isArray(dr.roles) ? dr.roles : []);
      const schedList: unknown[] = Array.isArray(ds.schedules) ? ds.schedules : [];
      setExisting(schedList.flatMap((s) => {
        const o = s as Record<string, unknown>;
        if (String(o.status || '').toUpperCase() === 'CANCELLED') return [];
        const sr = o.serviceRole as { id?: string } | undefined;
        const u = o.user as { id?: string; name?: string } | undefined;
        const roleId = String(sr?.id || (o.serviceRoleId as string) || '');
        const userId = String(u?.id || (o.userId as string) || '');
        if (!roleId || !userId) return [];
        return [{ roleId, userId, userName: String(u?.name || '') }];
      }));
      setPendingMine(Array.isArray(dq.requests) ? dq.requests : []);
      setDayEvents(Array.isArray(ds.events) ? (ds.events as DayEvent[]) : []);
    } catch {
      setRoles([]);
      setExisting([]);
      setPendingMine([]);
      setDayEvents([]);
    } finally {
      setLoading(false);
    }
  }, [date, divisions]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const reload = () => void load();
    window.addEventListener('penatalayan:changed', reload);
    return () => window.removeEventListener('penatalayan:changed', reload);
  }, [load]);

  const searchPeople = useCallback(async (q: string): Promise<SearchableOption[]> => {
    const r = await fetch(`/api/penatalayan/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d: unknown = await r.json().catch(() => ({}));
    const o = (typeof d === 'object' && d !== null ? d : {}) as { people?: unknown; users?: unknown };
    const list = Array.isArray(o.people) ? o.people : Array.isArray(o.users) ? o.users : [];
    return (list as Array<{ id: string; name: string }>).map((p) => ({ value: String(p.id), label: String(p.name) }));
  }, []);

  const assignedIds = useMemo(() => new Set(existing.map((e) => `${e.roleId}|${e.userId}`)), [existing]);
  const pendingMineKeys = useMemo(
    () => new Set(pendingMine.filter((p) => p.status === 'PENDING' && p.proposedUserId).map((p) => `${p.serviceRoleId}|${p.proposedUserId}`)),
    [pendingMine],
  );
  const existingByRole = useMemo(() => {
    const m = new Map<string, Existing[]>();
    for (const e of existing) {
      if (!m.has(e.roleId)) m.set(e.roleId, []);
      m.get(e.roleId)!.push(e);
    }
    return m;
  }, [existing]);
  const pendingByRole = useMemo(() => {
    const m = new Map<string, PendingMine[]>();
    for (const p of pendingMine.filter((x) => x.status === 'PENDING')) {
      if (!m.has(p.serviceRoleId)) m.set(p.serviceRoleId, []);
      m.get(p.serviceRoleId)!.push(p);
    }
    return m;
  }, [pendingMine]);

  const rolesByDivision = useMemo(() => {
    const m = new Map<string, RoleRow[]>();
    for (const r of roles) {
      const d = String(r.division || '').toUpperCase();
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }
    return [...m.entries()].sort(([a], [b]) => ALL_DIVISIONS.indexOf(a as never) - ALL_DIVISIONS.indexOf(b as never));
  }, [roles]);

  const totalPicked = useMemo(
    () => Object.values(picks).reduce((n: number, opts: SearchableOption[]) => n + opts.length, 0),
    [picks],
  );

  const activeEvent = useMemo(() => {
    if (linkedEventId) {
      const linked = dayEvents.find((e) => e.id === linkedEventId);
      if (linked) return linked;
    }
    return dayEvents.find((e) => String(e.eventDate || '').slice(0, 10) === date) || null;
  }, [linkedEventId, dayEvents, date]);

  const dateOptions = useMemo(() => (sundays.includes(date) ? sundays : [date, ...sundays]), [sundays, date]);

  const pickDate = useCallback((val: string) => {
    setDate(val);
    setLinkedEventId(null);
  }, []);

  const toggleDivision = (d: string) =>
    setDivisions((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = useCallback(async () => {
    const items = (Object.entries(picks) as Array<[string, SearchableOption[]]>)
      .flatMap(([serviceRoleId, opts]) => opts.map((o) => ({ serviceRoleId, userId: o.value })))
      .filter((it) => !assignedIds.has(`${it.serviceRoleId}|${it.userId}`) && !pendingMineKeys.has(`${it.serviceRoleId}|${it.userId}`));
    if (!items.length) {
      setMsg({ ok: false, text: 'Belum ada nama baru yang dipilih (atau semua sudah terisi/menunggu).' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/penatalayan/proposals/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date, items, ...(activeEvent ? { eventId: activeEvent.id } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengirim usulan.');
      const skipped = Array.isArray(d.skipped) ? d.skipped.length : 0;
      setMsg({
        ok: true,
        text: `${d.created?.length || 0} usulan terkirim ke divisi — menunggu approve.${skipped ? ` ${skipped} dilewati (sudah terisi/menunggu).` : ''}`,
      });
      await load();
      window.dispatchEvent(new Event('penatalayan:changed'));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal mengirim usulan.' });
    } finally {
      setSaving(false);
    }
  }, [picks, assignedIds, pendingMineKeys, date, activeEvent, load]);

  const cancelMine = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/penatalayan/requests/${id}/cancel`, { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal membatalkan.');
      await load();
      window.dispatchEvent(new Event('penatalayan:changed'));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal membatalkan.' });
    }
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-[#0EA5E9]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Usulan Pelayanan — semua divisi terbuka</h3>
          <select value={date} onChange={(e) => pickDate(e.target.value)} className="ml-auto text-xs px-2.5 py-1.5 rounded-xl border border-[#D9D7D0] font-bold">
            {dateOptions.map((s) => (
              <option key={s} value={s}>
                {fmtDate(s)}{activeEvent && s === date ? ` — ${activeEvent.name}` : ''}
              </option>
            ))}
          </select>
        </div>
        {activeEvent && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-800">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="font-bold">Mengisi untuk:</span>
            <span>{activeEvent.name}</span>
            <span className="text-sky-600">· {fmtDate(String(activeEvent.eventDate || date).slice(0, 10))}</span>
            {linkedEventId && <span className="text-sky-600">(routing dari divisi)</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {ALL_DIVISIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDivision(d)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${divisions.includes(d) ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
            >
              {DIVISION_LABEL[d]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#8C8880]">
          Pilih nama dari kelompok binaanmu (list otomatis tersaring). Sekali kirim bisa multi-role x multi-people ({divParam || 'semua divisi'}). Yang terkirim berstatus <strong>Menunggu divisi</strong> — jadwal baru terbit setelah divisi approve.
        </p>
        {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

        {loading ? (
          <p className="py-6 text-center text-xs text-[#8C8880] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat role…
          </p>
        ) : rolesByDivision.length === 0 ? (
          <p className="text-xs text-[#8C8880] italic">Pilih minimal 1 divisi.</p>
        ) : (
          <div className="space-y-4">
            {rolesByDivision.map(([div, list]) => (
              <div key={div}>
                <p className="text-[11px] font-black uppercase tracking-wider text-[#8C8880] mb-1.5">{DIVISION_LABEL[div] || div} ({list.length})</p>
                <div className="space-y-2">
                  {list.map((role) => {
                    const done = existingByRole.get(role.id) || [];
                    const pend = pendingByRole.get(role.id) || [];
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
                          <p className="mt-1 text-[11px] text-emerald-700">Terisi: {done.map((d) => d.userName).join(', ')}</p>
                        )}
                        {pend.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-sky-700">Menunggu divisi: {pend.map((p) => p.proposedUserName || '—').join(', ')}</p>
                        )}
                        <div className="mt-1.5">
                          <SearchableMultiSelect
                            values={(picks[role.id] || []).map((o) => o.value)}
                            selectedOptions={picks[role.id] || []}
                            onSearch={searchPeople}
                            onChange={(_v, opts) => setPicks((p) => ({ ...p, [role.id]: opts }))}
                            exclude={[
                              ...done.map((d) => d.userId),
                              ...pend.filter((p) => p.proposedUserId).map((p) => String(p.proposedUserId)),
                            ]}
                            placeholder={done.length ? 'Tambah usulan…' : 'Cari nama binaan…'}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={saving || totalPicked === 0}
              onClick={() => void submit()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Kirim {totalPicked} usulan ({fmtDate(date)})
            </button>
            <p className="text-[10px] text-[#8C8880]">Usulan masuk antrean tiap divisi. Batalkan usulanmu yang masih menunggu di bawah bila salah pilih.</p>
          </div>
        )}
      </div>

      {pendingMine.length > 0 && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2">
          <h4 className="text-sm font-black text-[#1B1B1B]">Usulanku ({pendingMine.length})</h4>
          {pendingMine.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/60 text-xs">
              <span className="font-bold">{p.roleName} · {p.roleDivision}</span>
              <span className="text-[#8C8880]">→ {p.proposedUserName || '—'}</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border ${p.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border-amber-200' : p.status === 'FULFILLED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{p.status}</span>
              {p.status === 'PENDING' && (
                <button type="button" onClick={() => void cancelMine(p.id)} className="text-[11px] font-bold text-[#8C8880] hover:underline">Batalkan</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentorPenatalayanUsulanPanel;
