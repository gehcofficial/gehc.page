import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { YouthGroup, GroupMember, MonitoringRecord } from '../../types';
import { AttendancePanel } from './AttendancePanel';
import { MiniFamilyTree } from '../public/FamilyTree';
import { DatePicker } from '../ui/DatePicker';
import {
  Users,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  CalendarCheck2,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Heart,
  MessageSquare,
  Shield,
  X,
  ArrowRight,
  Filter,
  TreePine,
  Images,
} from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { PanelGuide } from './PanelGuide';
import { DriveUploadButton } from './DriveUploadButton';
import { ScrollTabBar } from './ScrollTabBar';
import ConfirmationModal from '../ui/ConfirmationModal';
import { GroupAlbumsPanel } from './GroupAlbumsPanel';
import { WhatsAppJoinCard } from './WhatsAppJoinCard';
import { useMediaSlots, MEDIA_SLOTS_QUERY_KEY } from '../../hooks/useMediaSlots';
import { useQueryClient } from '@tanstack/react-query';
import { ROLE_LABEL } from '../../lib/roles';

export const ManageGroupsMonitoring: React.FC = () => {
  const {
    groups,
    members,
    groupBatches,
    monitoringRecords,
    currentUser,
    currentRole,
    isSuperAdmin,
    isCommittee,
    isKomisi,
    isGroupMentor,
    isMentee,
    userAssignedGroupId,
    submitMonitoringRecord,
    deleteMonitoringRecord,
    addGroupMember,
    updateGroupMember,
    deleteGroupMember,
    canAccess,
    addToast,
  } = useApp();
  const { t } = useLang();
  const mon = t.portal.monitoring;
  const slots = useMediaSlots();
  const queryClient = useQueryClient();

  // Mentor/mentee TERKUNCI ke grup penugasannya — tidak pernah default ke grup pertama.
  // Bila penugasan belum termuat, tampilkan status eksplisit (bukan grup orang lain).
  const boundGroupId = (isGroupMentor || isMentee) ? userAssignedGroupId : undefined;
  const needsGroup = (isGroupMentor || isMentee) && !boundGroupId;
  const availableGroups = boundGroupId
    ? groups.filter((g) => g.id === boundGroupId)
    : groups;

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    boundGroupId || groups[0]?.id || ''
  );

  useEffect(() => {
    if (boundGroupId) setSelectedGroupId(boundGroupId);
  }, [boundGroupId]);

  const [activeTab, setActiveTab] = useState<'monitoring-form' | 'history' | 'members' | 'family-tree' | 'absensi' | 'albums' | 'jadwal'>('monitoring-form');
  const [waLinks, setWaLinks] = useState<Array<{ kind: string; refId: string; url: string }>>([]);

  // Selected group object — pengguna terikat TIDAK PERNAH fallback ke groups[0].
  const activeGroup = groups.find((g) => g.id === selectedGroupId)
    || (!boundGroupId ? groups[0] : undefined)
    || null;
  const groupMembers = activeGroup ? members.filter((m) => m.group_id === activeGroup.id) : [];
  // Roster nyata: sembunyikan baris tanpa userId (seed/orphan) di UI default.
  // Superadmin bisa menampilkan + menghapus orphan dengan konfirmasi ketik.
  const [showOrphan, setShowOrphan] = useState(false);
  const orphanCount = groupMembers.filter((m) => !m.userId).length;
  const visibleMembers = showOrphan && isSuperAdmin ? groupMembers : groupMembers.filter((m) => m.userId);
  const groupRecords = monitoringRecords.filter((r) => r.group_id === activeGroup.id);

  // Monitoring Form State (JSONB Extensible Data Model)
  const [monitoringDate, setMonitoringDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [attendanceCount, setAttendanceCount] = useState<number>(0);
  const [meetingTopic, setMeetingTopic] = useState<string>('');
  const [spiritualTemperature, setSpiritualTemperature] = useState<
    'Sangat Baik' | 'Baik' | 'Perlu Perhatian' | 'Kurang Aktif'
  >('Sangat Baik');
  const [prayerRequests, setPrayerRequests] = useState<string>('');
  const [followUpsNeeded, setFollowUpsNeeded] = useState<string>('');
  const [fellowshipActivity, setFellowshipActivity] = useState<string>('');
  const [offeringAmount, setOfferingAmount] = useState<number>(0);
  const [customNotes, setCustomNotes] = useState<string>('');

  // Member Modal State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<GroupMember | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    name: '',
    email: '',
    phone: '',
    is_mentor: false,
    familyRole: 'MENTEE' as 'MENTOR' | 'CO_MENTOR' | 'MENTEE',
    attendanceRate: 90,
    notes: '',
  });

  // Selected Record View Modal
  const [viewingRecord, setViewingRecord] = useState<MonitoringRecord | null>(null);

  // Authorization check for current active group
  const canWriteMonitoring = canAccess('group_monitoring_write', activeGroup.id);

  useEffect(() => {
    fetch('/api/channel-links/scoped', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setWaLinks(d.links || []))
      .catch(() => setWaLinks([]));
  }, []);

  const groupWaUrl = waLinks.find((l) => l.kind === 'GROUP' && l.refId === activeGroup?.id)?.url;

  // Serving/Mentoring linkage — event ibadah minggu ini (bisa dikunci dari hub Kegiatan via ?event=)
  const [serviceEvents, setServiceEvents] = useState<Array<{ id: string; slug?: string | null; name: string; eventDate: string | null; serviceType?: string | null; venueName?: string | null }>>([]);
  const [linkedEventId, setLinkedEventId] = useState<string>('');
  const [eventLocked, setEventLocked] = useState(false);
  const [dateLocked, setDateLocked] = useState(false);
  const autoTarikRef = React.useRef('');
  const serviceEventsRef = React.useRef<typeof serviceEvents>([]);
  const [serviceModules, setServiceModules] = useState<Array<{ id: string; title: string; division: string }>>([]);
  const [rhbFiles, setRhbFiles] = useState<Array<{ id: string; name: string; webViewLink?: string; thumbnailUrl?: string; mimeType?: string }>>([]);
  const [rhbLoading, setRhbLoading] = useState(false);
  const [rhbForbidden, setRhbForbidden] = useState(false);
  const [rhbProgress, setRhbProgress] = useState<Record<string, boolean>>({});
  const [pembekalanFiles, setPembekalanFiles] = useState<Array<{ id: string; name: string; webViewLink?: string }>>([]);
  const [pembekalanLoading, setPembekalanLoading] = useState(false);
  const [pembekalanForbidden, setPembekalanForbidden] = useState(false);
  const [tarikLoading, setTarikLoading] = useState(false);
  // Tab Jadwal Pelayanan — prediktif grup ini + usulan tukar mutualisme
  type SchedRow = {
    id: string; eventDate: string; responsibleGroupId?: string | null; hostGroupId?: string | null;
    cycleIndex?: number | null; isSwapped?: boolean; swapReason?: string | null;
    responsibleGroup?: { name: string } | null; hostGroup?: { name: string } | null;
    event?: { name: string } | null; isVirtual?: boolean;
  };
  const [schedFull, setSchedFull] = useState<SchedRow[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedReqDate, setSchedReqDate] = useState<string | null>(null);
  const [schedTargetGroup, setSchedTargetGroup] = useState('');
  const [schedTargetDate, setSchedTargetDate] = useState('');
  const [schedPeer, setSchedPeer] = useState('');
  const [schedAgree, setSchedAgree] = useState(false);
  const [schedReason, setSchedReason] = useState('');
  const [schedBusy, setSchedBusy] = useState(false);
  const [mySwapReqs, setMySwapReqs] = useState<Array<{ id: string; aEventDate: string; bEventDate: string; scope: string; reason: string; status: string; decideNote?: string | null }>>([]);
  const todayISO = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (activeTab !== 'jadwal' || !activeGroup) return;
    setSchedLoading(true);
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 2);
    const from = `${d.toISOString().slice(0, 7)}-01`;
    Promise.all([
      fetch(`/api/serving-assignments?from=${from}&horizon=6&includeVirtual=1`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/service-swap-requests?status=ALL', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
    ]).then(([s, q]) => {
      const all = [...(s.assignments || []), ...(s.virtual || [])] as SchedRow[];
      all.sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)));
      setSchedFull(all);
      setMySwapReqs(((q.requests || []) as Array<{ requesterGroupId?: string } & { id: string; aEventDate: string; bEventDate: string; scope: string; reason: string; status: string; decideNote?: string | null }>).filter((x) => x.requesterGroupId === activeGroup.id));
    }).finally(() => setSchedLoading(false));
  }, [activeTab, activeGroup?.id]);
  const schedAll = schedFull.filter((r) => r.responsibleGroupId === activeGroup?.id || r.hostGroupId === activeGroup?.id);
  const schedTargetRows = schedFull.filter((r) =>
    !r.isVirtual
    && String(r.eventDate).slice(0, 10) >= todayISO
    && (r.responsibleGroupId === schedTargetGroup || r.hostGroupId === schedTargetGroup),
  );
  const schedRowB = schedFull.find((r) => String(r.eventDate).slice(0, 10) === schedTargetDate && !r.isVirtual) || null;
  const submitSwapReq = async (rowDate: string) => {
    if (!activeGroup) return;
    if (!schedTargetGroup || !schedTargetDate || !schedReason.trim() || !schedAgree) {
      addToast({ type: 'error', title: 'Pilih grup lawan, tanggalnya, alasan, dan centang kesepakatan kedua mentor' });
      return;
    }
    setSchedBusy(true);
    try {
      const r = await fetch('/api/service-swap-requests', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aEventDate: rowDate, bEventDate: schedTargetDate, requesterGroupId: activeGroup.id, targetGroupId: schedTargetGroup, peerMentor: schedPeer.trim() || null, mutualAgreed: true, reason: schedReason.trim() }),
      });
      const dd = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dd.error || 'Gagal kirim usulan');
      addToast({ type: 'success', title: 'Usulan terkirim — menunggu approval' });
      setSchedReqDate(null); setSchedTargetGroup(''); setSchedTargetDate(''); setSchedPeer(''); setSchedAgree(false); setSchedReason('');
      fetch('/api/service-swap-requests?status=ALL', { credentials: 'include' }).then((x) => x.json()).then((q) => {
        setMySwapReqs(((q.requests || []) as Array<{ requesterGroupId?: string; id: string; aEventDate: string; bEventDate: string; scope: string; reason: string; status: string; decideNote?: string | null }>).filter((x) => x.requesterGroupId === activeGroup.id));
      }).catch(() => {});
    } catch (e) { addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal kirim' }); }
    finally { setSchedBusy(false); }
  };
  const resolveLockedEvent = (evs: typeof serviceEvents) => {
    let p: string | null = null;
    try {
      const h = window.location.hash;
      if (h.includes('?')) p = new URLSearchParams(h.slice(h.indexOf('?') + 1)).get('event');
    } catch {}
    if (!p) return;
    const found = evs.find((e) => e.id === p || e.slug === p);
    if (found) {
      setLinkedEventId((cur) => (cur === found.id ? cur : found.id));
      setEventLocked(true);
    }
  };
  useEffect(() => {
    if (activeTab !== 'monitoring-form') return;
    fetch('/api/events', { credentials: 'include' }).then(r=>r.json()).then(d=>{
      const evs = (d.events || []).filter((e: { serviceType?: string; eventDate?: string }) => e.serviceType === 'MENTORING_DAY' || e.serviceType === 'SERVING_DAY');
      evs.sort((a: { eventDate?: string }, b: { eventDate?: string }) => String(a.eventDate||'').localeCompare(String(b.eventDate||'')));
      const sliced = evs.slice(-12).reverse();
      setServiceEvents(sliced);
      serviceEventsRef.current = sliced;
      // Kunci dari hub Kegiatan (?event=) bila ada — event + tanggal mengikuti
      let locked = false;
      try {
        const h = window.location.hash;
        const p = h.includes('?') ? new URLSearchParams(h.slice(h.indexOf('?') + 1)).get('event') : null;
        if (p) {
          const found = sliced.find((e: { id: string; slug?: string | null }) => e.id === p || e.slug === p);
          if (found) {
            setLinkedEventId(found.id);
            setEventLocked(true);
            locked = true;
          }
        }
      } catch {}
      if (locked) return;
      // default monitoringDate ke event terdekat (Minggu ibadah terdekat)
      if (evs.length && !linkedEventId) {
        const upcoming = evs.find((e: { eventDate?: string }) => e.eventDate && new Date(e.eventDate).getTime() >= Date.now() - 24*3600*1000) || evs[evs.length-1];
        if (upcoming?.eventDate) {
          const iso = String(upcoming.eventDate).slice(0,10);
          setMonitoringDate((cur)=> cur === new Date().toISOString().split('T')[0] ? iso : cur);
          setLinkedEventId(upcoming.id);
          if (!meetingTopic && upcoming.name) {
            const theme = upcoming.name.split(':')[1]?.split('-')[0]?.trim();
            if (theme) setMeetingTopic(theme);
          }
        }
      }
    }).catch(()=>{});
  }, [activeTab]);
  useEffect(() => {
    const onHash = () => resolveLockedEvent(serviceEventsRef.current);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Sinkron otomatis saat event tertaut berubah: tanggal mengikuti (terkunci), topik terisi bila kosong
  useEffect(() => {
    if (!linkedEventId || !serviceEvents.length) return;
    const ev = serviceEvents.find((e) => e.id === linkedEventId);
    if (!ev?.eventDate) return;
    setMonitoringDate(String(ev.eventDate).slice(0, 10));
    setDateLocked(true);
    if (ev.name) {
      const theme = ev.name.split(':')[1]?.split('-')[0]?.trim();
      if (theme) setMeetingTopic((cur: string) => cur || theme);
    }
  }, [linkedEventId, serviceEvents]);
  useEffect(() => {
    if (!linkedEventId) { setServiceModules([]); return; }
    fetch(`/api/events/${linkedEventId}/deliverables`, { credentials: 'include' }).then(r=>r.json()).then(d=> setServiceModules(d.deliverables || [])).catch(()=> setServiceModules([]));
  }, [linkedEventId]);
  useEffect(() => {
    if (!linkedEventId) { setRhbFiles([]); setRhbProgress({}); setRhbForbidden(false); return; }
    setRhbLoading(true); setRhbForbidden(false);
    // By-event 03 RHB — same source as Panel Divisi 3-folder (fresh), sinkron
    fetch(`/api/events/${linkedEventId}/divisions/DIDASKALIA/drive?subfolder=${encodeURIComponent('03 RHB 7 Hari')}&fresh=1`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 403) { setRhbForbidden(true); return [] as Array<{ id: string; name: string; webViewLink?: string }>; }
        const d = await r.json().catch(()=> ({}));
        let files = (d.files || []) as Array<{ id: string; name: string; webViewLink?: string }>;
        // fallback ke pillar hybrid jika per-event kosong (event lama belum migrasi)
        if (!files.length) {
          try {
            const fr = await fetch(`/api/didaskalia/rhb?eventId=${linkedEventId}`, { credentials: 'include' });
            if (fr.status === 403) { setRhbForbidden(true); return [] as Array<{ id: string; name: string; webViewLink?: string }>; }
            if (fr.ok) {
              const fd = await fr.json();
              if (Array.isArray(fd.files) && fd.files.length) files = fd.files;
            }
          } catch {}
        }
        return files;
      })
      .then((files) => {
        setRhbFiles(files);
        setRhbProgress((prev) => {
          const next: Record<string, boolean> = {};
          files.forEach((f) => { next[f.id] = prev[f.id] || false; });
          return next;
        });
      })
      .catch(() => setRhbFiles([]))
      .finally(() => setRhbLoading(false));
  }, [linkedEventId]);
  // Pembekalan 01 — mentor-only, by event, sinkron dengan Panel Divisi 01
  useEffect(() => {
    if (!linkedEventId) { setPembekalanFiles([]); setPembekalanForbidden(false); return; }
    setPembekalanLoading(true); setPembekalanForbidden(false);
    fetch(`/api/events/${linkedEventId}/divisions/DIDASKALIA/drive?subfolder=${encodeURIComponent('01 Pembekalan Mentor - Co mentor')}&fresh=1`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 403) { setPembekalanForbidden(true); return [] as Array<{ id: string; name: string; webViewLink?: string }>; }
        const d = await r.json().catch(()=> ({}));
        return (d.files || []) as Array<{ id: string; name: string; webViewLink?: string }>;
      })
      .then((files) => setPembekalanFiles(files))
      .catch(() => setPembekalanFiles([]))
      .finally(() => setPembekalanLoading(false));
  }, [linkedEventId]);
  const pullAttendance = async () => {
    try {
      const r = await fetch(`/api/db/groups/${activeGroup.id}/attendance?date=${monitoringDate}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal ambil absensi');
      const hadir = (d.records || []).filter((rec: { status: string }) => rec.status === 'HADIR').length;
      setAttendanceCount(hadir);
      if (hadir > 0) addToast({ type: 'success', title: `Kehadiran dari absensi: ${hadir} orang` });
      else addToast({ type: 'info', title: 'Belum ada absensi HADIR untuk tanggal ini — isi dulu di tab Absensi' });
    } catch (e: unknown) { addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal ambil absensi' }); }
  };
  useEffect(() => {
    if (activeTab === 'monitoring-form' && monitoringDate && activeGroup?.id) void pullAttendance();
  }, [monitoringDate, activeTab, activeGroup?.id]);
  // Tarik kehadiran dari event (overwrite, real hari H) — dipakai tombol manual + auto-sinkron
  const runTarik = async (eventId: string, dateIso: string, auto: boolean) => {
    if (!activeGroup || !canWriteMonitoring) return false;
    setTarikLoading(true);
    try {
      const r = await fetch(`/api/events/${eventId}/attendance-by-group?groupId=${activeGroup.id}`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal tarik');
      const suggested = (d.suggestions || []).filter((s: { suggested?: string }) => s.suggested === 'HADIR');
      if (!suggested.length) {
        if (!auto) addToast({ type: 'info', title: 'Tidak ada yang terdata di event ini — isi manual' });
        return true;
      }
      const entries = suggested.map((s: { groupMemberId: string }) => ({ groupMemberId: s.groupMemberId, status: 'HADIR' }));
      const pr = await fetch('/api/db/attendance', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: activeGroup.id, date: dateIso, entries }) });
      const pd = await pr.json().catch(() => ({}));
      if (!pr.ok) throw new Error(pd.error || 'Gagal simpan tarik');
      addToast({ type: 'success', title: `Tersinkron ${suggested.length} HADIR dari event${auto ? ' (otomatis — masih bisa diubah)' : ' (menimpa)'}` });
      await pullAttendance();
      return true;
    } catch (e) { addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal tarik' }); return false; }
    finally { setTarikLoading(false); }
  };
  // Auto-sinkron sekali per (event, grup): absensi ditarik begitu event tertaut
  useEffect(() => {
    if (!linkedEventId || activeTab !== 'monitoring-form' || !activeGroup) return;
    const ev = serviceEvents.find((e) => e.id === linkedEventId);
    if (!ev?.eventDate) return;
    const key = `${linkedEventId}:${activeGroup.id}`;
    if (autoTarikRef.current === key) return;
    autoTarikRef.current = key;
    void runTarik(linkedEventId, String(ev.eventDate).slice(0, 10), true);
  }, [linkedEventId, serviceEvents, activeGroup?.id, activeTab]);

  const handleMonitoringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTopic.trim()) return;

    const linkedEv = serviceEvents.find(ev => ev.id === linkedEventId);
    const rhbDone = Object.entries(rhbProgress).filter(([, v]) => v).map(([id]) => id);
    submitMonitoringRecord({
      group_id: activeGroup.id,
      group_name: activeGroup.name,
      mentor_id: currentUser.id,
      mentor_name: currentUser.name,
      date: monitoringDate,
      data: {
        attendanceCount: Number(attendanceCount),
        totalMembers: visibleMembers.length || activeGroup.memberCount,
        meetingTopic,
        spiritualTemperature,
        prayerRequests,
        followUpsNeeded,
        fellowshipActivity,
        offeringAmount: Number(offeringAmount),
        customNotes,
        eventId: linkedEventId || null,
        serviceType: linkedEv?.serviceType || null,
        weekRef: linkedEv ? { eventId: linkedEv.id, eventDate: linkedEv.eventDate, serviceType: linkedEv.serviceType } : null,
        rhbProgress: rhbDone.length ? { done: rhbDone, total: rhbFiles.length, at: new Date().toISOString() } : null,
        rhbFiles: rhbFiles.length ? rhbFiles.map((f) => ({ id: f.id, name: f.name, webViewLink: f.webViewLink })) : null,
      },
    });

    // Reset Form
    setMeetingTopic('');
    setPrayerRequests('');
    setFollowUpsNeeded('');
    setFellowshipActivity('');
    setOfferingAmount(0);
    setCustomNotes('');
    setRhbProgress({});
    setActiveTab('history');
  };

  const handleOpenAddMember = () => {
    setEditingMember(null);
    setMemberFormData({
      name: '',
      email: '',
      phone: '',
      is_mentor: false,
      familyRole: 'MENTEE',
      attendanceRate: 95,
      notes: '',
    });
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (m: GroupMember) => {
    setEditingMember(m);
    setMemberFormData({
      name: m.name,
      email: m.email,
      phone: m.phone,
      is_mentor: m.is_mentor,
      familyRole: (m.familyRole === 'CO_MENTOR' || m.familyRole === 'COMENTOR' ? 'CO_MENTOR' : m.familyRole === 'MENTOR' || m.is_mentor ? 'MENTOR' : 'MENTEE') as 'MENTOR' | 'CO_MENTOR' | 'MENTEE',
      attendanceRate: m.attendanceRate,
      notes: m.notes || '',
    });
    setIsMemberModalOpen(true);
  };

  const [deletingMember, setDeletingMember] = useState<GroupMember | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberFormData.name.trim()) return;

    try {
      if (editingMember) {
        await updateGroupMember(editingMember.id, {
          name: memberFormData.name,
          email: memberFormData.email,
          phone: memberFormData.phone,
          is_mentor: memberFormData.familyRole !== 'MENTEE',
          familyRole: memberFormData.familyRole,
          attendanceRate: Number(memberFormData.attendanceRate),
          notes: memberFormData.notes,
        });
      } else {
        await addGroupMember({
          group_id: activeGroup.id,
          name: memberFormData.name,
          email: memberFormData.email,
          phone: memberFormData.phone,
          is_mentor: memberFormData.familyRole !== 'MENTEE',
          familyRole: memberFormData.familyRole,
          attendanceRate: Number(memberFormData.attendanceRate),
          notes: memberFormData.notes,
        });
      }
      setIsMemberModalOpen(false);
    } catch (err) {
      addToast({ type: 'error', title: err instanceof Error ? err.message : 'Gagal menyimpan anggota' });
    }
  };

  const confirmDeleteMember = async () => {
    if (!deletingMember) return;
    setDeleteBusy(true);
    try {
      await deleteGroupMember(deletingMember.id);
      setDeletingMember(null);
    } catch (err) {
      addToast({ type: 'error', title: err instanceof Error ? err.message : 'Gagal menghapus anggota' });
    } finally {
      setDeleteBusy(false);
    }
  };

  if (needsGroup) {
    return (
      <div className="rounded-[28px] bg-amber-50 border border-amber-200 p-6 text-center space-y-2">
        <p className="text-sm font-black text-amber-900">Akun belum terikat kelompok</p>
        <p className="text-xs text-amber-800 leading-relaxed">
          Peranmu memerlukan grup (cth. Mentor Echad), tapi penugasan belum termuat.
          Muat ulang halaman; bila tetap, hubungi Komisi untuk cek penugasan peranmu.
          Panel tidak menampilkan grup lain agar tidak tertukar.
        </p>
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div className="rounded-[28px] bg-white border border-[#D9D7D0]/50 p-6 text-center">
        <p className="text-xs text-[#8C8880]">Memuat data kelompok…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header Bar */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Group Management & Monitoring Engine
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Monitoring Kelompok Persekutuan
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            {isGroupMentor
              ? `Akses khusus Mentor untuk Kelompok ${activeGroup.name}. Input kehadiran dan dinamika rohani mingguan.`
              : isMentee
              ? `Lihat aktivitas dan laporan Kelompok ${activeGroup.name}.`
              : 'Pantau seluruh 10 kelompok persekutuan pemuda GMIM Eben Haezer Cikarang.'}
          </p>
        </div>

        {/* Role Scoped Badge */}
        {(isGroupMentor || isMentee) && userAssignedGroupId && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
            <Shield className="w-4 h-4 text-blue-600" />
            <span>{isMentee ? 'Anggota' : 'Mentor'} — Kelompok {activeGroup.name}</span>
          </div>
        )}
      </div>

      <PanelGuide guideId="groups-monitoring" />

      {activeGroup && (
        <WhatsAppJoinCard
          title={activeGroup.name}
          url={groupWaUrl}
          emptyHint={t.portal.wa.missingLink}
        />
      )}

      {/* Group Selector Pills (If Superadmin/Committee, can pick from all 10) */}
      {(isSuperAdmin || isCommittee) && (
        <div className="bg-white rounded-[28px] p-4 border border-[#D9D7D0]/50 shadow-sm">
          <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider block mb-3 px-2">
            Pilih Kelompok (10 Groups):
          </span>
          <div className="flex flex-wrap gap-2">
            {groups.map((grp) => {
              const isSelected = grp.id === selectedGroupId;
              return (
                <button
                  key={grp.id}
                  onClick={() => setSelectedGroupId(grp.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#181818] text-white shadow-md'
                      : 'bg-[#FAF9F5] text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: grp.color }}
                  ></span>
                  <span>{grp.name}</span>
                  <span className="text-[10px] opacity-60">({grp.memberCount})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Group Hero Summary */}
      {(() => {
        const coverUrl = slots.kelompok[activeGroup.name.toLowerCase()];
        const canChangeCover = canWriteMonitoring && (isGroupMentor || isSuperAdmin || isKomisi);
        return (
      <div
        className="rounded-[32px] p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-white/10"
        style={{
          background: coverUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.72)), url(${coverUrl}) center/cover`
            : `linear-gradient(135deg, ${activeGroup.color}EE, #181818)`,
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black">{activeGroup.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold">
                {visibleMembers.length} Anggota
              </span>
            </div>
            <p className="text-xs sm:text-sm text-white/90 font-medium">
              {activeGroup.meaning}
            </p>
            <p className="text-[11px] text-white/80 italic">
              "{activeGroup.scripture}"
            </p>
            {canChangeCover && (
              <DriveUploadButton
                label="Ganti cover rumah"
                onFile={async (payload) => {
                  const r = await fetch(`/api/groups/${activeGroup.id}/cover`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                  const d = await r.json();
                  if (!r.ok) addToast({ type: 'error', title: d.error || 'Gagal unggah cover' });
                  else {
                    addToast({ type: 'success', title: 'Cover tersimpan di Drive' });
                    queryClient.invalidateQueries({ queryKey: MEDIA_SLOTS_QUERY_KEY });
                  }
                }}
              />
            )}
          </div>

          <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 text-xs space-y-1.5 text-white/90 border border-white/10 shrink-0">
            <p><strong className="text-white">Mentor:</strong> {activeGroup.mentorNames.join(', ')}</p>
            <p><strong className="text-white">Jadwal:</strong> {activeGroup.meetingSchedule}</p>
            <p><strong className="text-white">Lokasi:</strong> {activeGroup.meetingLocation}</p>
          </div>
        </div>
      </div>
        );
      })()}

      {/* Tab Switcher: Input Form, Monitoring History, Member Roster */}
      <ScrollTabBar active={activeTab} className="border-b border-[#D9D7D0]/60 pb-3" track={false} gapClass="gap-2">
        <button
          role="tab"
          aria-selected={activeTab === 'monitoring-form'}
          onClick={() => setActiveTab('monitoring-form')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'monitoring-form'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <Plus className="w-3.5 h-3.5 text-[#FF416C]" />
          <span>{mon.tabForm}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-blue-500" />
          <span>{mon.tabHistory} ({groupRecords.length})</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'members'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-emerald-500" />
          <span>{mon.tabMembers} ({visibleMembers.length})</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'family-tree'}
          onClick={() => setActiveTab('family-tree')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'family-tree'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <TreePine className="w-3.5 h-3.5 text-amber-500" />
          <span>{mon.tabTree}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'absensi'}
          onClick={() => setActiveTab('absensi')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'absensi'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <CalendarCheck2 className="w-3.5 h-3.5 text-cyan-500" />
          <span>{mon.tabAttendance}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'jadwal'}
          onClick={() => setActiveTab('jadwal')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'jadwal'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
          <span>Jadwal Pelayanan</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'albums'}
          onClick={() => setActiveTab('albums')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'albums'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <Images className="w-3.5 h-3.5 text-rose-500" />
          <span>Album</span>
        </button>
      </ScrollTabBar>

      {/* TAB 1: DYNAMIC MONITORING INPUT FORM */}
      {activeTab === 'monitoring-form' && (
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
          {!canWriteMonitoring ? (
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <h4 className="font-bold text-sm mb-1">Akses Terbatas</h4>
              <p>
                Peran aktif Anda ({currentRole}) tidak memiliki izin pengisian monitoring untuk kelompok ini.
                Hanya Mentor kelompok terkait atau Komisi/Superadmin yang dapat menyimpan data.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMonitoringSubmit} className="space-y-6 max-w-3xl">
              <div className="border-b border-[#D9D7D0]/40 pb-4">
                <h3 className="text-lg font-bold text-[#1B1B1B]">
                  Laporan Persekutuan Mingguan — Kelompok {activeGroup.name}
                </h3>
                <p className="text-xs text-[#8C8880] mt-0.5">
                  Catat dinamika kelompok sel, jumlah kehadiran, pokok doa, dan kebutuhan penggembalaan.
                </p>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-sky-800 block">Event ibadah minggu ini (sinkron modul)</label>
                <select value={linkedEventId} onChange={(e)=> { setLinkedEventId(e.target.value); setEventLocked(false); }} disabled={eventLocked} className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white disabled:opacity-70">
                  <option value="">— Tanpa tautan event —</option>
                  {serviceEvents.map((ev)=> (
                    <option key={ev.id} value={ev.id}>{ev.serviceType === 'MENTORING_DAY' ? '[M] ' : '[S] '}{ev.name} · {ev.eventDate ? String(ev.eventDate).slice(0,10) : ''} {ev.venueName ? `· ${ev.venueName}` : ''}</option>
                  ))}
                </select>
                {eventLocked && linkedEventId && (
                  <p className="text-[11px] text-sky-800">🔒 Terkunci dari hub Kegiatan: <span className="font-bold">{serviceEvents.find((e)=>e.id===linkedEventId)?.name || linkedEventId.slice(0,8)}</span> — tanggal &amp; absensi mengikuti otomatis. <button type="button" onClick={() => { setEventLocked(false); try { const h = window.location.hash; window.location.hash = h.split('?')[0].replace(/^#/,''); } catch {} }} className="font-bold underline">Buka kunci</button></p>
                )}
                {linkedEventId && serviceModules.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {serviceModules.map((m)=> (
                      <span key={m.id} className="text-[10px] px-2 py-1 rounded-full bg-white border border-sky-200 text-sky-900 font-bold">{m.division}: {m.title}</span>
                    ))}
                  </div>
                )}
                {linkedEventId && serviceModules.length === 0 && <p className="text-[11px] text-sky-700">Belum ada modul Didaskalia untuk event ini — modul akan muncul setelah share dari Rencana Bulan.</p>}
              </div>

              {/* Pembekalan 01 — mentor-only, by event (tidak dirender untuk mentee) */}
              {!pembekalanForbidden && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Pembekalan Mentor - Co mentor — by event · Didaskalia</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">Materi pembekalan by event <span className="font-bold">{(serviceEvents.find((e)=>e.id===linkedEventId)?.name) || '—'}</span> {(serviceEvents.find((e)=>e.id===linkedEventId)?.eventDate ? `· ${String(serviceEvents.find((e)=>e.id===linkedEventId)?.eventDate).slice(0,10)}` : '')} — hanya Mentor/Co-mentor (sinkron Panel Divisi → 01).</p>
                {pembekalanLoading ? (
                  <p className="text-xs text-amber-700">Memuat pembekalan…</p>
                ) : pembekalanFiles.length === 0 ? (
                  <p className="text-xs text-amber-700">Belum ada file pembekalan untuk minggu ini. Didaskalia upload via Panel Divisi → Didaskalia → Studio → Modul Pembekalan (01).</p>
                ) : (
                  <ul className="space-y-1.5">
                    {pembekalanFiles.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-amber-100">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1B1B1B] truncate" title={f.name}>{f.name}</p>
                          {f.webViewLink && <a href={f.webViewLink} target="_blank" rel="noopener" className="text-[11px] font-bold text-sky-700 hover:underline">Buka di Drive</a>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              )}

              {/* RHB Harian — hybrid pillar Didaskalia/Berkas/modul-rhb · 7 hari Senin-Sabtu selain pembekalan & materi Minggu */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">RHB 7 Path Harian · Didaskalia</p>
                  {rhbFiles.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700 font-bold">{Object.values(rhbProgress).filter(Boolean).length}/{rhbFiles.length} selesai</span>}
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">Materi harian Beyonders untuk minggu ini: 7 Path, tiap Path satu PDF terpisah. Ini renungan harian yang dipakai di kelompok. Didaskalia upload via Panel Divisi → Didaskalia → Studio → RHB 7 Hari (03).</p>
                {rhbLoading ? (
                  <p className="text-xs text-emerald-700">Memuat RHB…</p>
                ) : !linkedEventId ? (
                  <p className="text-xs text-emerald-700 italic">Pilih event ibadah di atas untuk melihat RHB minggu itu.</p>
                ) : rhbForbidden ? (
                  <p className="text-xs text-emerald-700">🔒 RHB hanya untuk Beyonders (mentor/mentee). Hubungi mentor untuk akses.</p>
                ) : rhbFiles.length === 0 ? (
                  <p className="text-xs text-emerald-700">Belum ada file RHB untuk minggu ini. Didaskalia upload 7 PDF (7 Path harian) via Panel Divisi → Didaskalia → Studio → RHB 7 Hari (03).</p>
                ) : (
                  <ul className="space-y-1.5">
                    {rhbFiles.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-emerald-100">
                        <input
                          type="checkbox"
                          checked={Boolean(rhbProgress[f.id])}
                          onChange={(e) => setRhbProgress((prev) => ({ ...prev, [f.id]: e.target.checked }))}
                          className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1B1B1B] truncate" title={f.name}>{f.name}</p>
                          {f.webViewLink && <a href={f.webViewLink} target="_blank" rel="noopener" className="text-[11px] font-bold text-sky-700 hover:underline">Buka di Drive</a>}
                        </div>
                        {rhbProgress[f.id] && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Tanggal Pertemuan *
                  </label>
                  <DatePicker
                    value={monitoringDate}
                    onChange={(d) => { setMonitoringDate(d); setDateLocked(false); }}
                    placeholder="Pilih tanggal pertemuan"
                    disabled={dateLocked && !!linkedEventId}
                  />
                  {dateLocked && linkedEventId && (
                    <p className="mt-1 text-[10px] text-[#8C8880]">🔒 Mengikuti tanggal event ({monitoringDate}). <button type="button" onClick={() => setDateLocked(false)} className="font-bold text-sky-700 hover:text-sky-900 underline">Ubah manual</button></p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Jumlah Anggota Hadir *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      required
                      min={0}
                      max={50}
                      value={attendanceCount}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-2xl bg-[#F0EFEB] border border-[#D9D7D0] text-xs font-bold focus:outline-none text-[#5C5850]"
                      title="Otomatis dari absensi — ubah via tab Absensi"
                    />
                    <span className="text-xs text-[#8C8880] whitespace-nowrap">
                      / {visibleMembers.length || activeGroup.memberCount} Anggota
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#8C8880]">Otomatis dari tab <span className="font-bold">Absensi</span> (Hadir). <button type="button" onClick={() => void pullAttendance()} className="font-bold text-sky-700 hover:text-sky-900 underline">Segarkan</button></p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Tema / Topik Diskusi PA *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hidup Kudus di Tengah Dunia Kerja (Roma 12:1-2)"
                  value={meetingTopic}
                  onChange={(e) => setMeetingTopic(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Suhu & Dinamika Rohani Kelompok *
                  </label>
                  <select
                    value={spiritualTemperature}
                    onChange={(e) => setSpiritualTemperature(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold focus:outline-none focus:border-black"
                  >
                    <option value="Sangat Baik">🟢 Sangat Baik (Antusias & Saling Menguatkan)</option>
                    <option value="Baik">🔵 Baik (Stabil & Hadir Teratur)</option>
                    <option value="Perlu Perhatian">🟡 Perlu Perhatian (Ada anggota bergumul/absen)</option>
                    <option value="Kurang Aktif">🔴 Kurang Aktif (Butuh kunjungan khusus pengurus)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Jumlah Persembahan Kasih (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    placeholder="Contoh: 150000"
                    value={offeringAmount || ''}
                    onChange={(e) => setOfferingAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Pokok-Pokok Doa Syafaat Kelompok *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tuliskan pokok doa anggota (pekerjaan, kesehatan, keluarga, ujian, pergumulan)..."
                  value={prayerRequests}
                  onChange={(e) => setPrayerRequests(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Tindak Lanjut & Follow-Up Penggembalaan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kunjungi Samuel di kosan; hubungi Timothy via WhatsApp..."
                  value={followUpsNeeded}
                  onChange={(e) => setFollowUpsNeeded(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                  Aktivitas Fellowship Tambahan (Optional JSON Field)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Makan malam bersama, Ice breaking akustik..."
                  value={fellowshipActivity}
                  onChange={(e) => setFellowshipActivity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-4 border-t border-[#D9D7D0]/50 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs sm:text-sm font-bold shadow-lg hover:opacity-95 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Laporan Monitoring</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: MONITORING HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#D9D7D0]/40">
            <div>
              <h3 className="text-lg font-bold text-[#1B1B1B]">
                Riwayat Monitoring Kelompok {activeGroup.name}
              </h3>
              <p className="text-xs text-[#8C8880]">Laporan terdata di database.</p>
            </div>
          </div>

          {groupRecords.length === 0 ? (
            <div className="text-center py-16 bg-[#FAF9F5] rounded-2xl border border-[#D9D7D0]/50 p-6">
              <FileText className="w-10 h-10 text-[#8C8880] mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-[#1B1B1B]">Belum Ada Riwayat Laporan</h4>
              <p className="text-xs text-[#8C8880] mt-1">
                Gunakan tab "Form Input Monitoring" di atas untuk memasukkan laporan pertama.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/60 hover:border-black transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">
                        {rec.date}
                      </span>
                      <span className="text-xs font-bold text-[#1B1B1B]">{rec.data.meetingTopic}</span>
                    </div>
                    <p className="text-xs text-[#8C8880] line-clamp-1">
                      <strong>Pokok Doa:</strong> {rec.data.prayerRequests}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-[#8C8880]">
                      <span>Pelapor: <strong>{rec.mentor_name}</strong></span>
                      <span>•</span>
                      <span>Kehadiran: <strong>{rec.data.attendanceCount} orang</strong></span>
                      <span>•</span>
                      <span className="text-emerald-700 font-semibold">{rec.data.spiritualTemperature}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => setViewingRecord(rec)}
                      className="px-3.5 py-1.5 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] text-xs font-bold transition-colors"
                    >
                      Lihat Rincian
                    </button>
                    {(isSuperAdmin || isCommittee) && (
                      <button
                        onClick={() => {
                          if (confirm('Hapus laporan monitoring ini?')) {
                            deleteMonitoringRecord(rec.id);
                          }
                        }}
                        className="p-2 rounded-full hover:bg-red-100 text-red-600 transition-colors"
                        title="Hapus Laporan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEMBER ROSTER */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#D9D7D0]/40">
            <div>
              <h3 className="text-lg font-bold text-[#1B1B1B]">
                Roster Anggota Kelompok {activeGroup.name}
              </h3>
              <p className="text-xs text-[#8C8880]">
                Daftar nama pemuda yang benar-benar terdaftar dalam kelompok sel ini.
              </p>
              {isSuperAdmin && orphanCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOrphan((v) => !v)}
                  className="mt-1 text-[11px] font-bold text-amber-700 underline"
                >
                  {showOrphan ? 'Sembunyikan' : `Tampilkan ${orphanCount} baris tanpa akun (seed/orphan)`}
                </button>
              )}
            </div>

            {canWriteMonitoring && (
              <button
                onClick={handleOpenAddMember}
                className="px-4 py-2 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Anggota</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D9D7D0]/60 text-[#8C8880] uppercase tracking-wider font-semibold">
                  <th className="pb-3 pl-2">Nama Anggota</th>
                  <th className="pb-3">Peran</th>
                  <th className="pb-3">Kontak & Email</th>
                  <th className="pb-3">Tingkat Kehadiran</th>
                  <th className="pb-3">Catatan Pembinaan</th>
                  {canWriteMonitoring && <th className="pb-3 pr-2 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9D7D0]/30">
                {visibleMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-[#FAF9F5] transition-colors">
                    <td className="py-3.5 pl-2 font-bold text-[#1B1B1B]">
                      {m.name}
                      {!m.userId && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                          Tanpa akun
                        </span>
                      )}
                    </td>
                    <td className="py-3.5">
                      {(() => {
                        const role =
                          m.familyRole === 'CO_MENTOR' || m.familyRole === 'COMENTOR'
                            ? 'CO_MENTOR'
                            : m.familyRole === 'MENTOR' || m.is_mentor
                              ? 'MENTOR'
                              : 'MENTEE';
                        return (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          role === 'MENTOR'
                            ? 'bg-purple-100 text-purple-800'
                            : role === 'CO_MENTOR'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ROLE_LABEL[role]}
                      </span>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 text-[#8C8880]">
                      <div>{m.email}</div>
                      <div className="text-[11px]">{m.phone}</div>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${m.attendanceRate}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-[#1B1B1B]">{m.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-[#8C8880] max-w-xs truncate">
                      {m.notes || '-'}
                    </td>
                    {canWriteMonitoring && (
                      <td className="py-3.5 pr-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditMember(m)}
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-[#1B1B1B]"
                            title="Edit Anggota"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingMember(m)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"
                            title="Hapus Anggota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Member Add/Edit Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[32px] w-full max-w-md p-6 shadow-2xl border border-[#D9D7D0] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9D7D0]/60 mb-4">
              <h3 className="text-base font-bold text-[#1B1B1B]">
                {editingMember ? 'Edit Anggota Kelompok' : 'Tambah Anggota Kelompok'}
              </h3>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama anggota pemuda..."
                  value={memberFormData.name}
                  onChange={(e) => setMemberFormData({ ...memberFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="nama@email.com"
                  value={memberFormData.email}
                  onChange={(e) => setMemberFormData({ ...memberFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
                {memberFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberFormData.email) && (
                  <p className="text-[10px] text-red-500 mt-1">Format email tidak valid</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="+62 812-xxxx-xxxx"
                  value={memberFormData.phone}
                  onChange={(e) => setMemberFormData({ ...memberFormData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
                {memberFormData.phone && !/^[\d\s\-\+\(\)]{8,}$/.test(memberFormData.phone) && (
                  <p className="text-[10px] text-red-500 mt-1">Format nomor telepon tidak valid</p>
                )}
              </div>

              <div className="pt-1">
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">Peran rumah</label>
                <select
                  value={memberFormData.familyRole}
                  onChange={(e) =>
                    setMemberFormData({
                      ...memberFormData,
                      familyRole: e.target.value as 'MENTOR' | 'CO_MENTOR' | 'MENTEE',
                      is_mentor: e.target.value !== 'MENTEE',
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-bold"
                >
                  <option value="MENTEE">{ROLE_LABEL.MENTEE}</option>
                  <option value="CO_MENTOR">{ROLE_LABEL.CO_MENTOR}</option>
                  <option value="MENTOR">{ROLE_LABEL.MENTOR}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1">
                  Catatan Pembinaan
                </label>
                <textarea
                  rows={3}
                  placeholder="Status pekerjaan, pergumulan, minat pelayanan..."
                  value={memberFormData.notes}
                  onChange={(e) => setMemberFormData({ ...memberFormData, notes: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-[#D9D7D0]/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold"
                >
                  Simpan Anggota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: FAMILY TREE (same data source as landing page) */}
      {activeTab === 'family-tree' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TreePine className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-[#1B1B1B]">
                Family Tree — {activeGroup.name}
              </h3>
            </div>
            <p className="text-xs text-[#8C8880] mb-6">
              Struktur mentoring dari data yang sama dengan halaman publik (landing page).
            </p>

            {(() => {
              const currentBatch = groupBatches.find(
                (b) => b.group_id === activeGroup.id && b.isCurrent
              );
              if (!currentBatch) {
                return (
                  <div className="text-center py-12 bg-[#FAF9F5] rounded-2xl border border-[#D9D7D0]/50">
                    <TreePine className="w-10 h-10 text-[#8C8880] mx-auto mb-2 opacity-50" />
                    <h4 className="text-sm font-bold text-[#1B1B1B]">Belum Ada Batch Aktif</h4>
                    <p className="text-xs text-[#8C8880] mt-1">Batch mentoring belum ditentukan.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/60">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2.5 py-1 rounded-full bg-black text-white text-[10px] font-bold">{currentBatch.period}</span>
                      <span className="text-sm font-bold text-[#1B1B1B]">{currentBatch.batchLabel}</span>
                      {currentBatch.theme && <span className="text-[11px] text-[#8C8880]">— {currentBatch.theme}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#8C8880]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span>Mentor: <strong>{currentBatch.mentor || '-'}</strong></span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span>Comentor: <strong>{currentBatch.comentor || '-'}</strong></span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>Mentee: <strong>{currentBatch.mentees?.length || 0}</strong></span>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 rounded-[28px] bg-white border border-[#D9D7D0]/50 relative overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ backgroundColor: activeGroup.color }} />
                    <div className="relative flex flex-col items-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white text-base font-black" style={{ backgroundColor: `${activeGroup.color}22`, color: activeGroup.color }}>
                          {(currentBatch.mentor || '').split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'}
                        </div>
                        <div className="text-center">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8C8880]">Mentor</span>
                          <span className="block text-xs font-bold text-[#1B1B1B]">{currentBatch.mentor || '-'}</span>
                        </div>
                      </div>
                      <div className="w-0.5 h-5 rounded-full my-1" style={{ backgroundColor: `${activeGroup.color}66` }} />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white text-sm font-black" style={{ backgroundColor: `${activeGroup.color}22`, color: activeGroup.color }}>
                          {(currentBatch.comentor || '').split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'}
                        </div>
                        <div className="text-center">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8C8880]">Comentor</span>
                          <span className="block text-xs font-bold text-[#1B1B1B]">{currentBatch.comentor || '-'}</span>
                        </div>
                      </div>
                      <div className="w-0.5 h-5 rounded-full my-1" style={{ backgroundColor: `${activeGroup.color}66` }} />
                      <div className="w-full max-w-2xl flex flex-col items-center">
                        <div className="w-full h-0.5 rounded-full max-w-md mb-4" style={{ backgroundColor: `${activeGroup.color}44` }} />
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5 w-full justify-items-center">
                          {(currentBatch.mentees || []).map((m) => (
                            <div key={m.name} className="flex flex-col items-center gap-1.5">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm border-2 border-white bg-gray-100 text-gray-600">
                                {(m.name || '').split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'}
                              </div>
                              <div className="text-center">
                                <span className="block text-[10px] font-bold text-[#8C8880]">Mentee{m.note ? ` ${m.note}` : ''}</span>
                                <span className="block text-[11px] font-bold text-[#1B1B1B]">{m.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 5: ATTENDANCE (server-backed, TiDB) + Tarik dari event (overwrite) */}
      {activeTab === 'absensi' && activeGroup && (
        <div className="space-y-4">
          {linkedEventId && canWriteMonitoring && (
            <div className="bg-white rounded-[28px] p-4 border border-sky-200 shadow-sm space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-sky-800">Tarik kehadiran dari event (overwrite)</p>
              <p className="text-xs text-[#8C8880] leading-relaxed">Ambil pendaftar <span className="font-bold">{serviceEvents.find((e) => e.id === linkedEventId)?.name || linkedEventId.slice(0,8)}</span> untuk {activeGroup.name} — status HADIR dari event akan <span className="font-bold">menimpa</span> isian manual (real hari H). Yang tidak terekap tetap manual input.</p>
              <button
                type="button"
                disabled={tarikLoading}
                onClick={() => void runTarik(linkedEventId, monitoringDate, false)}
                className="px-4 py-2 rounded-full bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 disabled:opacity-50"
              >
                {tarikLoading ? 'Menarik…' : `Tarik dari ${serviceEvents.find((e) => e.id === linkedEventId)?.name?.split(':')[0] || 'event'}`}
              </button>
            </div>
          )}
          <AttendancePanel
            groupId={activeGroup.id}
            groupName={activeGroup.name}
            canWrite={canWriteMonitoring}
            members={visibleMembers}
          />
        </div>
      )}

      {/* TAB: JADWAL PELAYANAN — prediktif grup ini (penanggung/tuan rumah) + usulan tukar */}
      {activeTab === 'jadwal' && activeGroup && (
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#1B1B1B]">Jadwal Pelayanan — Kelompok {activeGroup.name}</h3>
            <p className="text-xs text-[#8C8880] mt-0.5">Periode berjalan + prediksi: kapan menjadi penanggung jawab atau tuan rumah. Butuh tukar? Musyawarahkan kedua mentor dulu, lalu ajukan — menunggu approval.</p>
          </div>
          {schedLoading ? (
            <p className="text-xs text-[#8C8880]">Memuat jadwal…</p>
          ) : schedAll.length === 0 ? (
            <p className="text-xs text-[#8C8880] italic">Belum ada jadwal untuk kelompok ini di periode ini.</p>
          ) : (
            <div className="space-y-2">
              {schedAll.map((r) => {
                const iso = String(r.eventDate).slice(0, 10);
                const isResp = r.responsibleGroupId === activeGroup.id;
                const partner = isResp ? (r.hostGroup?.name || r.hostGroupId) : (r.responsibleGroup?.name || r.responsibleGroupId);
                const open = schedReqDate === r.id;
                const past = iso < todayISO;
                const respA = r.responsibleGroup?.name || r.responsibleGroupId || '—';
                const hostA = r.hostGroup?.name || r.hostGroupId || '—';
                const respB = schedRowB?.responsibleGroup?.name || schedRowB?.responsibleGroupId || '—';
                const hostB = schedRowB?.hostGroup?.name || schedRowB?.hostGroupId || '—';
                return (
                  <div key={r.id} className="p-3 rounded-2xl border border-[#D9D7D0]/60 bg-[#FAF9F5] space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-[#1B1B1B]">{new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${isResp ? 'bg-sky-100 text-sky-800 border-sky-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                        {isResp ? 'Penanggung jawab' : 'Tuan rumah'}
                      </span>
                      <span className="text-[11px] text-[#8C8880]">dengan <span className="font-bold text-[#1B1B1B]">{partner || '—'}</span></span>
                      {r.event?.name && <span className="text-[10px] text-[#8C8880] truncate max-w-[200px]" title={r.event.name}>{r.event.name}</span>}
                      <span className="ml-auto flex items-center gap-1.5">
                        {r.isVirtual
                          ? <span className="text-[10px] text-sky-700 font-bold">prediksi</span>
                          : <span className="text-[10px] text-[#8C8880]">real</span>}
                        {r.isSwapped && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold" title={r.swapReason || ''}>tukar</span>}
                        {r.cycleIndex != null && <span className="text-[10px] font-mono text-[#8C8880]">idx {r.cycleIndex}/10</span>}
                      </span>
                    </div>
                    {canWriteMonitoring && !open && !past && !r.isVirtual && (
                      <button type="button" onClick={() => { setSchedReqDate(r.id); setSchedTargetGroup(''); setSchedTargetDate(''); setSchedPeer(''); setSchedAgree(false); setSchedReason(''); }} className="text-[11px] font-bold text-sky-700 hover:underline">
                        Minta tukar minggu ini →
                      </button>
                    )}
                    {canWriteMonitoring && !open && (past || r.isVirtual) && (
                      <p className="text-[10px] text-[#8C8880] italic">{past ? 'Sudah lewat — tidak bisa ditukar.' : 'Prediksi — bisa diusul setelah jadi jadwal real.'}</p>
                    )}
                    {canWriteMonitoring && open && (
                      <div className="grid sm:grid-cols-2 gap-2 p-2 rounded-xl bg-white border border-sky-200">
                        <select value={schedTargetGroup} onChange={(e) => { setSchedTargetGroup(e.target.value); setSchedTargetDate(''); }} className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white sm:col-span-2">
                          <option value="">Pilih grup yang diajak tukar…</option>
                          {groups.filter((g) => g.id !== activeGroup.id).map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        {schedTargetGroup && (
                          <select value={schedTargetDate} onChange={(e) => setSchedTargetDate(e.target.value)} className="px-2 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white sm:col-span-2">
                            <option value="">Pilih tanggal {groups.find((g) => g.id === schedTargetGroup)?.name || ''} bertugas…</option>
                            {schedTargetRows.map((x) => {
                              const xi = String(x.eventDate).slice(0, 10);
                              return <option key={x.id} value={xi}>{new Date(`${xi}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} — {x.responsibleGroup?.name || ''} → {x.hostGroup?.name || ''}{x.event?.name ? ` · ${x.event.name}` : ''}</option>;
                            })}
                          </select>
                        )}
                        {schedTargetGroup && schedTargetRows.length === 0 && (
                          <p className="text-[11px] text-[#8C8880] italic sm:col-span-2">Grup itu tidak punya jadwal real ke depan di periode ini.</p>
                        )}
                        {schedRowB && (
                          <div className="sm:col-span-2 p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] space-y-1">
                            <p className="font-black text-sky-800 uppercase tracking-wider text-[10px]">Preview bila disetujui (sepasang utuh bertukar)</p>
                            <p className="text-[#1B1B1B]">{new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })}: <span className="line-through text-[#8C8880]">{respA} → {hostA}</span> <span className="font-black">berubah jadi {respB} → {hostB}</span></p>
                            <p className="text-[#1B1B1B]">{new Date(`${String(schedRowB.eventDate).slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })}: <span className="line-through text-[#8C8880]">{respB} → {hostB}</span> <span className="font-black">berubah jadi {respA} → {hostA}</span></p>
                          </div>
                        )}
                        <input value={schedPeer} onChange={(e) => setSchedPeer(e.target.value)} placeholder="Nama mentor lawan (sudah sepakat)" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
                        <input value={schedReason} onChange={(e) => setSchedReason(e.target.value)} placeholder="Alasan tukar (wajib)" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
                        <label className="sm:col-span-2 flex items-start gap-2 text-[11px] text-[#1B1B1B]">
                          <input type="checkbox" checked={schedAgree} onChange={(e) => setSchedAgree(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-[#D9D7D0]" />
                          Kedua mentor sudah sepakat (musyawarah offline) — usulan masuk antrean approval.
                        </label>
                        <div className="sm:col-span-2 flex justify-end gap-2">
                          <button type="button" onClick={() => setSchedReqDate(null)} className="px-3 py-1.5 rounded-xl text-xs text-[#8C8880]">Batal</button>
                          <button type="button" onClick={() => void submitSwapReq(iso)} disabled={schedBusy} className="px-4 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold disabled:opacity-50">{schedBusy ? 'Mengirim…' : 'Kirim usulan'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {mySwapReqs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#D9D7D0]/50">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Usulan grup ini</p>
              {mySwapReqs.map((q) => (
                <div key={q.id} className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/60 text-xs">
                  <span className="font-bold">{q.aEventDate} ↔ {q.bEventDate}</span>
                  <span className="text-[#8C8880]">{q.scope === 'PAIR' ? 'sepasang utuh' : q.scope === 'RESPONSIBLE' ? 'penanggung' : 'tuan rumah'} · {q.reason}</span>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border ${q.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border-amber-200' : q.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{q.status}</span>
                  {q.status === 'REJECTED' && q.decideNote && <span className="w-full text-[11px] text-[#8C8880] italic">Catatan: {q.decideNote}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'albums' && activeGroup && (
        <GroupAlbumsPanel
          groupId={activeGroup.id}
          canCreate={canWriteMonitoring}
          canUpload={Boolean(boundGroupId || canWriteMonitoring)}
          canPropose={!canWriteMonitoring && Boolean(boundGroupId)}
        />
      )}

      {/* Hapus anggota — orphan tanpa akun wajib ketik nama (superadmin) */}
      <ConfirmationModal
        isOpen={!!deletingMember}
        onClose={() => setDeletingMember(null)}
        onConfirm={() => void confirmDeleteMember()}
        title={deletingMember && !deletingMember.userId ? 'Hapus baris tanpa akun?' : 'Hapus anggota?'}
        message={
          deletingMember && !deletingMember.userId
            ? `Baris "${deletingMember.name}" tidak tertaut akun. Hapus permanen dari TiDB beserta riwayat absensinya.`
            : deletingMember
              ? `Keluarkan "${deletingMember.name}" dari kelompok? Penugasan peran rumahnya ikut dinonaktifkan.`
              : ''
        }
        confirmText="Ya, Hapus"
        variant="danger"
        loading={deleteBusy}
        requireTypeConfirmation={Boolean(deletingMember && !deletingMember.userId)}
        typeConfirmationText={deletingMember && !deletingMember.userId ? deletingMember.name : 'HAPUS'}
      />

      {/* Record Inspection Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF9F5] rounded-[32px] w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-[#D9D7D0] relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9D7D0]/60">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">
                  {viewingRecord.date}
                </span>
                <h3 className="text-base font-bold text-[#1B1B1B] mt-1">
                  Laporan Kelompok {viewingRecord.group_name}
                </h3>
              </div>
              <button
                onClick={() => setViewingRecord(null)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#D9D7D0]/50 space-y-2">
                <p><strong className="text-[#1B1B1B]">Topik Pembahasan:</strong> {viewingRecord.data.meetingTopic}</p>
                <p><strong className="text-[#1B1B1B]">Kehadiran:</strong> {viewingRecord.data.attendanceCount} / {viewingRecord.data.totalMembers} Pemuda</p>
                <p><strong className="text-[#1B1B1B]">Suhu Rohani:</strong> {viewingRecord.data.spiritualTemperature}</p>
                {viewingRecord.data.offeringAmount ? (
                  <p><strong className="text-[#1B1B1B]">Persembahan:</strong> Rp {viewingRecord.data.offeringAmount.toLocaleString()}</p>
                ) : null}
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#D9D7D0]/50 space-y-2">
                <span className="font-bold text-[#1B1B1B] block">Pokok Doa Syafaat:</span>
                <p className="text-[#8C8880] leading-relaxed whitespace-pre-line">
                  {viewingRecord.data.prayerRequests}
                </p>
              </div>

              {viewingRecord.data.followUpsNeeded && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
                  <span className="font-bold text-blue-900 block">Tindak Lanjut & Follow-Up:</span>
                  <p className="text-blue-800">{viewingRecord.data.followUpsNeeded}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#D9D7D0]/60 text-right">
              <button
                onClick={() => setViewingRecord(null)}
                className="px-5 py-2 rounded-full bg-[#181818] text-white text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
