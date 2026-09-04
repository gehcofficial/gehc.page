import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  BookOpen,
  Calendar,
  TrendingUp,
  Shield,
  ArrowRight,
  FolderSync,
  ClipboardList,
} from 'lucide-react';
import { useWaitingPoolCount, useUpcomingBirthdays } from '../../hooks/usePortalQueries';
import { useLang } from '../../context/LangContext';
import { YouthCalendarPanel } from './YouthCalendarPanel';
import { displayAvatar } from '../../lib/avatar';

export const PortalDashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const {
    currentTenant,
    currentUser,
    currentRole,
    groups,
    monitoringRecords,
    contentItems,
    isSuperAdmin,
    isCommittee,
    isKomisi,
    isGroupMentor,
    isMentee,
    isAlumni,
    userAssignedGroupId,
    integrationConfig,
  } = useApp();
  const { t } = useLang();

  const isAdminView = isSuperAdmin || isCommittee || isKomisi;
  const isGroupScoped = (isGroupMentor || isMentee) && userAssignedGroupId;

  const { data: onboardingCount = 0 } = useWaitingPoolCount(isKomisi || isSuperAdmin);
  const { data: upcomingBirthdays = [] } = useUpcomingBirthdays(7, true);

  const visibleGroups = useMemo(() => {
    if (isAlumni) return [];
    if (isGroupScoped) return groups.filter((g) => g.id === userAssignedGroupId);
    return groups;
  }, [groups, isAlumni, isGroupScoped, userAssignedGroupId]);

  const activeWeeklyCount = contentItems.filter(
    (c) => c.type === 'WEEKLY_INFO' && c.is_published
  ).length;

  const activeActivityCount = contentItems.filter(
    (c) => c.type === 'ACTIVITY' && c.is_published
  ).length;

  const totalMembersCount = visibleGroups.reduce((acc, g) => acc + g.memberCount, 0);

  const groupsWithRecentMonitoring = visibleGroups.map((grp) => {
    const records = monitoringRecords.filter((m) => m.group_id === grp.id);
    const latest = records[0];
    return {
      ...grp,
      hasRecentLog: !!latest,
      latestDate: latest ? latest.date : t.portal.dashboard.noData,
      attendanceCount: latest ? latest.data.attendanceCount : 0,
      spiritualTemp: latest ? latest.data.spiritualTemperature : t.portal.dashboard.notFilled,
    };
  });

  const compliancePercentage = visibleGroups.length
    ? Math.round(
        (groupsWithRecentMonitoring.filter((g) => g.hasRecentLog).length / visibleGroups.length) * 100
      )
    : 0;

  const assignedGroup = userAssignedGroupId
    ? groups.find((g) => g.id === userAssignedGroupId)
    : undefined;

  const portalSubtitle = isAlumni
    ? t.portal.dashboard.subtitleAlumni
    : isGroupMentor
    ? t.portal.dashboard.subtitleMentor
    : isMentee
    ? t.portal.dashboard.subtitleMentee
    : t.portal.dashboard.subtitleDefault;

  const showMonitoringCta = !isAlumni;
  const showContentCta = isSuperAdmin || isCommittee;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gradient-to-r from-[#181818] via-[#222222] to-[#181818] rounded-[32px] p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-white/10">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-[#FF416C]/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                {currentTenant.name}
              </span>
              <span className="text-xs text-white/60">• {portalSubtitle}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Selamat Melayani, {currentUser.name}!
            </h2>
            <p className="text-xs sm:text-sm text-white/70 max-w-xl">
              Hak akses aktif Anda adalah <strong className="text-[#FF416C] uppercase">{currentRole}</strong>.
              {isGroupScoped && assignedGroup && (
                <span> Kelompok <strong>{assignedGroup.name}</strong>.</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {showContentCta && (
              <button
                onClick={() => onNavigate('content-weekly')}
                className="px-4 py-2.5 rounded-full bg-[#FF416C] hover:bg-[#FF4B2B] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>+ Buat Warta Baru</span>
              </button>
            )}

            {showMonitoringCta && (
              <button
                onClick={() => onNavigate('groups-monitoring')}
                className="px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>
                  {isGroupMentor
                    ? 'Input Monitoring Kelompok'
                    : isMentee
                    ? 'Lihat Monitoring Kelompok'
                    : 'Monitoring 10 Kelompok'}
                </span>
              </button>
            )}

            {(isKomisi || isSuperAdmin) && onboardingCount > 0 && (
              <button
                onClick={() => onNavigate('onboarding')}
                className="px-4 py-2.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-xs font-bold transition-all border border-amber-400/30 flex items-center gap-2"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>{onboardingCount} di Onboarding</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isAlumni ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm">
            <span className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Status</span>
            <p className="text-2xl font-black text-[#1B1B1B] mt-2">Alumni</p>
            <p className="text-[11px] text-[#8C8880] mt-1">Profil tetap dapat diperbarui; akses monitoring nonaktif.</p>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm">
            <span className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Konten Publik</span>
            <p className="text-2xl font-black text-[#1B1B1B] mt-2">{activeWeeklyCount + activeActivityCount}</p>
            <p className="text-[11px] text-[#8C8880] mt-1">Warta & agenda aktif di youth.gehc.page</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">
                {isGroupScoped ? 'Anggota Kelompok' : 'Total Anggota'}
              </span>
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-[#1B1B1B]">{totalMembersCount}</div>
              <p className="text-[11px] text-[#8C8880] mt-1">
                {isGroupScoped
                  ? `Kelompok ${assignedGroup?.name || ''}`
                  : 'Terbagi dalam 10 kelompok pemuda'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Kepatuhan Monitoring</span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-[#1B1B1B]">{compliancePercentage}%</div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                {groupsWithRecentMonitoring.filter((g) => g.hasRecentLog).length} dari {visibleGroups.length} grup terdata
              </p>
            </div>
          </div>

          {(isAdminView || isAlumni) && (
            <>
              <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Warta Diterbitkan</span>
                  <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#1B1B1B]">{activeWeeklyCount}</div>
                  <p className="text-[11px] text-[#8C8880] mt-1">Live di youth.gehc.page</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#8C8880] uppercase tracking-wider">Agenda Aktif</span>
                  <div className="w-9 h-9 rounded-2xl bg-pink-50 text-[#FF416C] flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#1B1B1B]">{activeActivityCount}</div>
                  <p className="text-[11px] text-[#8C8880] mt-1">Kegiatan mendatang</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {upcomingBirthdays.length > 0 && (
        <div className="bg-white rounded-[32px] p-6 border border-[#D9D7D0]/50 shadow-sm">
          <h3 className="text-sm font-bold mb-3">Ulang tahun minggu ini</h3>
          <div className="flex flex-wrap gap-2">
            {upcomingBirthdays.map((b: { id: string; name: string; avatar?: string; daysToBirthday?: number }) => (
              <span key={b.id} className="inline-flex items-center gap-2 text-[10px] font-bold px-2 py-1.5 rounded-full bg-pink-50 text-pink-700">
                <img src={displayAvatar(b.name, b.avatar)} alt="" className="w-6 h-6 rounded-full object-cover" />
                {b.name.split(' ')[0]} · {b.daysToBirthday === 0 ? 'Hari ini' : `${b.daysToBirthday} hari`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] p-6 border border-[#D9D7D0]/50 shadow-sm">
        <h3 className="text-sm font-bold mb-3">Kalender pemuda</h3>
        <YouthCalendarPanel compact />
      </div>

      {!isAlumni && visibleGroups.length > 0 && (
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#D9D7D0]/40">
            <div>
              <h3 className="text-lg font-bold text-[#1B1B1B] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF416C]" />
                {isGroupScoped
                  ? `Monitoring — ${assignedGroup?.name || 'Kelompok'}`
                  : 'Status Monitoring 10 Kelompok Sel Pemuda'}
              </h3>
              <p className="text-xs text-[#8C8880] mt-0.5">
                {isMentee
                  ? 'Lihat laporan kehadiran dan evaluasi rohani kelompokmu.'
                  : 'Laporan kehadiran, evaluasi rohani, dan pokok doa yang dimasukkan oleh Mentor.'}
              </p>
            </div>

            {showMonitoringCta && (
              <button
                onClick={() => onNavigate('groups-monitoring')}
                className="text-xs font-bold text-[#1B1B1B] hover:text-[#FF416C] flex items-center gap-1 transition-colors self-start sm:self-auto"
              >
                <span>Buka Modul Monitoring Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D9D7D0]/60 text-[#8C8880] uppercase tracking-wider font-semibold">
                  <th className="pb-3 pl-2">Kelompok</th>
                  <th className="pb-3">Mentor Pendamping</th>
                  <th className="pb-3">Laporan Terakhir</th>
                  <th className="pb-3">Kehadiran</th>
                  <th className="pb-3">Suhu Rohani</th>
                  {!isMentee && <th className="pb-3 pr-2 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9D7D0]/30">
                {groupsWithRecentMonitoring.map((grp) => {
                  const isMyGroup = userAssignedGroupId === grp.id;

                  return (
                    <tr
                      key={grp.id}
                      className={`hover:bg-[#FAF9F5] transition-colors ${
                        isMyGroup ? 'bg-blue-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: grp.color }}
                          ></div>
                          <span className="font-bold text-[#1B1B1B]">{grp.name}</span>
                          {isMyGroup && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase">
                              Grup Anda
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 text-[#1B1B1B]">{grp.mentorNames.join(', ')}</td>
                      <td className="py-3.5 text-[#8C8880]">{grp.latestDate}</td>
                      <td className="py-3.5">
                        {grp.hasRecentLog ? (
                          <span className="font-bold text-[#1B1B1B]">
                            {grp.attendanceCount} / {grp.memberCount} Hadir
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">Belum input</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            grp.spiritualTemp === 'Sangat Baik'
                              ? 'bg-emerald-100 text-emerald-800'
                              : grp.spiritualTemp === 'Baik'
                              ? 'bg-blue-100 text-blue-800'
                              : grp.spiritualTemp === 'Perlu Perhatian'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {grp.spiritualTemp}
                        </span>
                      </td>
                      {!isMentee && (
                        <td className="py-3.5 pr-2 text-right">
                          <button
                            onClick={() => onNavigate('groups-monitoring')}
                            className="px-3 py-1 rounded-full bg-[#181818] hover:bg-black text-white text-[10px] font-bold transition-all"
                          >
                            {isGroupMentor && isMyGroup ? 'Isi Laporan' : 'Lihat'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdminView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-[28px] bg-white border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] text-white flex items-center justify-center shadow-md">
                <FolderSync className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1B1B1B]">Google Drive Storage Bridge</h4>
                <p className="text-xs text-[#8C8880]">
                  Folder: <span className="font-mono text-[11px] text-[#1B1B1B]">{integrationConfig.root_folder_name}</span>
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Connected
            </span>
          </div>

          <div className="p-6 rounded-[28px] bg-white border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gray-100 text-[#1B1B1B] flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1B1B1B]">Role Permissions Active</h4>
                <p className="text-xs text-[#8C8880]">
                  {isSuperAdmin
                    ? 'Akses penuh ke seluruh sistem & konfigurasi'
                    : isCommittee
                    ? 'Akses CMS Warta, Kegiatan, & Monitoring Semua Grup'
                    : isKomisi
                    ? 'Akses onboarding, jemaat, & regenerasi kelompok'
                    : 'Akses sesuai peran aktif'}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-black text-white text-[10px] font-bold uppercase">
              {currentRole}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
