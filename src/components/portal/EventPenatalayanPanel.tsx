import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users, Plus, X, Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import type { ServiceRole } from '../../types/penatalayan';
import { buildResponsibleGroupCaption, displayServiceRoleName } from '../../lib/serving-roles';
import { penatalayanBodLinkUrl } from '../../lib/penatalayan-bod-link-ui';
import { PenatalayanRolesEditor } from './PenatalayanRolesEditor';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import type { SearchableOption } from '../../lib/searchable-options';

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
  metadata?: Record<string, unknown> | null;
};

type GroupPick = { id: string; name: string };

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

const DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'];
const DIVISION_LABEL: Record<string, string> = {
  LITURGIA: 'Liturgia', DIDASKALIA: 'Didaskalia', KOINONIA: 'Koinonia', DIAKONIA: 'Diakonia', MARTURIA: 'Marturia',
};

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

/** Transisi yang diizinkan (mirror server). DONE = final. */
const NEXT: Record<string, string[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DONE', 'SCHEDULED', 'CANCELLED'],
  CANCELLED: ['SCHEDULED'],
  DONE: [],
};

/**
 * Penatalayan per-event: daftar komponen Liturgia/Marturia + personel yang
 * ditugaskan (boleh lebih dari satu orang per komponen).
 */
export const EventPenatalayanPanel: React.FC<Props> = ({ eventId, canEdit }) => {
  const [event, setEvent] = useState<PenEvent | null>(null);
  const [roles, setRoles] = useState<ServiceRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [previous, setPrevious] = useState<Previous>(null);
  const [loading, setLoading] = useState(true);
  const [addPicked, setAddPicked] = useState<Record<string, string[]>>({});
  const [addOptions, setAddOptions] = useState<Record<string, SearchableOption[]>>({});
  const [addNote, setAddNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRoles, setShowRoles] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [groups, setGroups] = useState<GroupPick[]>([]);
  const [respId, setRespId] = useState('');
  const [hostId, setHostId] = useState('');
  const [groupBusy, setGroupBusy] = useState<'save' | 'route' | null>(null);
  const [groupMsg, setGroupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [worshipPatternCode, setWorshipPatternCode] = useState('CREATIVE_LAB');
  const [bodLinkUrl, setBodLinkUrl] = useState<string | null>(null);
  const [bodCaption, setBodCaption] = useState<string | null>(null);
  const [bodBusy, setBodBusy] = useState(false);
  const [bodMsg, setBodMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pr = await fetch(`/api/events/${eventId}/penatalayan`, { credentials: 'include' });
      if (!pr.ok) {
        const d = await pr.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal memuat penatalayan.');
      }
      const d = await pr.json();
      setEvent(d.event || null);
      setRoles(d.roles || []);
      setAssignments(d.assignments || []);
      setPrevious(d.previous || null);
      setWorshipPatternCode(String(d.worshipPatternCode || 'CREATIVE_LAB').toUpperCase());
      const pg = (d.event?.metadata && typeof d.event.metadata === 'object'
        ? (d.event.metadata as Record<string, unknown>).penatalayanGroups
        : null) as { responsibleGroupId?: string; hostGroupId?: string } | null;
      setRespId(pg?.responsibleGroupId ? String(pg.responsibleGroupId) : '');
      setHostId(pg?.hostGroupId ? String(pg.hostGroupId) : '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat penatalayan.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  /** Cari personel langsung dari input (pola Portal Doa); hasil urut alfabetis. */
  const searchPeople = useCallback(async (query: string): Promise<SearchableOption[]> => {
    const r = await fetch(`/api/penatalayan/people?q=${encodeURIComponent(query)}`, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    return (d.people || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }));
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canEdit) return;
    let alive = true;
    fetch('/api/groups', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d) => { if (alive) setGroups(Array.isArray(d.groups) ? d.groups.map((g: { id: string; name: string }) => ({ id: String(g.id), name: String(g.name) })) : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [canEdit]);

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

  const addPeople = async (roleId: string, userIds: string[]) => {
    if (!userIds.length || !dateStr) return;
    setBusy(`add-${roleId}`);
    try {
      const r = await fetch('/api/penatalayan/schedules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ serviceRoleIds: [roleId], userIds, dates: [dateStr], eventId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Gagal menugaskan.');
      }
      setAddPicked((m) => ({ ...m, [roleId]: [] }));
      setAddOptions((m) => ({ ...m, [roleId]: [] }));
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

  const setStatus = async (a: Assignment, status: string) => {
    setBusy(a.id);
    try {
      const r = await fetch('/api/penatalayan/schedules/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: [a.id], status }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengubah status.');
      if (d.skipped?.length) throw new Error(d.skipped[0].reason || 'Status tidak dapat diubah.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status.');
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

  const routingAt = useMemo(() => {
    const v = event?.metadata && typeof event.metadata === 'object'
      ? (event.metadata as Record<string, unknown>).penatalayanRoutingAt
      : null;
    return v ? String(v) : null;
  }, [event?.metadata]);

  const saveGroups = async () => {
    setGroupBusy('save');
    setGroupMsg(null);
    try {
      const both = respId && hostId;
      const r = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          penatalayanGroups: both ? { responsibleGroupId: respId, hostGroupId: hostId } : null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan grup.');
      setGroupMsg({ ok: true, text: both ? 'Grup tersimpan.' : 'Grup dikosongkan.' });
      await load();
    } catch (e) {
      setGroupMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal menyimpan grup.' });
    } finally {
      setGroupBusy(null);
    }
  };

  const sendRouting = async () => {
    if (!respId || !hostId) {
      setGroupMsg({ ok: false, text: 'Simpan grup Tuan Rumah & Penanggungjawab dulu.' });
      return;
    }
    if (!window.confirm('Kirim routing ke mentor & co-mentor kedua grup? Mereka akan menerima notifikasi + tautan pengisian usulan.')) return;
    setGroupBusy('route');
    setGroupMsg(null);
    try {
      const r = await fetch(`/api/events/${eventId}/penatalayan-routing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal mengirim routing.');
      const sent = Array.isArray(d.sent) ? d.sent.reduce((n: number, s: { count?: number }) => n + (s.count || 0), 0) : 0;
      setGroupMsg({
        ok: true,
        text: d.warning ? String(d.warning) : `Routing terkirim ke ${sent || d.recipients || 0} mentor/co-mentor.`,
      });
      await load();
    } catch (e) {
      setGroupMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal mengirim routing.' });
    } finally {
      setGroupBusy(null);
    }
  };

  const createBodLink = async () => {
    setBodBusy(true);
    setBodMsg(null);
    try {
      const r = await fetch('/api/penatalayan/bod-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId,
          patternCode: worshipPatternCode,
          hostGroupId: hostId || undefined,
          responsibleGroupId: respId || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal membuat tautan.');
      const token = String(d.link?.token || '');
      const url = d.url ? String(d.url) : penatalayanBodLinkUrl(token);
      setBodLinkUrl(url);
      if (token) {
        const cr = await fetch(`/api/penatalayan/bod-links/token/${encodeURIComponent(token)}/caption`, { credentials: 'include' });
        const cd = await cr.json().catch(() => ({}));
        if (cr.ok && cd.caption) setBodCaption(String(cd.caption));
      }
      setBodMsg({
        ok: true,
        text: d.reused ? 'Tautan yang sudah ada ditampilkan.' : `Tautan dibuat (pola ${worshipPatternCode}).`,
      });
    } catch (e) {
      setBodMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal membuat tautan.' });
    } finally {
      setBodBusy(false);
    }
  };

  const copyBodLink = async () => {
    if (!bodLinkUrl) return;
    await navigator.clipboard?.writeText(bodLinkUrl);
    setBodMsg({ ok: true, text: 'Tautan disalin.' });
  };

  const copyBodCaption = async () => {
    if (!bodCaption) return;
    await navigator.clipboard?.writeText(bodCaption);
    setBodMsg({ ok: true, text: 'Caption WA disalin.' });
  };

  const totalAssigned = assignments.filter((a) => a.status !== 'CANCELLED').length;

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#1B1B1B] flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" /> Penatalayan & Liturgi
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

      {canEdit && (
        <div className="rounded-2xl border border-brand/20 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#8C8880]">
              Tautan pengisian BOD
            </p>
            <span className="text-[10px] text-[#8C8880]">Pola: {worshipPatternCode}</span>
          </div>
          <p className="text-[11px] text-[#8C8880]">
            Satu tautan per event — mentor/co-mentor/HOD mengisi peran; kosong bisa Minta ke divisi.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void createBodLink()}
              disabled={bodBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white text-[11px] font-bold disabled:opacity-40"
            >
              {bodBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Buat link penatalayan
            </button>
            {bodLinkUrl && (
              <>
                <button
                  type="button"
                  onClick={() => void copyBodLink()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold"
                >
                  Salin tautan
                </button>
                {bodCaption && (
                  <button
                    type="button"
                    onClick={() => void copyBodCaption()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold"
                  >
                    Salin caption WA
                  </button>
                )}
              </>
            )}
          </div>
          {bodLinkUrl && (
            <p className="text-[10px] break-all text-[#5C5850] font-mono bg-[#FAF9F5] rounded-xl p-2 border border-[#D9D7D0]/60">{bodLinkUrl}</p>
          )}
          {bodCaption && (
            <pre className="text-[10px] whitespace-pre-wrap max-h-40 overflow-auto text-[#5C5850] bg-[#FAF9F5] rounded-xl p-2 border border-[#D9D7D0]/60">{bodCaption}</pre>
          )}
          {bodMsg && <p className={`text-[11px] ${bodMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{bodMsg.text}</p>}
        </div>
      )}

      {canEdit && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-[#FAF9F5] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#8C8880]">
              Tuan Rumah & Penanggungjawab (routing grup)
            </p>
            {routingAt && (
              <span className="text-[10px] text-[#8C8880]">
                Routing terakhir: {new Date(routingAt).toLocaleString('id-ID')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#8C8880]">
            Pilih grup untuk event spesial (mis. Bedah Film). Mentor & co-mentor kedua grup bisa diarahkan mengisi usulan
            penatalayan lewat tombol kirim routing — divisi tetap yang menyetujui.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-bold text-[#5C5850] space-y-1">
              <span>Penanggungjawab</span>
              <select
                value={respId}
                onChange={(e) => setRespId(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-[#D9D7D0] bg-white font-semibold"
              >
                <option value="">— belum dipilih —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-bold text-[#5C5850] space-y-1">
              <span>Tuan Rumah</span>
              <select
                value={hostId}
                onChange={(e) => setHostId(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-[#D9D7D0] bg-white font-semibold"
              >
                <option value="">— belum dipilih —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveGroups()}
              disabled={groupBusy !== null || (Boolean(respId) !== Boolean(hostId))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181818] text-white text-[11px] font-bold disabled:opacity-40"
            >
              {groupBusy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Simpan grup
            </button>
            <button
              type="button"
              onClick={() => void sendRouting()}
              disabled={groupBusy !== null || !respId || !hostId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold text-[#5C5850] hover:border-[#1B1B1B] disabled:opacity-40"
            >
              {groupBusy === 'route' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
              Kirim routing ke mentor
            </button>
            {Boolean(respId) !== Boolean(hostId) && (
              <span className="text-[10px] text-amber-700">Isi keduanya (atau kosongkan keduanya untuk menghapus).</span>
            )}
            <button
              type="button"
              onClick={() => {
                const text = buildResponsibleGroupCaption({
                  dateLabel: dateStr
                    ? new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    : 'pekan ini',
                  responsibleGroup: groups.find((g) => g.id === respId)?.name,
                  hostGroup: groups.find((g) => g.id === hostId)?.name,
                });
                void navigator.clipboard?.writeText(text);
                setGroupMsg({ ok: true, text: 'Caption peran untuk mentor penanggung disalin. Tuan rumah mengisi nama per peran.' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold text-[#5C5850]"
            >
              <Copy className="w-3.5 h-3.5" /> Salin caption peran
            </button>
          </div>
          {groupMsg && (
            <p className={`text-[11px] font-bold ${groupMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{groupMsg.text}</p>
          )}
        </div>
      )}

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
            const divisionRoles = roles
              .filter((r) => String(r.division).toUpperCase() === division)
              .sort((a, b) => a.name.localeCompare(b.name, 'id'));
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
                      return (
                        <div key={role.id} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[#1B1B1B]">{displayServiceRoleName(role.name)}</p>
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
                                      {(NEXT[a.status] || []).length > 0 && (
                                        <select
                                          value=""
                                          onChange={(e) => { if (e.target.value) void setStatus(a, e.target.value); }}
                                          disabled={busy === a.id}
                                          className="text-[10px] px-1 py-0.5 rounded border border-[#D9D7D0] bg-white"
                                          title={`Status: ${STATUS_LABEL[a.status]}`}
                                        >
                                          <option value="">Status…</option>
                                          {(NEXT[a.status] || []).map((st) => (
                                            <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                                          ))}
                                        </select>
                                      )}
                                      {a.status === 'DONE' && <Check className="w-3 h-3 text-green-600" />}
                                      <button
                                        type="button"
                                        onClick={() => void removeAssignment(a.id)}
                                        disabled={busy === a.id || a.status === 'DONE'}
                                        className="p-0.5 rounded hover:bg-white disabled:opacity-30"
                                        title={a.status === 'DONE' ? 'Sudah selesai (final)' : 'Hapus penugasan'}
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
                            <div className="space-y-1.5">
                              <SearchableMultiSelect
                                values={addPicked[role.id] || []}
                                selectedOptions={addOptions[role.id] || []}
                                onSearch={searchPeople}
                                exclude={[...assignedIds]}
                                onChange={(values, options) => {
                                  setAddPicked((m) => ({ ...m, [role.id]: values }));
                                  setAddOptions((m) => ({ ...m, [role.id]: options }));
                                  setAddNote((m) => ({ ...m, [role.id]: '' }));
                                }}
                                placeholder="Ketik nama untuk menambah (min. 2 huruf)…"
                                emptyHint="Nama tidak ketemu / semua sudah ditugaskan."
                                minQuery={2}
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void addPeople(role.id, addPicked[role.id] || [])}
                                  disabled={!(addPicked[role.id] || []).length || busy === `add-${role.id}`}
                                  className="px-3 py-1.5 rounded-xl bg-[#181818] text-white text-[11px] font-bold disabled:opacity-40"
                                >
                                  {busy === `add-${role.id}` ? 'Menugaskan…' : `Tambah ${(addPicked[role.id] || []).length || ''}`.trim()}
                                </button>
                                {busy === `add-${role.id}` && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C8880]" />}
                              </div>
                            </div>
                          )}
                          {addNote[role.id] && (
                            <p className="text-[10px] text-amber-700">{addNote[role.id]}</p>
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

      {/* Komponen yang sudah diarsipkan: penugasannya tetap terlihat (tidak "hilang") */}
      {!loading && (() => {
        const activeIds = new Set(roles.map((r) => r.id));
        const archived = assignments.filter((a) => !activeIds.has(a.serviceRoleId));
        if (!archived.length) return null;
        const byRole = new Map<string, Assignment[]>();
        for (const a of archived) {
          const list = byRole.get(a.serviceRoleId) || [];
          list.push(a);
          byRole.set(a.serviceRoleId, list);
        }
        return (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-4 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">
              Komponen diarsipkan ({archived.length} personel)
            </p>
            <p className="text-[11px] text-amber-800">
              Komponen ini sudah diarsipkan, jadi tidak muncul di daftar aktif — penugasannya tetap tersimpan. Pulihkan
              komponen lewat “Kelola komponen”, atau pindahkan orangnya ke komponen aktif.
            </p>
            <ul className="space-y-1">
              {[...byRole.entries()].map(([roleId, list]) => (
                <li key={roleId} className="text-xs text-[#1B1B1B]">
                  <strong className="font-bold">{list[0]?.serviceRole?.name || roleId}</strong>
                  <span className="text-[#8C8880]"> — {list.map((a) => a.user?.name || '—').join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
};

