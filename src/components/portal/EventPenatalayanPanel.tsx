import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users, Plus, X, Check, Clock, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import type { ServiceRole } from '../../types/penatalayan';
import { PenatalayanRolesEditor } from './PenatalayanRolesEditor';

type Props = {
  eventId: string;
  canEdit: boolean;
};

type PenEvent = {
  id: string;
  name: string;
  eventDate?: string | null;
  kind?: string | null;
  serviceType?: string | null;
  status?: string | null;
};

type Assignment = {
  id: string;
  serviceRoleId: string;
  userId: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'DONE' | 'CANCELLED';
  timeStart?: string | null;
  timeEnd?: string | null;
  notes?: string | null;
  serviceRole?: ServiceRole;
  user?: { id: string; name: string; email?: string };
};

type Previous = { eventId: string; name: string; eventDate?: string | null } | null;

const DIVISIONS = ['LITURGIA', 'MARTURIA'];
const DIVISION_LABEL: Record<string, string> = { LITURGIA: 'Liturgia', MARTURIA: 'Marturia' };

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: 'bg-blue-500',
  CONFIRMED: 'bg-green-500',
  DONE: 'bg-gray-400',
  CANCELLED: 'bg-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Dijadwalkan',
  CONFIRMED: 'Dikonfirmasi',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

function nextStatus(status: string): Assignment['status'] {
  if (status === 'SCHEDULED') return 'CONFIRMED';
  if (status === 'CONFIRMED') return 'DONE';
  return 'SCHEDULED';
}

/**
 * Penatalayan per-event: daftar komponen Liturgia/Marturia + personel yang
 * ditugaskan (boleh lebih dari satu orang per komponen).
 */
export const EventPenatalayanPanel: React.FC<Props> = ({ eventId, canEdit }) => {
  const [event, setEvent] = useState<PenEvent | null>(null);
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [previous, setPrevious] = useState<Previous>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRoles, setShowRoles] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, ur] = await Promise.all([
        fetch(`/api/events/${eventId}/penatalayan`, { credentials: 'include' }),
        fetch('/api/db/users?limit=200', { credentials: 'include' }).catch(() => null),
      ]);
      if (!pr.ok) {
        const d = await pr.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal memuat penatalayan.');
      }
      const d = await pr.json();
      setEvent(d.event || null);
      setRoles(d.roles || []);
      setAssignments(d.assignments || []);
      setPrevious(d.previous || null);
      if (ur?.ok) {
        const ud = await ur.json().catch(() => ({}));
        setUsers((ud.users || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat penatalayan.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const dateStr = useMemo(() => {
    if (!event?.eventDate) return null;
    const t = new Date(event.eventDate);
    return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
  }, [event?.eventDate]);

  const byRole = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) (map[a.serviceRoleId] ||= []).push(a);
    return map;
  }, [assignments]);

  const addPerson = async (roleId: string, userId: string) => {
    if (!userId || !dateStr) return;
    setBusy(`add-${roleId}`);
    try {
      const r = await fetch('/api/penatalayan/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ serviceRoleId: roleId, userId, eventId, date: dateStr }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menugaskan.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menugaskan.');
    } finally {
      setBusy(null);
    }
  };

  const removeAssignment = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`/api/penatalayan/schedules/${id}`, { method: 'DELETE', credentials: 'include' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const cycleStatus = async (a: Assignment) => {
    setBusy(a.id);
    try {
      await fetch(`/api/penatalayan/schedules/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus(a.status) }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const copyPrevious = async () => {
    setBusy('copy');
    try {
      const r = await fetch(`/api/events/${eventId}/penatalayan/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Tidak ada jadwal untuk disalin.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyalin jadwal.');
    } finally {
      setBusy(null);
    }
  };

  const totalAssigned = assignments.filter((a) => a.status !== 'CANCELLED').length;

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#1B1B1B] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#FF416C]" /> Penatalayan & Liturgi
          </h3>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            Susun komponen ibadah (Liturgia) dan multimedia (Marturia) untuk event ini.
            {dateStr ? ` Tanggal: ${new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}
          </p>
          <p className="text-[11px] text-[#8C8880] mt-0.5">{totalAssigned} penugasan aktif.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && previous && (
            <button
              type="button"
              onClick={() => void copyPrevious()}
              disabled={busy === 'copy'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold text-[#5C5850] hover:border-[#1B1B1B] disabled:opacity-40"
              title={`Salin dari ${previous.name}`}
            >
              {busy === 'copy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Salin dari event sebelumnya
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowRoles((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] font-bold text-[#5C5850]"
            >
              {showRoles ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Kelola komponen
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {canEdit && showRoles && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-[#FAF9F5] p-4">
          <PenatalayanRolesEditor divisions={DIVISIONS} divisionLabel={(d) => DIVISION_LABEL[d] || d} onChanged={() => void load()} />
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat penatalayan…
        </div>
      ) : (
        <div className="space-y-4">
          {DIVISIONS.map((division) => {
            const divisionRoles = roles.filter((r) => String(r.division).toUpperCase() === division);
            const collapsedKey = division;
            const isCollapsed = collapsed[collapsedKey];
            return (
              <div key={division} className="rounded-2xl border border-[#D9D7D0]/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [collapsedKey]: !c[collapsedKey] }))}
                  className="w-full px-4 py-2 bg-[#FAF9F5] border-b border-[#D9D7D0]/50 flex items-center justify-between"
                >
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#8C8880]">
                    {DIVISION_LABEL[division] || division}
                  </span>
                  <span className="flex items-center gap-2 text-[10px] font-bold text-[#8C8880]">
                    {divisionRoles.length} komponen
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-[#D9D7D0]/40">
                    {divisionRoles.length === 0 && (
                      <p className="px-4 py-3 text-xs text-[#8C8880]">
                        Belum ada komponen. {canEdit ? 'Tambahkan lewat "Kelola komponen".' : ''}
                      </p>
                    )}
                    {divisionRoles.map((role) => {
                      const people = byRole[role.id] || [];
                      const assignedIds = new Set(people.map((p) => p.userId));
                      const available = users.filter((u) => !assignedIds.has(u.id));
                      return (
                        <div key={role.id} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[#1B1B1B]">{role.name}</p>
                            <span className="text-[10px] font-bold text-[#8C8880]">{people.length} orang</span>
                          </div>

                          {people.length === 0 ? (
                            <p className="text-[11px] text-[#8C8880]">Belum ada personel.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {people.map((a) => (
                                <span key={a.id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] font-semibold text-[#1B1B1B]">
                                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status] || 'bg-gray-400'}`} title={STATUS_LABEL[a.status]} />
                                  {a.user?.name || '—'}
                                  {canEdit && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void cycleStatus(a)}
                                        disabled={busy === a.id}
                                        className="p-0.5 rounded hover:bg-white"
                                        title={`Ubah status (${STATUS_LABEL[a.status]})`}
                                      >
                                        <Clock className="w-3 h-3 text-[#8C8880]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void removeAssignment(a.id)}
                                        disabled={busy === a.id}
                                        className="p-0.5 rounded hover:bg-white"
                                        title="Hapus penugasan"
                                      >
                                        <X className="w-3 h-3 text-red-500" />
                                      </button>
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {canEdit && dateStr && (
                            <div className="flex items-center gap-2">
                              <select
                                value=""
                                onChange={(e) => { const v = e.target.value; if (v) void addPerson(role.id, v); }}
                                disabled={busy === `add-${role.id}` || available.length === 0}
                                className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs bg-white"
                              >
                                <option value="">{available.length ? '+ Tambah orang…' : 'Semua personel sudah ditugaskan'}</option>
                                {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                              {busy === `add-${role.id}` && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C8880]" />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!dateStr && !loading && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Event ini belum punya tanggal. Isi tanggal event dulu agar penugasan bisa disimpan.
        </p>
      )}
    </div>
  );
};
