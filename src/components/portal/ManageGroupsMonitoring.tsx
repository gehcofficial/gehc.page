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

  const hasAssignedGroup = (isGroupMentor || isMentee) && userAssignedGroupId;
  const availableGroups = hasAssignedGroup
    ? groups.filter((g) => g.id === userAssignedGroupId)
    : groups;

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    hasAssignedGroup ? userAssignedGroupId! : groups[0]?.id || 'grp-1'
  );

  const [activeTab, setActiveTab] = useState<'monitoring-form' | 'history' | 'members' | 'family-tree' | 'absensi' | 'albums'>('monitoring-form');
  const [waLinks, setWaLinks] = useState<Array<{ kind: string; refId: string; url: string }>>([]);

  // Selected group object
  const activeGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];
  const groupMembers = members.filter((m) => m.group_id === activeGroup.id);
  const groupRecords = monitoringRecords.filter((r) => r.group_id === activeGroup.id);

  // Monitoring Form State (JSONB Extensible Data Model)
  const [monitoringDate, setMonitoringDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [attendanceCount, setAttendanceCount] = useState<number>(groupMembers.length || 12);
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

  const handleMonitoringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTopic.trim()) return;

    submitMonitoringRecord({
      group_id: activeGroup.id,
      group_name: activeGroup.name,
      mentor_id: currentUser.id,
      mentor_name: currentUser.name,
      date: monitoringDate,
      data: {
        attendanceCount: Number(attendanceCount),
        totalMembers: groupMembers.length || activeGroup.memberCount,
        meetingTopic,
        spiritualTemperature,
        prayerRequests,
        followUpsNeeded,
        fellowshipActivity,
        offeringAmount: Number(offeringAmount),
        customNotes,
      },
    });

    // Reset Form
    setMeetingTopic('');
    setPrayerRequests('');
    setFollowUpsNeeded('');
    setFellowshipActivity('');
    setOfferingAmount(0);
    setCustomNotes('');
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

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberFormData.name.trim()) return;

    if (editingMember) {
      updateGroupMember(editingMember.id, {
        name: memberFormData.name,
        email: memberFormData.email,
        phone: memberFormData.phone,
        is_mentor: memberFormData.familyRole !== 'MENTEE',
        familyRole: memberFormData.familyRole,
        attendanceRate: Number(memberFormData.attendanceRate),
        notes: memberFormData.notes,
      });
    } else {
      addGroupMember({
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
  };

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
                {activeGroup.memberCount} Anggota
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
      <div className="flex items-center gap-2 border-b border-[#D9D7D0]/60 pb-3">
        <button
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
          onClick={() => setActiveTab('members')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'members'
              ? 'bg-[#181818] text-white shadow-md'
              : 'bg-white text-[#1B1B1B] hover:bg-[#F0EFEB] border border-[#D9D7D0]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-emerald-500" />
          <span>{mon.tabMembers} ({groupMembers.length})</span>
        </button>

        <button
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
      </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
                    Tanggal Pertemuan *
                  </label>
                  <DatePicker
                    value={monitoringDate}
                    onChange={setMonitoringDate}
                    placeholder="Pilih tanggal pertemuan"
                  />
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
                      onChange={(e) => setAttendanceCount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold focus:outline-none focus:border-black"
                    />
                    <span className="text-xs text-[#8C8880] whitespace-nowrap">
                      / {groupMembers.length || activeGroup.memberCount} Anggota
                    </span>
                  </div>
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
                Daftar nama pemuda yang terdaftar dalam kelompok sel ini.
              </p>
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
                {groupMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-[#FAF9F5] transition-colors">
                    <td className="py-3.5 pl-2 font-bold text-[#1B1B1B]">
                      {m.name}
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
                            onClick={() => {
                              if (confirm(`Hapus anggota "${m.name}"?`)) {
                                deleteGroupMember(m.id);
                              }
                            }}
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

      {/* TAB 5: ATTENDANCE (server-backed, TiDB) */}
      {activeTab === 'absensi' && activeGroup && (
        <AttendancePanel
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          canWrite={canWriteMonitoring}
          members={groupMembers}
        />
      )}

      {activeTab === 'albums' && activeGroup && (
        <GroupAlbumsPanel
          groupId={activeGroup.id}
          canCreate={canWriteMonitoring}
          canUpload={Boolean(hasAssignedGroup || canWriteMonitoring)}
        />
      )}

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
