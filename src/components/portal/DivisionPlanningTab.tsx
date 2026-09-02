import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Check,
  Clock,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  X,
  Loader2,
} from 'lucide-react';
import type { DivisionMeeting, DivisionAgendaItem } from '../../types/penatalayan';
import { MEETING_STATUS_LABELS, AGENDA_STATUS_LABELS, AGENDA_STATUS_COLORS } from '../../types/penatalayan';

interface Props {
  division: string;
}

const STATUS_FLOW = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;

export default function DivisionPlanningTab({ division }: Props) {
  const [meetings, setMeetings] = useState<DivisionMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [showAgendaModal, setShowAgendaModal] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      const r = await fetch(`/api/division-meetings?division=${division}`, { credentials: 'include' });
      const d = await r.json();
      setMeetings(d.meetings || []);
    } catch { /* skip */ }
  }, [division]);

  useEffect(() => {
    setLoading(true);
    fetchMeetings().finally(() => setLoading(false));
  }, [fetchMeetings]);

  const handleUpdateMeetingStatus = async (meetingId: string, status: string) => {
    await fetch(`/api/division-meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    fetchMeetings();
  };

  const handleUpdateAgendaStatus = async (agendaId: string, status: string) => {
    await fetch(`/api/division-meetings/agenda/${agendaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    fetchMeetings();
  };

  const planMeetings = meetings.filter(m => m.status === 'PLANNED');
  const activeMeetings = meetings.filter(m => m.status === 'IN_PROGRESS');
  const doneMeetings = meetings.filter(m => m.status === 'DONE');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#F6AE4A]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-[#1B1B1B]">Rencana & Rapat Divisi</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 bg-[#F6AE4A] text-[#1B1B1B] px-3 py-1.5 rounded-xl text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" /> Rapat Baru
        </button>
      </div>

      {/* Meeting Sections */}
      {meetings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-8 text-center">
          <Calendar className="w-10 h-10 text-[#D9D7D0] mx-auto mb-3" />
          <p className="text-sm text-[#8C8880]">Belum ada rapat divisi.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 text-xs font-bold text-[#F6AE4A] hover:underline"
          >
            Buat rapat pertama →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active / Planned Meetings */}
          {[...activeMeetings, ...planMeetings].map(meeting => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              expanded={expandedMeeting === meeting.id}
              onToggle={() => setExpandedMeeting(expandedMeeting === meeting.id ? null : meeting.id)}
              onStatusChange={handleUpdateMeetingStatus}
              onAgendaStatusChange={handleUpdateAgendaStatus}
              onAddAgenda={() => setShowAgendaModal(meeting.id)}
            />
          ))}

          {/* Completed Meetings */}
          {doneMeetings.length > 0 && (
            <details className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-xs font-bold text-[#8C8880] hover:text-[#1B1B1B]">
                Selesai ({doneMeetings.length} rapat)
              </summary>
              <div className="px-4 pb-4 space-y-3">
                {doneMeetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    expanded={false}
                    onToggle={() => {}}
                    onStatusChange={handleUpdateMeetingStatus}
                    onAgendaStatusChange={handleUpdateAgendaStatus}
                    onAddAgenda={() => {}}
                    compact
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <CreateMeetingModal
          division={division}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); fetchMeetings(); }}
        />
      )}

      {/* Add Agenda Modal */}
      {showAgendaModal && (
        <AddAgendaModal
          meetingId={showAgendaModal}
          division={division}
          onClose={() => setShowAgendaModal(null)}
          onSaved={() => { setShowAgendaModal(null); fetchMeetings(); }}
        />
      )}
    </div>
  );
}

// Meeting Card Component
type MeetingCardProps = {
  meeting: DivisionMeeting;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  onAgendaStatusChange: (agendaId: string, status: string) => void;
  onAddAgenda: () => void;
  compact?: boolean;
};

const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  expanded,
  onToggle,
  onStatusChange,
  onAgendaStatusChange,
  onAddAgenda,
  compact,
}) => {
  const agendaItems = meeting.agendaItems || [];
  const statusColor = meeting.status === 'DONE' ? 'bg-green-100 text-green-700' :
    meeting.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className={`bg-white rounded-2xl border ${compact ? 'border-[#D9D7D0]/30' : 'border-[#D9D7D0]/50'} overflow-hidden`}>
      {/* Meeting Header */}
      <div className="px-4 py-3 cursor-pointer hover:bg-[#FAF9F5] transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold ${
              meeting.status === 'DONE' ? 'bg-green-400' : meeting.status === 'IN_PROGRESS' ? 'bg-yellow-400' : 'bg-gray-400'
            }`}>
              {meeting.agendaItems?.length || 0}
            </div>
            <div>
              <p className="text-sm font-bold">{meeting.title || 'Rapat Divisi'}</p>
              <p className="text-[10px] text-[#8C8880]">
                {new Date(meeting.meetingDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor}`}>
              {MEETING_STATUS_LABELS[meeting.status]}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-[#8C8880]" /> : <ChevronDown className="w-4 h-4 text-[#8C8880]" />}
          </div>
        </div>
      </div>

      {/* Expanded Agenda Board */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#D9D7D0]/30">
          {/* Status buttons */}
          {meeting.status !== 'DONE' && (
            <div className="flex gap-2 mt-3 mb-4">
              {STATUS_FLOW.map(status => (
                <button
                  key={status}
                  onClick={() => onStatusChange(meeting.id, status)}
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-xl transition-colors ${
                    meeting.status === status
                      ? 'bg-[#1B1B1B] text-white'
                      : 'bg-[#FAF9F5] text-[#8C8880] hover:bg-gray-200'
                  }`}
                >
                  {AGENDA_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}

          {/* Agenda Items by Status */}
          {agendaItems.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-[#8C8880] mb-2">Belum ada agenda.</p>
              <button onClick={onAddAgenda} className="text-xs font-bold text-[#F6AE4A] hover:underline">
                + Tambah agenda
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Group by status */}
              {STATUS_FLOW.map(status => {
                const items = agendaItems.filter(a => a.status === status);
                if (items.length === 0) return null;
                return (
                  <div key={status}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-2">
                      {AGENDA_STATUS_LABELS[status]} ({items.length})
                    </p>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-[#FAF9F5] rounded-xl">
                          <GripVertical className="w-3.5 h-3.5 text-[#D9D7D0] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.component && (
                                <span className="text-[9px] bg-[#1B1B1B] text-white px-1.5 py-0.5 rounded-full">
                                  {item.component}
                                </span>
                              )}
                              {item.deadline && (
                                <span className="text-[9px] text-[#8C8880]">
                                  deadline: {new Date(item.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {/* Next status button */}
                            {status !== 'DONE' && (
                              <button
                                onClick={() => {
                                  const nextIdx = STATUS_FLOW.indexOf(status as typeof STATUS_FLOW[number]) + 1;
                                  if (nextIdx < STATUS_FLOW.length) onAgendaStatusChange(item.id, STATUS_FLOW[nextIdx]);
                                }}
                                className="p-1.5 rounded-lg hover:bg-white"
                                title="Next status"
                              >
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              </button>
                            )}
                            {item.driveFolderId && (
                              <a
                                href={`https://drive.google.com/drive/folders/${item.driveFolderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-white"
                                title="Buka Drive"
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <button onClick={onAddAgenda} className="w-full py-2 text-xs font-bold text-[#F6AE4A] hover:bg-[#FAF9F5] rounded-xl">
                + Tambah agenda
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Create Meeting Modal
function CreateMeetingModal({ division, onClose, onSaved }: {
  division: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    meetingDate: new Date().toISOString().split('T')[0],
    agendaTopic: '',
    agendaLead: '',
    agendaOutput: '',
    agendaDeadline: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.meetingDate) return;
    setSaving(true);
    try {
      // Create meeting
      const r = await fetch('/api/division-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          division,
          meetingDate: form.meetingDate,
          title: form.title || `Rapat ${division}`,
          agenda: form.agendaTopic ? [{ topic: form.agendaTopic, lead: form.agendaLead, output: form.agendaOutput, deadline: form.agendaDeadline }] : [],
        }),
      });
      const d = await r.json();

      // Add first agenda item if provided
      if (d.meeting?.id && form.agendaTopic) {
        await fetch(`/api/division-meetings/${d.meeting.id}/agenda`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: form.agendaTopic,
            division,
            component: 'Rundown',
            deadline: form.agendaDeadline || undefined,
          }),
        });
      }

      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">Rapat Baru — {division}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Judul Rapat</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Rapat Persiapan Ibadah Minggu"
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Tanggal Rapat</label>
            <input type="date" value={form.meetingDate} onChange={e => setForm({ ...form, meetingDate: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
          </div>
          <div className="pt-2 border-t border-[#D9D7D0]/30">
            <p className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-2">Agenda Pertama (opsional)</p>
            <input value={form.agendaTopic} onChange={e => setForm({ ...form, agendaTopic: e.target.value })}
              placeholder="Topik agenda..."
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm mb-2" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.agendaLead} onChange={e => setForm({ ...form, agendaLead: e.target.value })}
                placeholder="PIC (opsional)"
                className="px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
              <input type="date" value={form.agendaDeadline} onChange={e => setForm({ ...form, agendaDeadline: e.target.value })}
                className="px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Buat Rapat'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Agenda Modal
function AddAgendaModal({ meetingId, division, onClose, onSaved }: {
  meetingId: string;
  division: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ title: '', description: '', component: '', deadline: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      await fetch(`/api/division-meetings/${meetingId}/agenda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          division,
          component: form.component || undefined,
          deadline: form.deadline || undefined,
        }),
      });
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">Tambah Agenda</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Judul Agenda</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Rundown Ibadah, Desain Banner"
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Deskripsi</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Detail tambahan..."
              className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Komponen</label>
              <select value={form.component} onChange={e => setForm({ ...form, component: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm">
                <option value="">Pilih...</option>
                <option value="Rundown">Rundown</option>
                <option value="Dokumen">Dokumen</option>
                <option value="Multimedia">Multimedia</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8C8880] mb-1 block">Deadline</label>
              <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold">Batal</button>
          <button onClick={handleSubmit} disabled={saving || !form.title}
            className="flex-1 py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Tambah'}
          </button>
        </div>
      </div>
    </div>
  );
}
