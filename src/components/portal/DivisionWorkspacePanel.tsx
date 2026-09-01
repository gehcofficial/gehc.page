import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { PANTATUGAS, pillarByName } from '../../lib/pantatugas';
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
  FileText,
  Video,
  CalendarPlus,
  Calendar,
  ClipboardList,
  Download,
  Store,
  Image,
  Newspaper,
} from 'lucide-react';
import BenzarStoreTab from './BenzarStoreTab';
import PenatalayanCalendar from './PenatalayanCalendar';
import DivisionPlanningTab from './DivisionPlanningTab';
import WartaPublikTab from './WartaPublikTab';
import EventGalleryTab from './EventGalleryTab';
import { MentionInput, renderMentionText } from '../ui/MentionInput';

const ALL_DIVISIONS = PANTATUGAS.map((p) => p.name);

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

type DetailTab = 'overview' | 'members' | 'discussions' | 'drive' | 'store' | 'penatalayan' | 'planning' | 'warta' | 'gallery';

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

  // Members management
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  // Drive browser
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Meetings
  const [meetings, setMeetings] = useState<any[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', scheduledAt: '', gmeetLink: '', notes: '' });
  const [creatingMeeting, setCreatingMeeting] = useState(false);

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

  // Search users for adding to division
  const searchUsers = async (q: string) => {
    setMemberSearch(q);
    if (!q.trim()) { setMemberSearchResults([]); return; }
    setMemberSearchLoading(true);
    try {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setMemberSearchResults(d.users || []);
      }
    } catch { /* skip */ }
    finally { setMemberSearchLoading(false); }
  };

  // Add member to division
  const handleAddMember = async (userId: string) => {
    if (!selectedEvent || !currentDiv) return;
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/members`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role: memberRole }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Anggota ditambahkan' });
      setShowAddMember(false);
      setMemberSearch('');
      setMemberSearchResults([]);
      await fetchMembers();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal menambahkan', description: e.message });
    }
  };

  // Remove member from division
  const handleRemoveMember = async (userId: string) => {
    if (!selectedEvent || !currentDiv) return;
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/members/${userId}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Anggota dihapus' });
      setRemoveConfirm(null);
      await fetchMembers();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal menghapus', description: e.message });
    }
  };

  // Change member role
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!selectedEvent || !currentDiv) return;
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/members`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role: newRole }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Role diperbarui' });
      await fetchMembers();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal memperbarui role', description: e.message });
    }
  };

  // Fetch Drive files
  const fetchDrive = useCallback(async () => {
    if (!selectedEvent || !currentDiv) return;
    setDriveLoading(true);
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/drive`,
        { credentials: 'include' }
      );
      if (r.ok) {
        const d = await r.json();
        setDriveFiles(d.files || []);
        setDriveFolders(d.folders || []);
        setDriveFolderId(d.folderId);
      }
    } catch { /* skip */ }
    finally { setDriveLoading(false); }
  }, [selectedEvent, currentDiv, selectedDiv]);

  useEffect(() => { if (detailTab === 'drive') fetchDrive(); }, [detailTab, fetchDrive]);

  // Create folder
  const handleCreateFolder = async () => {
    if (!selectedEvent || !currentDiv || !newFolderName.trim()) return;
    try {
      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/drive/folder`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newFolderName.trim() }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Folder dibuat' });
      setShowCreateFolder(false);
      setNewFolderName('');
      await fetchDrive();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal membuat folder', description: e.message });
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!selectedEvent || !currentDiv || !uploadFile) return;
    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      const r = await fetch(
        `/api/events/${selectedEvent.id}/divisions/${selectedDiv}/drive/upload`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: uploadFile.name,
            mimetype: uploadFile.type,
            data: base64,
          }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'File berhasil diupload' });
      setShowUpload(false);
      setUploadFile(null);
      await fetchDrive();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal upload', description: e.message });
    } finally {
      setUploading(false);
    }
  };

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    if (!selectedEvent) return;
    setMeetingsLoading(true);
    try {
      const r = await fetch(`/api/events/${selectedEvent.id}`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        const allMeetings = d.event?.meetings || [];
        // Filter by division or show all for overview
        const divMeetings = allMeetings.filter((m: any) => !m.division || m.division === selectedDiv);
        setMeetings(divMeetings);
      }
    } catch { /* skip */ }
    finally { setMeetingsLoading(false); }
  }, [selectedEvent, selectedDiv]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  // Create meeting
  const handleCreateMeeting = async () => {
    if (!selectedEvent || !meetingForm.title || !meetingForm.scheduledAt) return;
    setCreatingMeeting(true);
    try {
      const r = await fetch(`/api/events/${selectedEvent.id}/meetings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...meetingForm,
          division: selectedDiv,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      addToast({ type: 'success', title: 'Rapat berhasil dibuat' });
      setShowMeetingForm(false);
      setMeetingForm({ title: '', scheduledAt: '', gmeetLink: '', notes: '' });
      await fetchMeetings();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal membuat rapat', description: e.message });
    } finally {
      setCreatingMeeting(false);
    }
  };

  // Generate .ics for a meeting
  const generateICS = (meeting: any) => {
    const dt = new Date(meeting.scheduledAt);
    const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000); // 1 hour
    const formatDT = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GEHC Youth//Division Meeting//ID',
      'BEGIN:VEVENT',
      `DTSTART:${formatDT(dt)}`,
      `DTEND:${formatDT(dtEnd)}`,
      `SUMMARY:${meeting.title}`,
      `DESCRIPTION:${meeting.notes || ''}`,
      meeting.gmeetLink ? `URL:${meeting.gmeetLink}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
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

            {/* Sub-tabs: Overview | Members | Discussions | Drive | Store (Benzarpreneurship only) */}
            <div className="flex gap-1 p-1 bg-[#FAF9F5] rounded-xl border border-[#D9D7D0]">
              {([
                { id: 'overview' as DetailTab, label: 'Ringkasan', icon: <ChevronRight className="w-3.5 h-3.5" /> },
                { id: 'members' as DetailTab, label: 'Anggota', icon: <Users className="w-3.5 h-3.5" /> },
                { id: 'discussions' as DetailTab, label: 'Diskusi', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                { id: 'drive' as DetailTab, label: 'Drive', icon: <FolderOpen className="w-3.5 h-3.5" /> },
                { id: 'planning' as DetailTab, label: 'Rencana', icon: <ClipboardList className="w-3.5 h-3.5" /> },
                ...(selectedDiv === 'DIDASKALIA' ? [{ id: 'warta' as DetailTab, label: 'Warta', icon: <Newspaper className="w-3.5 h-3.5" /> }] : []),
                ...(selectedDiv === 'MARTURIA' ? [{ id: 'gallery' as DetailTab, label: 'Galeri', icon: <Image className="w-3.5 h-3.5" /> }] : []),
                ...(selectedDiv === 'LITURGIA' ? [{ id: 'penatalayan' as DetailTab, label: 'Penatalayan', icon: <Calendar className="w-3.5 h-3.5" /> }] : []),
                ...(selectedDiv === 'BENZARPR' ? [{ id: 'store' as DetailTab, label: 'Benzarpreneurship', icon: <Store className="w-3.5 h-3.5" /> }] : []),
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
                    <p className="text-[10px] font-bold text-[#8C8880] uppercase">Diskusi</p>
                    <p className="text-sm font-bold text-[#1B1B1B] mt-1">{discussions.length}</p>
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

                {/* Recent Activity */}
                {discussions.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]">
                    <h4 className="text-xs font-bold text-[#8C8880] uppercase tracking-wider mb-3">Aktivitas Terakhir</h4>
                    <div className="space-y-2">
                      {discussions.slice(-3).reverse().map((post) => (
                        <div key={post.id} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FF416C] mt-1.5 shrink-0" />
                          <div>
                            <p className="text-xs text-[#1B1B1B]">{post.body.slice(0, 80)}{post.body.length > 80 ? '...' : ''}</p>
                            <p className="text-[10px] text-[#8C8880]">
                              {post.authorName} • {new Date(post.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meetings */}
                <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Rapat</h4>
                    <button
                      onClick={() => setShowMeetingForm(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1B1B1B] text-white text-[10px] font-bold hover:bg-black"
                    >
                      <CalendarPlus className="w-3 h-3" />
                      Buat Rapat
                    </button>
                  </div>
                  {meetingsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#8C8880]" />
                  ) : meetings.length === 0 ? (
                    <p className="text-xs text-[#8C8880]">Belum ada rapat.</p>
                  ) : (
                    <div className="space-y-2">
                      {meetings.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#D9D7D0]">
                          <div className="flex items-center gap-2">
                            <Video className="w-4 h-4 text-[#FF416C] shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-[#1B1B1B]">{m.title}</p>
                              <p className="text-[10px] text-[#8C8880]">
                                {new Date(m.scheduledAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {m.gmeetLink && (
                              <a href={m.gmeetLink} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-100">
                                <ExternalLink className="w-3 h-3 text-[#8C8880]" />
                              </a>
                            )}
                            <button onClick={() => generateICS(m)} className="p-1 rounded hover:bg-gray-100">
                              <Download className="w-3 h-3 text-[#8C8880]" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'members' && (
              <div className="space-y-4">
                {/* Add member button */}
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-[#8C8880]">
                    {members.length} Anggota
                  </p>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold hover:bg-black transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Tambah Anggota
                  </button>
                </div>

                {membersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[#8C8880]" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[#8C8880]">
                    <Users className="w-8 h-8 mx-auto mb-2 text-[#D9D7D0]" />
                    <p>Belum ada anggota divisi ini.</p>
                    <p className="text-xs mt-1">Klik "Tambah Anggota" untuk mulai.</p>
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
                        <div className="flex items-center gap-2">
                          {/* Role change dropdown */}
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                            className="px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] text-[10px] font-semibold text-[#8C8880] focus:outline-none focus:border-black"
                          >
                            <option value="LEAD">Ketua Divisi</option>
                            <option value="CO_LEAD">Wakil Ketua</option>
                            <option value="MEMBER">Anggota</option>
                            <option value="VIEWER">Pengamat</option>
                          </select>
                          {/* Remove button */}
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="p-1.5 rounded-lg text-[#8C8880] hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
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
              <div className="space-y-4">
                {/* Drive actions */}
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-[#8C8880]">
                    {driveFolders.length} Folder, {driveFiles.length} File
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-semibold text-[#8C8880] hover:bg-gray-100 transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Folder Baru
                    </button>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold hover:bg-black transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Upload
                    </button>
                  </div>
                </div>

                {!driveFolderId ? (
                  <div className="text-center py-8 text-sm text-[#8C8880]">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 text-[#D9D7D0]" />
                    <p>Belum ada folder Drive untuk divisi ini.</p>
                    <p className="text-xs mt-1">Hubungi admin untuk membuat folder Drive.</p>
                  </div>
                ) : driveLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[#8C8880]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Folders */}
                    {driveFolders.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider mb-2">Folder</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {driveFolders.map((f) => (
                            <div key={f.id} className="flex items-center gap-2 p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] hover:bg-gray-100 transition-colors cursor-pointer">
                              <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
                              <span className="text-xs font-semibold text-[#1B1B1B] truncate">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files */}
                    {driveFiles.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider mb-2">File</p>
                        <div className="space-y-2">
                          {driveFiles.map((f) => (
                            <a
                              key={f.id}
                              href={f.webViewLink || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] hover:bg-gray-100 transition-colors"
                            >
                              {f.thumbnailUrl ? (
                                <img src={f.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-white border border-[#D9D7D0] flex items-center justify-center shrink-0">
                                  <FileText className="w-5 h-5 text-[#8C8880]" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#1B1B1B] truncate">{f.name}</p>
                                <p className="text-[10px] text-[#8C8880]">
                                  {f.createdTime ? new Date(f.createdTime).toLocaleDateString('id-ID') : ''}
                                </p>
                              </div>
                              <ExternalLink className="w-4 h-4 text-[#8C8880] shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {driveFolders.length === 0 && driveFiles.length === 0 && (
                      <div className="text-center py-8 text-sm text-[#8C8880]">
                        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-[#D9D7D0]" />
                        <p>Folder kosong.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Planning Tab (all divisions) */}
            {detailTab === 'planning' && (
              <div>
                <DivisionPlanningTab division={selectedDiv} />
              </div>
            )}

            {/* Penatalayan Tab (Liturgia only) */}
            {detailTab === 'penatalayan' && selectedDiv === 'LITURGIA' && (
              <div>
                <PenatalayanCalendar division={selectedDiv} />
              </div>
            )}

            {/* Warta Publik Tab (Didaskalia only) */}
            {detailTab === 'warta' && selectedDiv === 'DIDASKALIA' && (
              <div>
                <WartaPublikTab division={selectedDiv} />
              </div>
            )}

            {/* Event Gallery Tab (Marturia only) */}
            {detailTab === 'gallery' && selectedDiv === 'MARTURIA' && (
              <div>
                <EventGalleryTab division={selectedDiv} eventId={eventId} />
              </div>
            )}

            {/* Store Tab (Benzarpreneurship only) */}
            {detailTab === 'store' && selectedDiv === 'BENZARPR' && (
              <div>
                <BenzarStoreTab eventId={eventId} division={selectedDiv} />
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

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">Tambah Anggota Divisi</h3>
              <button onClick={() => { setShowAddMember(false); setMemberSearch(''); setMemberSearchResults([]); }} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search input */}
            <div className="relative">
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full px-4 py-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black"
                autoFocus
              />
              {memberSearchLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-[#8C8880] absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* Role selector */}
            <div>
              <label className="text-xs font-semibold text-[#8C8880] mb-1 block">Role</label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black"
              >
                <option value="LEAD">Ketua Divisi (LEAD)</option>
                <option value="CO_LEAD">Wakil Ketua (CO_LEAD)</option>
                <option value="MEMBER">Anggota (MEMBER)</option>
                <option value="VIEWER">Pengamat (VIEWER)</option>
              </select>
            </div>

            {/* Search results */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {memberSearchResults.length === 0 && memberSearch ? (
                <p className="text-xs text-[#8C8880] text-center py-4">Tidak ditemukan.</p>
              ) : (
                memberSearchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAddMember(user.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#D9D7D0] flex items-center justify-center text-[10px] font-bold text-[#8C8880] shrink-0">
                      {(user.name || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1B1B1B] truncate">{user.name}</p>
                      <p className="text-[10px] text-[#8C8880] truncate">{user.email}{user.division ? ` • ${user.division}` : ''}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#1B1B1B]">Hapus Anggota?</h3>
            <p className="text-sm text-[#8C8880]">
              Anggota <span className="font-bold text-[#1B1B1B]">{removeConfirm}</span> akan dihapus dari divisi ini.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRemoveConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8C8880] hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={() => handleRemoveMember(removeConfirm)}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">Buat Folder Baru</h3>
              <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nama folder..."
              className="w-full px-4 py-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8C8880] hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold hover:bg-black disabled:opacity-50"
              >
                Buat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">Upload File</h3>
              <button onClick={() => { setShowUpload(false); setUploadFile(null); }} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="border-2 border-dashed border-[#D9D7D0] rounded-xl p-6 text-center">
              {uploadFile ? (
                <div className="space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-[#8C8880]" />
                  <p className="text-xs font-bold text-[#1B1B1B]">{uploadFile.name}</p>
                  <p className="text-[10px] text-[#8C8880]">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-[#D9D7D0]" />
                  <p className="text-xs text-[#8C8880]">Klik untuk pilih file</p>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowUpload(false); setUploadFile(null); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8C8880] hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold hover:bg-black disabled:opacity-50"
              >
                {uploading ? 'Mengupload...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Form Modal */}
      {showMeetingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">Buat Rapat Baru</h3>
              <button onClick={() => { setShowMeetingForm(false); setMeetingForm({ title: '', scheduledAt: '', gmeetLink: '', notes: '' }); }} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#8C8880] mb-1 block">Judul Rapat *</label>
                <input
                  type="text"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  placeholder="Contoh: Kick-off BAKU TAU"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8C8880] mb-1 block">Tanggal & Waktu *</label>
                <input
                  type="datetime-local"
                  value={meetingForm.scheduledAt}
                  onChange={(e) => setMeetingForm({ ...meetingForm, scheduledAt: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8C8880] mb-1 block">Google Meet Link</label>
                <input
                  type="url"
                  value={meetingForm.gmeetLink}
                  onChange={(e) => setMeetingForm({ ...meetingForm, gmeetLink: e.target.value })}
                  placeholder="https://meet.google.com/..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8C8880] mb-1 block">Catatan</label>
                <textarea
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                  placeholder="Agenda atau catatan rapat..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm focus:outline-none focus:border-black resize-none h-20"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowMeetingForm(false); setMeetingForm({ title: '', scheduledAt: '', gmeetLink: '', notes: '' }); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8C8880] hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={creatingMeeting || !meetingForm.title || !meetingForm.scheduledAt}
                className="px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold hover:bg-black disabled:opacity-50"
              >
                {creatingMeeting ? 'Membuat...' : 'Buat Rapat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
