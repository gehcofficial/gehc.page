import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  CalendarClock,
  FolderOpen,
  MessageSquare,
  MessageCircle,
  Clock,
  Plus,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Pencil,
  MapPin,
  Search,
  AlignLeft,
} from 'lucide-react';
import { ChurchCalendarPanel } from './ChurchCalendarPanel';
import { YouthCalendarPanel } from './YouthCalendarPanel';
import { MonthlyPlanPanel } from './MonthlyPlanPanel';
import { EventQuestionsBlock } from './EventQuestionsBlock';
import { EventAttendeesBlock } from './EventAttendeesBlock';
import { ScrollTabBar } from './ScrollTabBar';
import { useLang } from '../../context/LangContext';
import { PanelGuide } from './PanelGuide';

function EditField({
  label,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
        {Icon ? <Icon className="w-3 h-3 shrink-0" /> : null}
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[10px] text-[#8C8880] leading-relaxed">{hint}</span> : null}
    </label>
  );
}

interface EventDivision {
  id: string;
  eventId: string;
  division: string;
  driveFolderId?: string;
  createdAt: string;
}

interface EventMeeting {
  id: string;
  eventId: string;
  division?: string;
  title: string;
  scheduledAt: string;
  gmeetLink?: string;
  notes?: string;
  createdById: string;
  createdAt: string;
}

interface EventItem {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  driveFolderId?: string;
  gmeetLink?: string;
  whatsappGroupUrl?: string | null;
  kind?: string;
  churchProgramId?: string | null;
  churchProgram?: { id: string; name: string; scope: string } | null;
  eventDate?: string | null;
  venueName?: string | null;
  locationDetail?: string | null;
  mapUrl?: string | null;
  mapEmbedQuery?: string | null;
  createdById: string;
  createdAt: string;
  divisions: EventDivision[];
  meetings?: EventMeeting[];
}

type ViewMode = 'list' | 'detail';
type ListTab = 'events' | 'calendar' | 'umbrella' | 'month';

const ALL_EVENT_DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
const EVENT_STATUSES = ['PLANNING', 'ACTIVE', 'DONE', 'ARCHIVED'];

/**
 * Waktu acara selalu diinput dan ditampilkan dalam WIB, bukan zona browser.
 * Kalau memakai zona browser, panitia yang sedang di luar negeri akan melihat
 * dan menyimpan jam yang bergeser.
 */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function isoToWibInput(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

function wibInputToIso(local: string): string {
  return local ? `${local}:00+07:00` : '';
}

function isoToDateInput(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}
const EVENT_KINDS = [
  { id: 'KHUSUS', label: 'Khusus (BAKU TAU, retret)' },
  { id: 'UMUM', label: 'Umum (ibadah jemaat/pemuda)' },
  { id: 'INTERNAL', label: 'Internal (rapat/pembekalan)' },
  { id: 'RECURRING', label: 'Berulang (BenZuar, BenZinema)' },
];

export const EventWorkspacePanel: React.FC = () => {
  const { addToast, currentRole } = useApp();
  const { t } = useLang();
  const ev = t.portal.events;
  const canCreateEvent = currentRole === 'SUPERADMIN' || currentRole === 'KOMISI' || currentRole === 'COMMITTEE';
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [listTab, setListTab] = useState<ListTab>('events');
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [churchPrograms, setChurchPrograms] = useState<Array<{ id: string; name: string; scope: string }>>([]);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    kind: 'KHUSUS',
    churchProgramId: '',
    startDate: '',
    endDate: '',
    whatsappGroupUrl: '',
    divisions: ['KOINONIA'] as string[],
  });
  const [detailLoading, setDetailLoading] = useState(false);

  // Discussions per division
  const [discussions, setDiscussions] = useState<Record<string, any[]>>({});
  const [newPost, setNewPost] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);

  // Meetings
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', scheduledAt: '', gmeetLink: '', notes: '' });

  // Edit event
  const [canEdit, setCanEdit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', description: '', kind: 'KHUSUS', status: 'PLANNING', churchProgramId: '',
    startDate: '', endDate: '', whatsappGroupUrl: '',
    eventDate: '', venueName: '', locationDetail: '', mapUrl: '', mapEmbedQuery: '',
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/events', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setEvents(d.events || []);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal memuat event', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    fetch('/api/church-programs', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setChurchPrograms(d.programs || []))
      .catch(() => setChurchPrograms([]));
  }, []);

  const toggleCreateDiv = (div: string) => {
    setCreateForm((f) => ({
      ...f,
      divisions: f.divisions.includes(div) ? f.divisions.filter((d) => d !== div) : [...f.divisions, div],
    }));
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || createForm.divisions.length === 0) return;
    setCreating(true);
    try {
      const r = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description || undefined,
          kind: createForm.kind,
          churchProgramId: createForm.churchProgramId || undefined,
          startDate: createForm.startDate || undefined,
          endDate: createForm.endDate || undefined,
          whatsappGroupUrl: createForm.whatsappGroupUrl || undefined,
          divisions: createForm.divisions,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Event dibuat', description: d.provisioned?.length ? `${d.provisioned.length} folder Drive` : undefined });
      setShowCreate(false);
      setCreateForm({
        name: '', description: '', kind: 'KHUSUS', churchProgramId: '', startDate: '', endDate: '', whatsappGroupUrl: '', divisions: ['KOINONIA'],
      });
      await fetchEvents();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal membuat event', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (ev: EventItem) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/events/${ev.id}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSelected(d.event);
      setCanEdit(d.canEdit === true);
      setShowEdit(false);
      setView('detail');

      // Load discussions per division
      const disc: Record<string, any[]> = {};
      for (const div of d.event.divisions || []) {
        try {
          const dr = await fetch(`/api/events/${d.event.id}/divisions/${div.division}/updates`, { credentials: 'include' });
          if (dr.ok) {
            const dd = await dr.json();
            disc[div.division] = dd.updates || [];
          }
        } catch { /* skip */ }
      }
      setDiscussions(disc);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal memuat detail', description: e.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const postUpdate = async (div: string) => {
    const text = newPost[div]?.trim();
    if (!text || !selected) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/events/${selected.id}/divisions/${div}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setDiscussions((prev) => ({ ...prev, [div]: [...(prev[div] || []), d.update] }));
      setNewPost((prev) => ({ ...prev, [div]: '' }));
      addToast({ type: 'success', title: 'Terkirim' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal mengirim', description: e.message });
    } finally {
      setPosting(false);
    }
  };

  const addMeeting = async () => {
    if (!selected || !meetingForm.title || !meetingForm.scheduledAt) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/events/${selected.id}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(meetingForm),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSelected((prev) => prev ? { ...prev, meetings: [d.meeting, ...(prev.meetings || [])] } : prev);
      setShowMeetingForm(false);
      setMeetingForm({ title: '', scheduledAt: '', gmeetLink: '', notes: '' });
      addToast({ type: 'success', title: 'Rapat ditambahkan' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal menambah rapat', description: e.message });
    } finally {
      setPosting(false);
    }
  };

  const downloadICS = async (mid: string) => {
    try {
      const r = await fetch(`/api/events/meetings/${mid}/ics`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-${mid}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal download .ics', description: e.message });
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700';
      case 'PLANNING': return 'bg-amber-100 text-amber-700';
      case 'DONE': return 'bg-gray-100 text-gray-600';
      case 'ARCHIVED': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const formatDateTimeWib = (d?: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
  };

  const startEdit = () => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
      description: selected.description || '',
      kind: selected.kind || 'KHUSUS',
      status: selected.status || 'PLANNING',
      churchProgramId: selected.churchProgramId || '',
      startDate: isoToDateInput(selected.startDate),
      endDate: isoToDateInput(selected.endDate),
      whatsappGroupUrl: selected.whatsappGroupUrl || '',
      eventDate: isoToWibInput(selected.eventDate),
      venueName: selected.venueName || '',
      locationDetail: selected.locationDetail || '',
      mapUrl: selected.mapUrl || '',
      mapEmbedQuery: selected.mapEmbedQuery || '',
    });
    setShowEdit(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !editForm.name.trim()) return;
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/events/${selected.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description || null,
          kind: editForm.kind,
          status: editForm.status,
          churchProgramId: editForm.churchProgramId || null,
          startDate: editForm.startDate || null,
          endDate: editForm.endDate || null,
          whatsappGroupUrl: editForm.whatsappGroupUrl || null,
          eventDate: wibInputToIso(editForm.eventDate) || null,
          venueName: editForm.venueName || null,
          locationDetail: editForm.locationDetail || null,
          mapUrl: editForm.mapUrl || null,
          mapEmbedQuery: editForm.mapEmbedQuery || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const prog = churchPrograms.find((p) => p.id === d.event.churchProgramId);
      setSelected((prev) => (prev ? {
        ...prev,
        ...d.event,
        churchProgram: prog ? { id: prog.id, name: prog.name, scope: prog.scope } : null,
        divisions: prev.divisions,
        meetings: prev.meetings,
      } : d.event));
      setShowEdit(false);
      await fetchEvents();
      addToast({ type: 'success', title: 'Event diperbarui' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSavingEdit(false);
    }
  };

  const showVenueFields = editForm.kind === 'KHUSUS' || editForm.kind === 'UMUM';

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 text-[#8C8880]">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-semibold">Memuat program & event...</span>
      </div>
    );
  }

  // Detail View
  if (view === 'detail' && selected) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => { setView('list'); setSelected(null); }} className="mt-1 text-[#8C8880] hover:text-[#FF416C] transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-xl font-black text-[#1B1B1B] truncate">{selected.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor(selected.status)}`}>
                {selected.status}
              </span>
              {selected.kind && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880] font-bold">{selected.kind}</span>
              )}
              {selected.churchProgram && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880] font-bold">
                  Payung: {selected.churchProgram.name}
                </span>
              )}
            </div>
            {selected.description && <p className="text-sm text-[#8C8880] mb-2">{selected.description}</p>}
            <div className="flex flex-wrap gap-4 text-xs text-[#8C8880]">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(selected.startDate)} — {formatDate(selected.endDate)}</span>
              {(selected.eventDate || selected.venueName) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[formatDateTimeWib(selected.eventDate), selected.venueName].filter(Boolean).join(' · ')}
                  {selected.eventDate ? ' WIB' : ''}
                </span>
              )}
              <span className="flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" /> {selected.divisions.length} divisi</span>
              <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {(selected.meetings || []).length} rapat</span>
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => (showEdit ? setShowEdit(false) : startEdit())}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-[#181818] text-white font-bold hover:bg-[#333] transition-colors shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" /> {showEdit ? 'Tutup' : 'Edit'}
            </button>
          )}
        </div>

        {showEdit && canEdit && (
          <form onSubmit={saveEdit} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
            <p className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Meta event</p>
            <EditField label="Nama event">
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: BAKU TAU 4.0"
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
              />
            </EditField>
            <EditField label="Deskripsi">
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ringkasan singkat program"
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm min-h-[60px]"
              />
            </EditField>
            <div className="grid sm:grid-cols-3 gap-2">
              <EditField label="Jenis">
                <select
                  value={editForm.kind}
                  onChange={(e) => setEditForm((f) => ({ ...f, kind: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
                >
                  {EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              </EditField>
              <EditField label="Status">
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
                >
                  {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </EditField>
              <EditField label="Payung Komisi" hint="Opsional — tautkan ke program gerejawi.">
                <select
                  value={editForm.churchProgramId}
                  onChange={(e) => setEditForm((f) => ({ ...f, churchProgramId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
                >
                  <option value="">— Tidak ada —</option>
                  {churchPrograms.filter((p) => p.scope === 'KOMISI' || p.scope === 'BPMJ').map((p) => (
                    <option key={p.id} value={p.id}>{p.scope} · {p.name}</option>
                  ))}
                </select>
              </EditField>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <EditField label="Mulai program" hint="Rentang program tahunan, bukan hari H." icon={Calendar}>
                <input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                />
              </EditField>
              <EditField label="Akhir program" icon={Calendar}>
                <input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                />
              </EditField>
            </div>
            <EditField
              label="Grup WhatsApp peserta"
              icon={MessageCircle}
              hint="Satu-satunya tempat mengubah tautan grup peserta. Kartu Info Event dan Kanal WhatsApp (layer Event) hanya menampilkan tautan ini."
            >
              <input
                value={editForm.whatsappGroupUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, whatsappGroupUrl: e.target.value }))}
                placeholder="https://chat.whatsapp.com/…"
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                inputMode="url"
                autoComplete="off"
              />
            </EditField>
            {showVenueFields && (
              <div className="space-y-3 pt-2 border-t border-[#D9D7D0]">
                <div>
                  <p className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Waktu & tempat (WIB)</p>
                  <p className="text-[10px] text-[#8C8880] mt-0.5 leading-relaxed">
                    Hari pelaksanaan & lokasi publik — terpisah dari rentang program di atas.
                  </p>
                </div>
                <EditField
                  label="Hari & jam pelaksanaan"
                  icon={CalendarClock}
                  hint="Zona waktu WIB (bukan zona browser)."
                >
                  <input
                    type="datetime-local"
                    value={editForm.eventDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, eventDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                  />
                </EditField>
                <EditField label="Nama tempat" icon={MapPin} hint="Judul singkat di kartu lokasi publik.">
                  <input
                    value={editForm.venueName}
                    onChange={(e) => setEditForm((f) => ({ ...f, venueName: e.target.value }))}
                    placeholder="GMIM Eben Haezer Cikarang"
                    className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                  />
                </EditField>
                <EditField
                  label="Catatan lokasi (opsional)"
                  icon={AlignLeft}
                  hint="Subtitle di bawah nama tempat — mis. aula / parkir. Jangan ulang nama + jam; jam sudah dari field di atas."
                >
                  <input
                    value={editForm.locationDetail}
                    onChange={(e) => setEditForm((f) => ({ ...f, locationDetail: e.target.value }))}
                    placeholder="Contoh: Aula utama · parkir di utara"
                    className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                  />
                </EditField>
                <EditField
                  label="Tautan Buka Maps"
                  icon={ExternalLink}
                  hint="URL yang dibuka saat tombol “Buka Maps” diklik."
                >
                  <input
                    value={editForm.mapUrl}
                    onChange={(e) => setEditForm((f) => ({ ...f, mapUrl: e.target.value }))}
                    placeholder="https://maps.app.goo.gl/… atau share.google/…"
                    className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                    inputMode="url"
                    autoComplete="off"
                  />
                </EditField>
                <EditField
                  label="Query pin peta embed"
                  icon={Search}
                  hint="Teks pencarian untuk iframe peta (bukan URL). Kosong = pakai nama tempat."
                >
                  <input
                    value={editForm.mapEmbedQuery}
                    onChange={(e) => setEditForm((f) => ({ ...f, mapEmbedQuery: e.target.value }))}
                    placeholder={editForm.venueName ? `${editForm.venueName}, Cikarang, Bekasi` : 'Nama tempat, kota'}
                    className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
                  />
                </EditField>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowEdit(false)} className="text-xs px-3 py-2 rounded-xl text-[#8C8880]">Batal</button>
              <button type="submit" disabled={savingEdit || !editForm.name.trim()} className="text-xs px-3 py-2 rounded-xl bg-[#FF416C] text-white font-bold disabled:opacity-40">
                {savingEdit ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Simpan'}
              </button>
            </div>
          </form>
        )}

        <EventQuestionsBlock eventId={selected.id} />

        {/* Division Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selected.divisions.map((div) => (
            <div key={div.id} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#1B1B1B]">{div.division}</h3>
                {div.driveFolderId && (
                  <a href={`https://drive.google.com/drive/folders/${div.driveFolderId}`} target="_blank" rel="noopener" className="text-[#8C8880] hover:text-[#FF416C] transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {/* Discussion */}
              <div className="space-y-2">
                {(discussions[div.division] || []).slice(-3).map((u, i) => (
                  <div key={u.id || i} className="text-xs bg-[#FAF9F5] rounded-lg p-2">
                    <span className="font-semibold text-[#1B1B1B]">{u.authorName || u.authorId}</span>: {u.body}
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPost[div.division] || ''}
                    onChange={(e) => setNewPost((prev) => ({ ...prev, [div.division]: e.target.value }))}
                    placeholder="Tulis progres..."
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-[#FF416C]"
                    onKeyDown={(e) => e.key === 'Enter' && postUpdate(div.division)}
                  />
                  <button
                    onClick={() => postUpdate(div.division)}
                    disabled={!newPost[div.division]?.trim() || posting}
                    className="text-xs px-3 py-2 rounded-xl bg-[#FF416C] text-white font-bold disabled:opacity-40 hover:bg-[#FF416C]/90 transition-colors"
                  >
                    {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kirim'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Kehadiran event (EventAttendee) */}
        <EventAttendeesBlock eventId={selected.id} slug={selected.slug || selected.id} />

        {/* Meetings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#1B1B1B]">Rapat & Jadwal</h3>
            <button
              onClick={() => setShowMeetingForm(!showMeetingForm)}
              className="text-xs px-3 py-1.5 rounded-xl bg-[#181818] text-white font-bold hover:bg-[#333] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Tambah
            </button>
          </div>
          {showMeetingForm && (
            <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
              <input type="text" placeholder="Judul rapat" value={meetingForm.title} onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-[#FF416C]" />
              <input type="datetime-local" value={meetingForm.scheduledAt} onChange={(e) => setMeetingForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-[#FF416C]" />
              <input type="text" placeholder="Link Google Meet (opsional)" value={meetingForm.gmeetLink} onChange={(e) => setMeetingForm((f) => ({ ...f, gmeetLink: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-[#FF416C]" />
              <textarea placeholder="Catatan (opsional)" value={meetingForm.notes} onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-[#FF416C] min-h-[60px]" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMeetingForm(false)} className="text-xs px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">Batal</button>
                <button onClick={addMeeting} disabled={!meetingForm.title || !meetingForm.scheduledAt || posting} className="text-xs px-4 py-2 rounded-xl bg-[#FF416C] text-white font-bold disabled:opacity-40 hover:bg-[#FF416C]/90">
                  {posting ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Simpan'}
                </button>
              </div>
            </div>
          )}
          {(selected.meetings || []).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl border border-[#D9D7D0] bg-white px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="w-4 h-4 text-[#8C8880] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1B1B1B] truncate">{m.title}</p>
                  <p className="text-xs text-[#8C8880]">{formatDate(m.scheduledAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {m.gmeetLink && (
                  <a href={m.gmeetLink} target="_blank" rel="noopener" className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-100">Join</a>
                )}
                <button onClick={() => downloadICS(m.id)} className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">.ics</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#1B1B1B]">{t.portal.nav.events}</h2>
          <p className="text-xs text-[#8C8880] mt-0.5">{t.portal.guides.events.purpose}</p>
        </div>
        {listTab === 'events' && canCreateEvent && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-xl bg-[#181818] text-white font-bold"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" /> {ev.tabEvents}
          </button>
        )}
      </div>

      <PanelGuide guideId={`events.${listTab}`} />

      <ScrollTabBar active={listTab}>
        {([
          { id: 'events' as ListTab, label: ev.tabEvents },
          { id: 'calendar' as ListTab, label: ev.tabCalendar },
          { id: 'umbrella' as ListTab, label: ev.tabUmbrella },
          { id: 'month' as ListTab, label: ev.tabMonth },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={listTab === tab.id}
            onClick={() => setListTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${listTab === tab.id ? 'bg-white text-[#1B1B1B] shadow-sm' : 'text-[#8C8880]'}`}
          >
            {tab.label}
          </button>
        ))}
      </ScrollTabBar>

      {listTab === 'calendar' && (
        <YouthCalendarPanel
          onPromote={canCreateEvent ? ({ name, startDate }) => {
            setCreateForm((f) => ({ ...f, name, startDate, endDate: startDate }));
            setShowCreate(true);
            setListTab('events');
          } : undefined}
        />
      )}
      {listTab === 'umbrella' && <ChurchCalendarPanel />}
      {listTab === 'month' && <MonthlyPlanPanel />}
      {listTab === 'events' && (
        <>
          {showCreate && canCreateEvent && (
            <form onSubmit={createEvent} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
              <p className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Komisi merancang payung · Tim Kerja menamai event</p>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama operasional (contoh: BAKU TAU 4.0)"
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
              />
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi singkat"
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm min-h-[60px]"
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <select
                  value={createForm.kind}
                  onChange={(e) => setCreateForm((f) => ({ ...f, kind: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
                >
                  {EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
                <select
                  value={createForm.churchProgramId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, churchProgramId: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
                >
                  <option value="">Payung Komisi (opsional)</option>
                  {churchPrograms.filter((p) => p.scope === 'KOMISI' || p.scope === 'BPMJ').map((p) => (
                    <option key={p.id} value={p.id}>{p.scope} · {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <input type="date" value={createForm.startDate} onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm" />
                <input type="date" value={createForm.endDate} onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm" />
              </div>
              <input
                value={createForm.whatsappGroupUrl}
                onChange={(e) => setCreateForm((f) => ({ ...f, whatsappGroupUrl: e.target.value }))}
                placeholder="WA event sementara (https://chat.whatsapp.com/…)"
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {ALL_EVENT_DIVISIONS.map((div) => (
                  <button
                    key={div}
                    type="button"
                    onClick={() => toggleCreateDiv(div)}
                    className={`text-[10px] px-2 py-1 rounded-full font-bold border ${
                      createForm.divisions.includes(div) ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]'
                    }`}
                  >
                    {div}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="text-xs px-3 py-2 rounded-xl text-[#8C8880]">Batal</button>
                <button type="submit" disabled={creating || !createForm.name.trim() || createForm.divisions.length === 0} className="text-xs px-3 py-2 rounded-xl bg-[#FF416C] text-white font-bold disabled:opacity-40">
                  {creating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Buat event'}
                </button>
              </div>
            </form>
          )}

          {events.length === 0 ? (
            <div className="text-center py-16 text-[#8C8880]">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">Belum ada event.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => openDetail(ev)}
                  className="text-left rounded-2xl border border-[#D9D7D0] bg-white p-5 shadow-sm hover:shadow-md hover:border-[#FF416C]/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-black text-[#1B1B1B] group-hover:text-[#FF416C] transition-colors line-clamp-1">{ev.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${statusColor(ev.status)}`}>
                      {ev.status}
                    </span>
                  </div>
                  {ev.churchProgram && <p className="text-[10px] font-bold text-[#8C8880] mb-1">{ev.churchProgram.name}</p>}
                  {ev.description && <p className="text-xs text-[#8C8880] line-clamp-2 mb-3">{ev.description}</p>}
                  <div className="flex flex-wrap gap-3 text-[11px] text-[#8C8880]">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(ev.startDate)}</span>
                    <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" /> {ev.divisions.length} divisi</span>
                    {ev.kind && <span className="font-bold">{ev.kind}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {ev.divisions.slice(0, 4).map((d) => (
                      <span key={d.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880] font-bold">
                        {d.division}
                      </span>
                    ))}
                    {ev.divisions.length > 4 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880] font-bold">
                        +{ev.divisions.length - 4}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
