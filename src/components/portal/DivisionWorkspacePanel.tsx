import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { PANTATUGAS, BENZARPR_ENUM, pillarByName } from '../../lib/pantatugas';
import {
  Users,
  FolderOpen,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Shield,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
  History,
  UserPlus,
  Crown,
  Eye,
  Edit2,
  X,
} from 'lucide-react';
import { MentionInput, renderMentionText } from '../ui/MentionInput';

const ALL_DIVISIONS = [...PANTATUGAS.map((p) => p.name), BENZARPR_ENUM];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  IN_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  PUBLISHED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

const ROLE_LABELS: Record<string, string> = {
  LEAD: 'Ketua Divisi',
  CO_LEAD: 'Wakil Ketua',
  MEMBER: 'Anggota',
  VIEWER: 'Pengamat',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  LEAD: <Crown className="w-3.5 h-3.5" />,
  CO_LEAD: <Shield className="w-3.5 h-3.5" />,
  MEMBER: <Users className="w-3.5 h-3.5" />,
  VIEWER: <Eye className="w-3.5 h-3.5" />,
};

interface DivisionRecord {
  id: string;
  eventId: string;
  division: string;
  driveFolderId?: string;
  approvalStatus: string;
  approvedById?: string;
  approvedAt?: string;
  rejectReason?: string;
  publishedAt?: string;
  contentItemId?: string;
  createdAt: string;
}

interface DivisionMember {
  id: string;
  eventDivisionId: string;
  userId: string;
  role: string;
  createdAt: string;
}

interface ApprovalLog {
  id: string;
  action: string;
  actorId: string;
  actorRole: string;
  comment?: string;
  createdAt: string;
}

interface EventItem {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: string;
  divisions: DivisionRecord[];
}

type DetailTab = 'overview' | 'members' | 'discussions' | 'drive';

export const DivisionWorkspacePanel: React.FC = () => {
  const { addToast, authUser } = useApp();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedDiv, setSelectedDiv] = useState<string>(ALL_DIVISIONS[0]);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  // Division members
  const [members, setMembers] = useState<DivisionMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Approval logs
  const [logs, setLogs] = useState<ApprovalLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Discussion threads
  interface DiscussionPost {
    id: string;
    authorId: string;
    authorName: string;
    body: string;
    parentUpdateId?: string;
    createdAt: string;
    replies?: DiscussionPost[];
  }
  const [discussions, setDiscussions] = useState<DiscussionPost[]>([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/events', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setEvents(d.events || []);
      if (d.events?.length && !selectedEvent) {
        setSelectedEvent(d.events[0]);
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal memuat event', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedEvent]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const currentDiv = selectedEvent?.divisions?.find(
    (d) => d.division === selectedDiv
  );

  const pillarMeta = pillarByName(selectedDiv);
  const divColor = pillarMeta?.color || '#6B7280';

  // Fetch division members
  const fetchMembers = useCallback(async () => {
    if (!selectedEvent || !currentDiv) return;
    setMembersLoading(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/members`,
        { credentials: 'include' }
      );
      if (r.ok) {
        const d = await r.json();
        setMembers(d.members || []);
      }
    } catch { /* skip */ }
    finally { setMembersLoading(false); }
  }, [selectedEvent, currentDiv, selectedDiv]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Fetch approval logs
  const fetchLogs = useCallback(async () => {
    if (!selectedEvent || !currentDiv) return;
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/approval-logs`,
        { credentials: 'include' }
      );
      if (r.ok) {
        const d = await r.json();
        setLogs(d.logs || []);
      }
    } catch { /* skip */ }
  }, [selectedEvent, currentDiv, selectedDiv]);

  // Fetch discussions
  const fetchDiscussions = useCallback(async () => {
    if (!selectedEvent || !currentDiv) return;
    setDiscussionsLoading(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/updates`,
        { credentials: 'include' }
      );
      if (r.ok) {
        const d = await r.json();
        setDiscussions(d.updates || []);
      }
    } catch { /* skip */ }
    finally { setDiscussionsLoading(false); }
  }, [selectedEvent, currentDiv, selectedDiv]);

  useEffect(() => { fetchDiscussions(); }, [fetchDiscussions]);

  // Post new discussion
  const handlePost = async () => {
    if (!selectedEvent || !currentDiv || !newPost.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/updates`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: newPost.trim() }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setNewPost('');
      addToast({ type: 'success', title: 'Pesan terkirim' });
      await fetchDiscussions();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal mengirim', description: e.message });
    } finally {
      setPosting(false);
    }
  };

  // Post reply
  const handleReply = async (parentId: string) => {
    if (!selectedEvent || !currentDiv || !replyBody.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/updates`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: replyBody.trim(), parentUpdateId: parentId }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setReplyBody('');
      setReplyTo(null);
      addToast({ type: 'success', title: 'Balasan terkirim' });
      await fetchDiscussions();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal membalas', description: e.message });
    } finally {
      setPosting(false);
    }
  };

  // Action: Submit for review
  const handleSubmit = async () => {
    if (!selectedEvent || !currentDiv) return;
    setActionLoading(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/submit`,
        { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Berhasil disubmit untuk review' });
      await fetchEvents();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal submit', description: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Approve
  const handleApprove = async () => {
    if (!selectedEvent || !currentDiv) return;
    setActionLoading(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/approve`,
        { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Divisi disetujui' });
      await fetchEvents();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal approve', description: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Reject
  const handleReject = async () => {
    if (!selectedEvent || !currentDiv) return;
    setActionLoading(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Divisi ditolak' });
      setShowRejectModal(false);
      setRejectReason('');
      await fetchEvents();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal reject', description: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Publish
  const handlePublish = async () => {
    if (!selectedEvent || !currentDiv) return;
    setActionLoading(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/publish`,
        { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Divisi dipublish ke website' });
      await fetchEvents();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal publish', description: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Open logs modal
  const openLogs = async () => {
    await fetchLogs();
    setShowLogs(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#8C8880]" />
        <span className="ml-3 text-sm text-[#8C8880]">Memuat workspace divisi...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <Users className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Division Workspace
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Panel Divisi
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Kelola program, approval workflow, dan tim per divisi.
          </p>
        </div>
      </div>

      {/* Event Selector */}
      {events.length > 0 && (
        <div className="bg-white rounded-[32px] p-6 border border-[#D9D7D0]/50 shadow-sm">
          <label className="text-xs font-semibold text-[#8C8880] uppercase tracking-wider mb-2 block">
            Program / Event
          </label>
          <select
            value={selectedEvent?.id || ''}
            onChange={(e) => {
              const ev = events.find((x) => x.id === e.target.value);
              setSelectedEvent(ev || null);
            }}
            className="w-full max-w-md px-4 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 6 Division Tabs */}
      <div className="bg-white rounded-[32px] p-6 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_DIVISIONS.map((div) => {
            const meta = pillarByName(div);
            const divRec = selectedEvent?.divisions?.find((d) => d.division === div);
            const status = divRec?.approvalStatus || 'DRAFT';
            const colors = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
            const isActive = selectedDiv === div;

            return (
              <button
                key={div}
                onClick={() => { setSelectedDiv(div); setDetailTab('overview'); }}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'text-white shadow-lg'
                    : 'bg-[#FAF9F5] text-[#8C8880] hover:bg-gray-100 border border-[#D9D7D0]'
                }`}
                style={isActive ? { backgroundColor: meta?.color || '#1B1B1B' } : undefined}
              >
                {meta && <meta.icon className="w-4 h-4" />}
                <span>{meta?.label || div}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : `${colors.bg} ${colors.text}`
                }`}>
                  {status}
                </span>
              </button>
            );
          })}
        </div>

        {/* Division Detail */}
        {currentDiv && (
          <div className="space-y-6">
            {/* Status Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border"
              style={{ borderColor: divColor + '30', backgroundColor: divColor + '08' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: divColor + '20' }}>
                  {pillarMeta && <pillarMeta.icon className="w-5 h-5" style={{ color: divColor }} />}
                </div>
                <div>
                  <h3 className="font-bold text-[#1B1B1B]">{pillarMeta?.label || selectedDiv}</h3>
                  <p className="text-xs text-[#8C8880]">{pillarMeta?.tagline}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  STATUS_COLORS[currentDiv.approvalStatus]?.bg || 'bg-gray-100'
                } ${STATUS_COLORS[currentDiv.approvalStatus]?.text || 'text-gray-700'} ${
                  STATUS_COLORS[currentDiv.approvalStatus]?.border || 'border-gray-200'
                }`}>
                  {currentDiv.approvalStatus}
                </span>

                {currentDiv.publishedAt && (
                  <span className="text-xs text-[#8C8880]">
                    Published {new Date(currentDiv.publishedAt).toLocaleDateString('id-ID')}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Submit for review */}
              {(currentDiv.approvalStatus === 'DRAFT' || currentDiv.approvalStatus === 'REJECTED') && (
                <button
                  onClick={handleSubmit}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit for Review
                </button>
              )}

              {/* Approve */}
              {currentDiv.approvalStatus === 'IN_REVIEW' && (
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve
                </button>
              )}

              {/* Reject */}
              {currentDiv.approvalStatus === 'IN_REVIEW' && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              )}

              {/* Publish */}
              {currentDiv.approvalStatus === 'APPROVED' && (
                <button
                  onClick={handlePublish}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Publish to Website
                </button>
              )}

              {/* View Logs */}
              <button
                onClick={openLogs}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-semibold text-[#8C8880] hover:bg-gray-100 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Riwayat
              </button>

              {/* Drive Link */}
              {currentDiv.driveFolderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${currentDiv.driveFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-semibold text-[#8C8880] hover:bg-gray-100 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Drive Folder
                </a>
              )}
            </div>

            {/* Sub-tabs: Overview | Members | Discussions | Drive */}
            <div className="flex gap-1 p-1 bg-[#FAF9F5] rounded-xl border border-[#D9D7D0]">
              {([
                { id: 'overview' as DetailTab, label: 'Ringkasan', icon: <ChevronRight className="w-3.5 h-3.5" /> },
                { id: 'members' as DetailTab, label: 'Anggota', icon: <Users className="w-3.5 h-3.5" /> },
                { id: 'discussions' as DetailTab, label: 'Diskusi', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                { id: 'drive' as DetailTab, label: 'Drive', icon: <FolderOpen className="w-3.5 h-3.5" /> },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    detailTab === tab.id
                      ? 'bg-white text-[#1B1B1B] shadow-sm'
                      : 'text-[#8C8880] hover:text-[#1B1B1B]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {detailTab === 'overview' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]">
                  <h4 className="text-xs font-bold text-[#8C8880] uppercase tracking-wider mb-2">Program</h4>
                  <p className="text-sm font-semibold text-[#1B1B1B]">{selectedEvent?.name}</p>
                  {selectedEvent?.description && (
                    <p className="text-xs text-[#8C8880] mt-1">{selectedEvent.description}</p>
                  )}
                </div>

                {currentDiv.approvalStatus === 'REJECTED' && currentDiv.rejectReason && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Alasan Penolakan</h4>
                    <p className="text-sm text-red-600">{currentDiv.rejectReason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-[#D9D7D0]">
                    <p className="text-[10px] font-bold text-[#8C8880] uppercase">Status</p>
                    <p className="text-sm font-bold text-[#1B1B1B] mt-1">{currentDiv.approvalStatus}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#D9D7D0]">
                    <p className="text-[10px] font-bold text-[#8C8880] uppercase">Anggota</p>
                    <p className="text-sm font-bold text-[#1B1B1B] mt-1">{members.length}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#D9D7D0]">
                    <p className="text-[10px] font-bold text-[#8C8880] uppercase">Dibuat</p>
                    <p className="text-sm font-bold text-[#1B1B1B] mt-1">
                      {new Date(currentDiv.createdAt).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#D9D7D0]">
                    <p className="text-[10px] font-bold text-[#8C8880] uppercase">Approved</p>
                    <p className="text-sm font-bold text-[#1B1B1B] mt-1">
                      {currentDiv.approvedAt
                        ? new Date(currentDiv.approvedAt).toLocaleDateString('id-ID')
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'members' && (
              <div className="space-y-4">
                {membersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[#8C8880]" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[#8C8880]">
                    Belum ada anggota divisi ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white border border-[#D9D7D0] flex items-center justify-center text-xs font-bold text-[#8C8880]">
                            {ROLE_ICONS[m.role] || <Users className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#1B1B1B]">{m.userId}</p>
                            <p className="text-[10px] text-[#8C8880]">{ROLE_LABELS[m.role] || m.role}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'discussions' && (
              <div className="space-y-4">
                {/* Post input */}
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1B1B1B] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(authUser?.name || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1">
                    <MentionInput
                      value={newPost}
                      onChange={setNewPost}
                      onSubmit={handlePost}
                      placeholder="Tulis pesan atau update progres... Ketik @ untuk mention orang."
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black resize-none h-20"
                      disabled={posting}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-[10px] text-[#8C8880]">Ctrl+Enter untuk kirim, ketik @ untuk mention</p>
                      <button
                        onClick={handlePost}
                        disabled={posting || !newPost.trim()}
                        className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold hover:bg-black transition-colors disabled:opacity-50"
                      >
                        {posting ? 'Mengirim...' : 'Kirim'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Discussion thread */}
                {discussionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[#8C8880]" />
                  </div>
                ) : discussions.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[#8C8880]">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#D9D7D0]" />
                    <p>Belum ada diskusi. Mulai percakapan pertama!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {discussions.map((post) => (
                      <div key={post.id} className="space-y-3">
                        {/* Main post */}
                        <div className="flex gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#D9D7D0] flex items-center justify-center text-[#8C8880] text-xs font-bold shrink-0">
                            {(post.authorName || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-bold text-[#1B1B1B]">{post.authorName}</span>
                              <span className="text-[10px] text-[#8C8880]">
                                {new Date(post.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-[#1B1B1B] mt-1 whitespace-pre-wrap">{renderMentionText(post.body)}</p>
                            <button
                              onClick={() => { setReplyTo(post.id); setReplyBody(''); }}
                              className="text-[10px] text-[#8C8880] hover:text-[#1B1B1B] mt-1 font-semibold"
                            >
                              Balas
                            </button>

                            {/* Reply input */}
                            {replyTo === post.id && (
                              <div className="mt-3 flex gap-2">
                                <input
                                  type="text"
                                  value={replyBody}
                                  onChange={(e) => setReplyBody(e.target.value)}
                                  placeholder="Tulis balasan..."
                                  className="flex-1 px-3 py-2 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleReply(post.id);
                                    if (e.key === 'Escape') setReplyTo(null);
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleReply(post.id)}
                                  disabled={posting || !replyBody.trim()}
                                  className="px-3 py-2 rounded-lg bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50"
                                >
                                  Kirim
                                </button>
                                <button
                                  onClick={() => setReplyTo(null)}
                                  className="px-3 py-2 rounded-lg text-xs text-[#8C8880] hover:bg-gray-100"
                                >
                                  Batal
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Replies */}
                        {post.replies && post.replies.length > 0 && (
                          <div className="ml-12 space-y-3 border-l-2 border-[#D9D7D0] pl-4">
                            {post.replies.map((reply) => (
                              <div key={reply.id} className="flex gap-3">
                                <div className="w-7 h-7 rounded-full bg-[#D9D7D0] flex items-center justify-center text-[#8C8880] text-[10px] font-bold shrink-0">
                                  {(reply.authorName || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                                </div>
                                <div>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[11px] font-bold text-[#1B1B1B]">{reply.authorName}</span>
                                    <span className="text-[10px] text-[#8C8880]">
                                      {new Date(reply.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#1B1B1B] mt-0.5 whitespace-pre-wrap">{renderMentionText(reply.body)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'drive' && (
              <div className="text-center py-8 text-sm text-[#8C8880]">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 text-[#D9D7D0]" />
                <p>Drive folder browser — coming soon di Phase 3.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">Tolak Divisi</h3>
              <button onClick={() => setShowRejectModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan (opsional)..."
              className="w-full px-4 py-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-red-400 resize-none h-24"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8C8880] hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading ? 'Memproses...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">Riwayat Approval</h3>
              <button onClick={() => setShowLogs(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {logs.length === 0 ? (
                <p className="text-sm text-[#8C8880] text-center py-4">Belum ada riwayat.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1B1B1B]">{log.action}</span>
                      <span className="text-[10px] text-[#8C8880]">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8C8880] mt-1">
                      Oleh: {log.actorId} ({log.actorRole})
                    </p>
                    {log.comment && (
                      <p className="text-xs text-[#8C8880] mt-1 italic">"{log.comment}"</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
