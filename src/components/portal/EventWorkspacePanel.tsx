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
  ChevronDown,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Pencil,
  FileText,
  Trash2,
  MapPin,
  Search,
  AlignLeft,
} from 'lucide-react';
import { ChurchCalendarPanel } from './ChurchCalendarPanel';
import { YouthCalendarPanel } from './YouthCalendarPanel';
import { ServicePlanPanel } from './ServicePlanPanel';
import { EventDivisionPhaseTabs } from './EventDivisionPhaseTabs';
import { EventQuestionsBlock } from './EventQuestionsBlock';
import { EventPublicContentBlock } from './EventPublicContentBlock';
import { EventAttendeesBlock } from './EventAttendeesBlock';
import { EventPenatalayanPanel } from './EventPenatalayanPanel';
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
  division?: string | null;
  title: string;
  scheduledAt: string;
  gmeetLink?: string;
  notes?: string;
  attendees?: Array<{ name?: string; userId?: string; role?: string }>;
  agenda?: Array<{ title?: string; assignee?: string; deadline?: string }>;
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
  serviceType?: string | null;
  metadata?: Record<string, unknown> | null;
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
type ListTab = 'events' | 'calendar' | 'umbrella' | 'ibadah';

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
import { EVENT_KINDS, eventKindLabel, normalizeEventKind } from '../../lib/event-kinds';

type DetailSec = 'konten' | 'soal' | 'divisi' | 'pendaftar' | 'penatalayan' | 'rapat';

const DETAIL_SECS: Array<{ id: DetailSec; label: string }> = [
  { id: 'konten', label: 'Konten' },
  { id: 'soal', label: 'Soal' },
  { id: 'divisi', label: 'Divisi' },
  { id: 'pendaftar', label: 'Pendaftar' },
  { id: 'penatalayan', label: 'Penatalayan' },
  { id: 'rapat', label: 'Rapat' },
];

const DEFAULT_OPEN_SECS: Record<DetailSec, boolean> = {
  konten: true,
  soal: false,
  divisi: true,
  pendaftar: false,
  penatalayan: false,
  rapat: false,
};

function openSecsKey(eventId: string): string {
  return `event-detail-open:${eventId}`;
}

function scrollToSec(id: DetailSec): void {
  document.getElementById(`evsec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const DetailSection: React.FC<{
  id: DetailSec;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ id, title, summary, open, onToggle, children }) => (
  <section id={`evsec-${id}`} className="scroll-mt-24 space-y-2">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center gap-2 px-1 py-1 text-left"
    >
      <span className="text-sm font-black text-[#1B1B1B]">{title}</span>
      {summary && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold truncate">
          {summary}
        </span>
      )}
      <span className="ml-auto text-[#8C8880]">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </span>
    </button>
    {open ? children : null}
  </section>
);

function formatRange(start?: string, end?: string, fmt?: (d?: string) => string): string {
  const f = fmt || ((d?: string) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'));
  const s = start ? f(start) : '';
  const e = end ? f(end) : '';
  if (s && e && s !== e) return `${s} — ${e}`;
  return s || e || '—';
}

export const EventWorkspacePanel: React.FC = () => {
  const { addToast, currentRole } = useApp();
  const { t } = useLang();
  const ev = t.portal.events;
  const canCreateEvent = currentRole === 'SUPERADMIN' || currentRole === 'KOMISI' || currentRole === 'COMMITTEE';
  const canDeleteEvent = currentRole === 'SUPERADMIN' || currentRole === 'KOMISI';

  const deleteEvent = async () => {
    if (!selected) return;
    if (!window.confirm(`Hapus event "${selected.name}"? Hanya bisa bila belum punya pendaftar, jawaban, galeri, konten terbit, warta, atau deliverable.`)) return;
    try {
      const r = await fetch(`/api/events/${selected.id}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menghapus.');
      addToast({ type: 'success', title: 'Event dihapus' });
      setSelected(null);
      setView('list');
      await fetchEvents();
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Gagal menghapus', description: err instanceof Error ? err.message : '' });
    }
  };
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
  /** Default dari Profil Gereja: tempat + WA grup default (event mingguan). */
  const [churchDefaults, setChurchDefaults] = useState<{ venueName: string; whatsappGroupUrl: string }>({ venueName: '', whatsappGroupUrl: '' });
  const [linkedPlans, setLinkedPlans] = useState<Array<{ id: string; title: string; division: string; weekIndex: number; yearMonth: string | null; status: string }>>([]);

  // Discussions per division
  const [discussions, setDiscussions] = useState<Record<string, any[]>>({});
  const [newPost, setNewPost] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);

  // Meetings
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', scheduledAt: '', gmeetLink: '', notes: '', isJoint: false, agendaText: '', attendeesText: '' });

  // Edit event
  const [canEdit, setCanEdit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [addingDivision, setAddingDivision] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', description: '', kind: 'KHUSUS', status: 'PLANNING', churchProgramId: '',
    startDate: '', endDate: '', whatsappGroupUrl: '',
    eventDate: '', venueName: '', locationDetail: '', mapUrl: '', mapEmbedQuery: '',
  });

  // P0 UX: seksi detail yang bisa dilipat + diingat per event.
  const [openSecs, setOpenSecs] = useState<Record<DetailSec, boolean>>({ ...DEFAULT_OPEN_SECS });
  // P0 UX: ringkasan kesiapan terbit (ringan, best-effort).
  const [readiness, setReadiness] = useState<{
    kontenOk: boolean | null; soalCount: number | null; tapisanCount: number | null;
  }>({ kontenOk: null, soalCount: null, tapisanCount: null });

  const toggleSec = useCallback((id: DetailSec) => {
    setOpenSecs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        const eid = selected?.id;
        if (eid) localStorage.setItem(openSecsKey(eid), JSON.stringify(next));
      } catch { /* abaikan */ }
      return next;
    });
  }, [selected?.id]);

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

  // Default dari Profil Gereja (satu sumber): tempat + WA grup default.
  useEffect(() => {
    fetch('/api/church-profile')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { profile?: { name?: string; whatsappGroupUrl?: string | null } }) => {
        setChurchDefaults({
          venueName: String(d.profile?.name || '').trim(),
          whatsappGroupUrl: String(d.profile?.whatsappGroupUrl || '').trim(),
        });
      })
      .catch(() => { /* default opsional */ });
  }, []);

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

  const refreshReadiness = useCallback(async (eventId: string) => {
    try {
      const [c, q, p] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(eventId)}/content`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch(`/api/events/${encodeURIComponent(eventId)}/penatalayan`, { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ]);
      const item = (c as { item?: { title?: string; bannerUrl?: string; is_published?: boolean } } | null)?.item || null;
      const soalCount = Array.isArray((q as { questions?: unknown[] } | null)?.questions)
        ? ((q as { questions: unknown[] }).questions.length) : null;
      const tapisanCount = Array.isArray((p as { assignments?: unknown[] } | null)?.assignments)
        ? ((p as { assignments: unknown[] }).assignments.length) : null;
      setReadiness({
        kontenOk: item ? Boolean(String(item.title || '').trim()) : false,
        soalCount,
        tapisanCount,
      });
    } catch { /* best-effort, biarkan null */ }
  }, []);

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
      try {
        const raw = localStorage.getItem(openSecsKey(d.event.id));
        if (raw) setOpenSecs({ ...DEFAULT_OPEN_SECS, ...(JSON.parse(raw) as Partial<Record<DetailSec, boolean>>) });
        else setOpenSecs({ ...DEFAULT_OPEN_SECS });
      } catch { setOpenSecs({ ...DEFAULT_OPEN_SECS }); }
      setReadiness({ kontenOk: null, soalCount: null, tapisanCount: null });
      void refreshReadiness(d.event.id);
      // Deliverable Rencana bulan yang tertaut (badge "dari Rencana bulan").
      fetch(`/api/events/${ev.id}/deliverables`, { credentials: 'include' })
        .then((lr) => lr.json())
        .then((ld) => setLinkedPlans(ld.deliverables || []))
        .catch(() => setLinkedPlans([]));

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
      const agenda = meetingForm.agendaText.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [title, assignee, deadline] = l.split('|').map((x) => (x || '').trim());
        return { title, assignee: assignee || '', deadline: deadline || '' };
      });
      const attendees = meetingForm.attendeesText.split('\n').map((l) => l.trim()).filter(Boolean).map((name) => ({ name }));
      const { agendaText, attendeesText, isJoint, ...rest } = meetingForm;
      const r = await fetch(`/api/events/${selected.id}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...rest, division: isJoint ? null : undefined, agenda, attendees }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSelected((prev) => prev ? { ...prev, meetings: [d.meeting, ...(prev.meetings || [])] } : prev);
      setShowMeetingForm(false);
      setMeetingForm({ title: '', scheduledAt: '', gmeetLink: '', notes: '', isJoint: false, agendaText: '', attendeesText: '' });
      addToast({ type: 'success', title: 'Rapat ditambahkan' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal menambah rapat', description: e.message });
    } finally {
      setPosting(false);
    }
  };

  const fillRepDay = async () => {
    if (!selected) return;
    setPosting(true);
    try {
      const date = String(selected.eventDate || '').slice(0, 10);
      const r = await fetch(`/api/representative-day/template?eventId=${selected.id}&date=${encodeURIComponent(date)}`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMeetingForm((f) => ({
        ...f,
        title: d.title || f.title,
        agendaText: d.agendaText || f.agendaText,
        attendeesText: d.attendeesHint || f.attendeesText,
        isJoint: true,
      }));
      addToast({ type: 'success', title: 'Template Representative Day terisi' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Gagal ambil template', description: e instanceof Error ? e.message : '' });
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
  const serviceTypeColor = (s?: string | null) => {
    switch (s) {
      case 'MENTORING_DAY': return 'bg-sky-100 text-sky-700 border border-sky-200';
      case 'SERVING_DAY': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      default: return 'bg-[#FAF9F5] text-[#8C8880] border border-[#D9D7D0]';
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
      kind: normalizeEventKind(selected.kind || 'KHUSUS'),
      status: selected.status || 'PLANNING',
      churchProgramId: selected.churchProgramId || '',
      startDate: isoToDateInput(selected.startDate),
      endDate: isoToDateInput(selected.endDate),
      whatsappGroupUrl: selected.whatsappGroupUrl || churchDefaults.whatsappGroupUrl,
      eventDate: isoToWibInput(selected.eventDate),
      venueName: selected.venueName || churchDefaults.venueName,
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

  const addDivision = async (division: string) => {
    if (!selected || addingDivision) return;
    setAddingDivision(division);
    try {
      const r = await fetch(`/api/events/${selected.id}/divisions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const added = d.division || { id: `evd-${division}`, eventId: selected.id, division };
      setSelected((prev) => (prev ? {
        ...prev,
        divisions: prev.divisions.some((x) => String(x.division).toUpperCase() === division)
          ? prev.divisions
          : [...prev.divisions, added],
      } : prev));
      addToast({
        type: 'success',
        title: `Divisi ${division} diaktifkan`,
        description: d.driveFolderId ? 'Folder Drive dibuat' : undefined,
      });
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Gagal menambah divisi', description: err instanceof Error ? err.message : '' });
    } finally {
      setAddingDivision(null);
    }
  };

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
    const eventDivisions = ALL_EVENT_DIVISIONS.filter((divName) =>
      selected.divisions.some((d) => String(d.division).toUpperCase() === divName));
    const missingDivisions = ALL_EVENT_DIVISIONS.filter((divName) => !eventDivisions.includes(divName));
    return (
      <div className="space-y-6">
        {/* Header */}
          <div className="flex items-start gap-4">
          <button onClick={() => { setView('list'); setSelected(null); }} className="mt-1 text-[#8C8880] hover:text-brand transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-xl font-black text-[#1B1B1B] truncate">{selected.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor(selected.status)}`}>
                {selected.status}
              </span>
              {selected.serviceType && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${serviceTypeColor(selected.serviceType)}`}>{selected.serviceType === 'MENTORING_DAY' ? 'MENTORING' : selected.serviceType === 'SERVING_DAY' ? 'SERVING' : selected.serviceType}</span>
              )}
              {selected.kind && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880] font-bold" title={eventKindLabel(selected.kind)}>{eventKindLabel(selected.kind)}</span>
              )}
              {selected.churchProgram && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#8C8880] font-bold">
                  Payung: {selected.churchProgram.name}
                </span>
              )}
              {linkedPlans.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                  dari Rencana bulan ({linkedPlans.length})
                </span>
              )}
            </div>
            {linkedPlans.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {linkedPlans.map((p) => (
                  <span key={p.id} className="text-[10px] px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 font-semibold">
                    {p.yearMonth} · W{p.weekIndex} · {p.division}: {p.title}
                  </span>
                ))}
              </div>
            )}
            {selected.description && <p className="text-sm text-[#8C8880] mb-2">{selected.description}</p>}
            <div className="flex flex-wrap gap-4 text-xs text-[#8C8880]">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatRange(selected.startDate, selected.endDate, formatDate)}</span>
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
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selected.status === 'DONE' && (
              <button
                type="button"
                onClick={async () => {
                  const r = await fetch(`/api/events/${selected.id}/make-warta`, {
                    method: 'POST',
                    credentials: 'include',
                  });
                  const d = await r.json().catch(() => ({}));
                  if (!r.ok) {
                    addToast({ type: 'error', title: 'Gagal membuat draf Warta', description: d.error });
                    return;
                  }
                  addToast({
                    type: 'success',
                    title: d.existed ? 'Draf Warta sudah ada' : `Draf Warta dibuat (+${d.photos || 0} foto)`,
                    description: 'Selesaikan di Kelola Warta Pemuda → terbitkan.',
                  });
                }}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors shrink-0"
                title="Buat draf Warta dokumentasi dari event ini (sekali saja)"
              >
                <FileText className="w-3.5 h-3.5" /> Draf Warta
              </button>
            )}
            {canDeleteEvent && (
              <button
                type="button"
                onClick={() => void deleteEvent()}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors shrink-0"
                title="Hapus event (diblokir bila sudah punya data)"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            )}
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
        </div>

        {/* P0 UX: checklist Siap Terbit — klik loncat ke blok yang kurang */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#D9D7D0]/60 bg-white px-3 py-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mr-1">Siap terbit</span>
          <button
            type="button"
            onClick={() => { if (!openSecs.konten) toggleSec('konten'); requestAnimationFrame(() => scrollToSec('konten')); }}
            className={`text-[10px] px-2 py-1 rounded-full font-bold border ${readiness.kontenOk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : readiness.kontenOk === false ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]'}`}
            title="Judul publik + banner di Konten publik"
          >
            {readiness.kontenOk == null ? 'Konten…' : readiness.kontenOk ? '✓ Konten' : '! Konten'}
          </button>
          <button
            type="button"
            onClick={() => { if (!openSecs.soal) toggleSec('soal'); requestAnimationFrame(() => scrollToSec('soal')); }}
            className="text-[10px] px-2 py-1 rounded-full font-bold border bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]"
            title="Soal tambahan per event"
          >
            Soal{readiness.soalCount != null ? ` (${readiness.soalCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => { if (!openSecs.divisi) toggleSec('divisi'); requestAnimationFrame(() => scrollToSec('divisi')); }}
            className="text-[10px] px-2 py-1 rounded-full font-bold border bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]"
            title="Divisi aktif event ini"
          >
            Divisi ({eventDivisions.length})
          </button>
          <button
            type="button"
            onClick={() => { if (!openSecs.penatalayan) toggleSec('penatalayan'); requestAnimationFrame(() => scrollToSec('penatalayan')); }}
            className="text-[10px] px-2 py-1 rounded-full font-bold border bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]"
            title="Penugasan penatalayan aktif"
          >
            Tapisan{readiness.tapisanCount != null ? ` (${readiness.tapisanCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => { if (!openSecs.rapat) toggleSec('rapat'); requestAnimationFrame(() => scrollToSec('rapat')); }}
            className="text-[10px] px-2 py-1 rounded-full font-bold border bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]"
            title="Rapat & jadwal"
          >
            Rapat ({(selected.meetings || []).length})
          </button>
        </div>

        {/* P0 UX: sub-nav lengket antar-blok */}
        <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#F7F5F0]/95 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] p-1">
            {DETAIL_SECS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (!openSecs[s.id]) toggleSec(s.id);
                  requestAnimationFrame(() => scrollToSec(s.id));
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-[#8C8880] hover:text-[#1B1B1B] hover:bg-white"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {showEdit && canEdit && (
          <form onSubmit={saveEdit} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
            <p className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Meta event (internal panitia)</p>
            <p className="text-[11px] text-[#8C8880] leading-relaxed -mt-2">
              Nama di sini tidak tampil di landing — yang tampil adalah <strong>Judul publik</strong> di blok Konten di bawah
              + tanggal WIB + tempat. Pola ibadah & Penanggung/Tuan Rumah ikut otomatis dari sistem.
            </p>
            <EditField label="Nama internal (panitia saja)" hint="Contoh operasional: BAKU TAU 4.0 / W3 Ancient Word.">
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
                  title={EVENT_KINDS.find((k) => k.id === editForm.kind)?.tooltip || ''}
                >
                  {EVENT_KINDS.map((k) => <option key={k.id} value={k.id} title={k.tooltip}>{k.label}</option>)}
                </select>
                <p className="text-[10px] text-[#8C8880] mt-1">{EVENT_KINDS.find((k) => k.id === editForm.kind)?.tooltip}</p>
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
              <button type="submit" disabled={savingEdit || !editForm.name.trim()} className="text-xs px-3 py-2 rounded-xl bg-brand text-white font-bold disabled:opacity-40">
                {savingEdit ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Simpan'}
              </button>
            </div>
          </form>
        )}

        <DetailSection
          id="konten"
          title="Konten publik"
          summary={readiness.kontenOk == null ? 'landing Kegiatan' : readiness.kontenOk ? 'siap terbit' : 'belum lengkap'}
          open={openSecs.konten}
          onToggle={() => toggleSec('konten')}
        >
          <EventPublicContentBlock eventId={selected.id} />
        </DetailSection>

        <DetailSection
          id="soal"
          title="Pertanyaan tambahan"
          summary={readiness.soalCount != null ? `${readiness.soalCount} soal` : 'bank soal'}
          open={openSecs.soal}
          onToggle={() => toggleSec('soal')}
        >
          <EventQuestionsBlock eventId={selected.id} />
        </DetailSection>

        {/* Division Cards — hanya divisi yang aktif di event ini */}
        <DetailSection
          id="divisi"
          title="Rincian per Divisi — Pre / During / Post"
          summary={`${eventDivisions.length} divisi aktif`}
          open={openSecs.divisi}
          onToggle={() => toggleSec('divisi')}
        >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold">
              {eventDivisions.length} divisi aktif
            </span>
            {canCreateEvent && missingDivisions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Tambah divisi</span>
                {missingDivisions.map((divName) => (
                  <button
                    key={divName}
                    type="button"
                    onClick={() => void addDivision(divName)}
                    disabled={addingDivision === divName}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-[#D9D7D0] text-[10px] font-bold text-[#5C5850] hover:border-[#1B1B1B] disabled:opacity-40"
                  >
                    {addingDivision === divName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    {divName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {eventDivisions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D9D7D0] bg-white p-6 text-center space-y-2">
              <p className="text-sm font-bold text-[#1B1B1B]">Belum ada divisi diaktifkan untuk event ini</p>
              <p className="text-xs text-[#8C8880]">
                {canCreateEvent
                  ? 'Tambahkan divisi yang terlibat lewat tombol di atas, atau dari Panel Divisi.'
                  : 'Divisi akan muncul setelah Komisi mengaktifkannya.'}
              </p>
              {canCreateEvent && missingDivisions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {missingDivisions.map((divName) => (
                    <button
                      key={divName}
                      type="button"
                      onClick={() => void addDivision(divName)}
                      disabled={addingDivision === divName}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand text-white text-[11px] font-bold disabled:opacity-40"
                    >
                      {addingDivision === divName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      {divName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {eventDivisions.map((divName) => {
                const rec = selected.divisions.find((d) => String(d.division).toUpperCase() === divName);
                return (
                  <div key={divName} className="space-y-1">
                    <EventDivisionPhaseTabs
                      division={divName}
                      eventId={selected.id}
                      eventDate={selected.eventDate}
                      serviceType={selected.serviceType}
                      driveFolderId={rec?.driveFolderId}
                      discussions={discussions[divName] || []}
                      canWrite={false}
                      onPostUpdate={() => {
                        addToast({ type: 'info', title: 'Kelola di Panel Divisi', description: `Buka Panel Divisi → ${divName} → tab Ibadah untuk tulis pre/during/post.` });
                      }}
                    />
                    <a href={`#/portal/${currentRole === 'SUPERADMIN' ? 'superadmin' : 'komisi'}/divisions`} onClick={() => addToast({ type: 'info', title: 'Buka Panel Divisi', description: `Pilih event ${selected.name} → ${divName} → tab Ibadah` })} className="block text-[11px] font-bold text-sky-700 hover:underline px-1">→ Kelola eksekusi di Panel Divisi (pre/during/post)</a>
                  </div>
                );
              })}
            </div>
          )}

          {eventDivisions.length > 0 && (
            <p className="text-[11px] text-[#8C8880] px-1">Sub-divisi tetap tampil walau belum ada personel — tugas pre/during/post berguna untuk rekrutmen.</p>
          )}
        </div>
        </DetailSection>

        <DetailSection
          id="pendaftar"
          title="Pendaftar"
          summary="daftar kehadiran"
          open={openSecs.pendaftar}
          onToggle={() => toggleSec('pendaftar')}
        >
          <EventAttendeesBlock eventId={selected.id} slug={selected.slug || selected.id} />
        </DetailSection>

        <DetailSection
          id="penatalayan"
          title="Penatalayan & Liturgi"
          summary={readiness.tapisanCount != null ? `${readiness.tapisanCount} penugasan` : 'jadwal petugas'}
          open={openSecs.penatalayan}
          onToggle={() => toggleSec('penatalayan')}
        >
          <EventPenatalayanPanel eventId={selected.id} canEdit={canCreateEvent} />
        </DetailSection>

        <DetailSection
          id="rapat"
          title="Rapat & Jadwal"
          summary={`${(selected.meetings || []).length} rapat`}
          open={openSecs.rapat}
          onToggle={() => toggleSec('rapat')}
        >
        {/* Meetings */}
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowMeetingForm(!showMeetingForm)}
              className="text-xs px-3 py-1.5 rounded-xl bg-[#181818] text-white font-bold hover:bg-[#333] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Tambah
            </button>
          </div>
          {showMeetingForm && (
            <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => void fillRepDay()} disabled={posting} className="text-[11px] px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold hover:bg-indigo-100 disabled:opacity-50">
                  📋 Isi template Representative Day
                </button>
              </div>
              <input type="text" placeholder="Judul rapat" value={meetingForm.title} onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-brand" />
              <input type="datetime-local" value={meetingForm.scheduledAt} onChange={(e) => setMeetingForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-brand" />
              <input type="text" placeholder="Link Google Meet (opsional)" value={meetingForm.gmeetLink} onChange={(e) => setMeetingForm((f) => ({ ...f, gmeetLink: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-brand" />
              <textarea placeholder="Catatan (opsional)" value={meetingForm.notes} onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-brand min-h-[60px]" />
              <label className="flex items-center gap-2 text-xs font-semibold text-[#5C5850]">
                <input type="checkbox" checked={meetingForm.isJoint} onChange={(e) => setMeetingForm((f) => ({ ...f, isJoint: e.target.checked }))} className="w-4 h-4 rounded border-[#D9D7D0]" />
                Rapat Petugas Ibadah (gabungan semua divisi)
              </label>
              <textarea placeholder="Agenda petugas — satu per baris: Judul | PIC | deadline" value={meetingForm.agendaText} onChange={(e) => setMeetingForm((f) => ({ ...f, agendaText: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-brand min-h-[60px]" />
              <textarea placeholder="Peserta (satu nama per baris)" value={meetingForm.attendeesText} onChange={(e) => setMeetingForm((f) => ({ ...f, attendeesText: e.target.value }))} className="w-full text-sm px-4 py-2.5 rounded-xl border border-[#D9D7D0] focus:outline-none focus:ring-1 focus:ring-brand min-h-[50px]" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMeetingForm(false)} className="text-xs px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">Batal</button>
                <button onClick={addMeeting} disabled={!meetingForm.title || !meetingForm.scheduledAt || posting} className="text-xs px-4 py-2 rounded-xl bg-brand text-white font-bold disabled:opacity-40 hover:bg-brand/90">
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
                  <p className="text-sm font-bold text-[#1B1B1B] truncate">
                    {m.title}
                    {!m.division && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Petugas Ibadah</span>}
                  </p>
                  <p className="text-xs text-[#8C8880]">{formatDate(m.scheduledAt)}</p>
                  {(m.agenda?.length || m.attendees?.length) ? (
                    <p className="text-[10px] text-[#8C8880]">
                      {m.agenda?.length ? `${m.agenda.length} agenda` : ''}
                      {m.agenda?.length && m.attendees?.length ? ' · ' : ''}
                      {m.attendees?.length ? `${m.attendees.length} peserta` : ''}
                    </p>
                  ) : null}
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
        </DetailSection>
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
            onClick={() => setShowCreate((v) => {
              const next = !v;
              if (next) {
                setCreateForm((f) => ({
                  ...f,
                  whatsappGroupUrl: f.whatsappGroupUrl || churchDefaults.whatsappGroupUrl,
                }));
              }
              return next;
            })}
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
          { id: 'ibadah' as ListTab, label: ev.tabIbadah },
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
      {listTab === 'ibadah' && <ServicePlanPanel />}
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
                <div>
                  <select
                    value={createForm.kind}
                    onChange={(e) => setCreateForm((f) => ({ ...f, kind: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-[#FAF9F5]"
                    title={EVENT_KINDS.find((k) => k.id === createForm.kind)?.tooltip || ''}
                  >
                    {EVENT_KINDS.map((k) => <option key={k.id} value={k.id} title={k.tooltip}>{k.label}</option>)}
                  </select>
                  <p className="text-[10px] text-[#8C8880] mt-1">{EVENT_KINDS.find((k) => k.id === createForm.kind)?.tooltip}</p>
                </div>
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
                <button type="submit" disabled={creating || !createForm.name.trim() || createForm.divisions.length === 0} className="text-xs px-3 py-2 rounded-xl bg-brand text-white font-bold disabled:opacity-40">
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
                  className="text-left rounded-2xl border border-[#D9D7D0] bg-white p-5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="text-sm font-black text-[#1B1B1B] group-hover:text-brand transition-colors line-clamp-1 flex-1">{ev.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${statusColor(ev.status)}`}>
                      {ev.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {ev.serviceType && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${serviceTypeColor(ev.serviceType)}`}>{ev.serviceType === 'MENTORING_DAY' ? 'M' : ev.serviceType === 'SERVING_DAY' ? 'S' : ev.serviceType}</span>}
                    {ev.churchProgram && <span className="text-[10px] font-bold text-[#8C8880]">{ev.churchProgram.name}</span>}
                  </div>
                  {ev.description && <p className="text-xs text-[#8C8880] line-clamp-2 mb-3">{ev.description}</p>}
                  <div className="flex flex-wrap gap-3 text-[11px] text-[#8C8880]">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(ev.startDate)}{ev.eventDate ? ` · ${formatDateTimeWib(ev.eventDate)} WIB` : ''}</span>
                    <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" /> {ev.divisions.length} divisi</span>
                    {ev.kind && <span className="font-bold" title={eventKindLabel(ev.kind)}>{eventKindLabel(ev.kind)}</span>}
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

