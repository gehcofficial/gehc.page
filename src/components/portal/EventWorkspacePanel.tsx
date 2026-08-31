import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  FolderOpen,
  MessageSquare,
  Clock,
  Plus,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

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
  createdById: string;
  createdAt: string;
  divisions: EventDivision[];
  meetings?: EventMeeting[];
}

type ViewMode = 'list' | 'detail';

const EventAttendeesBlock: React.FC<{ slug: string }> = ({ slug }) => {
  const [rows, setRows] = useState<{ id: string; user?: { name: string; email: string; phone?: string } }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/attendees`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRows(d.attendees || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[#1B1B1B]">Kehadiran Event ({rows.length})</h3>
      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#8C8880]">Belum ada peserta dengan akun terhubung.</p>
      ) : (
        <div className="rounded-2xl border border-[#D9D7D0] bg-white divide-y divide-[#D9D7D0]/60 max-h-64 overflow-y-auto">
          {rows.map((row) => (
            <div key={row.id} className="px-4 py-2.5 text-xs">
              <p className="font-bold text-[#1B1B1B]">{row.user?.name || '—'}</p>
              <p className="text-[#8C8880]">{row.user?.email}{row.user?.phone ? ` · ${row.user.phone}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const EventWorkspacePanel: React.FC = () => {
  const { addToast, authUser } = useApp();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Discussions per division
  const [discussions, setDiscussions] = useState<Record<string, any[]>>({});
  const [newPost, setNewPost] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);

  // Meetings
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', scheduledAt: '', gmeetLink: '', notes: '' });

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

  const openDetail = async (ev: EventItem) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/events/${ev.id}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSelected(d.event);
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
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-black text-[#1B1B1B] truncate">{selected.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusColor(selected.status)}`}>
                {selected.status}
              </span>
            </div>
            {selected.description && <p className="text-sm text-[#8C8880] mb-2">{selected.description}</p>}
            <div className="flex flex-wrap gap-4 text-xs text-[#8C8880]">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(selected.startDate)} — {formatDate(selected.endDate)}</span>
              <span className="flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" /> {selected.divisions.length} divisi</span>
              <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {(selected.meetings || []).length} rapat</span>
            </div>
          </div>
        </div>

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
                    <span className="font-semibold text-[#1B1B1B]">{u.authorId}</span>: {u.body}
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
        {(selected.slug === 'bakutau' || selected.slug === 'baku-tau-4-0') && (
          <EventAttendeesBlock slug="bakutau" />
        )}

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#1B1B1B]">Program & Event</h2>
          <p className="text-xs text-[#8C8880] mt-0.5">Daftar program kerja, event, dan kegiatan komisi.</p>
        </div>
      </div>

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
              {ev.description && <p className="text-xs text-[#8C8880] line-clamp-2 mb-3">{ev.description}</p>}
              <div className="flex flex-wrap gap-3 text-[11px] text-[#8C8880]">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(ev.startDate)}</span>
                <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" /> {ev.divisions.length} divisi</span>
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
    </div>
  );
};
