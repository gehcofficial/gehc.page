import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Users, ShieldCheck, Loader2, Search, ChevronDown, ChevronUp, Trash2, Edit2, Filter, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleAssignmentWizard } from './RoleAssignmentWizard';

interface RoleAssignment {
  id: string;
  userId: string;
  role: string;
  position: string | null;
  division: string | null;
  subdivision: string | null;
  groupId: string | null;
  familyRole: string | null;
  assignedBy: string;
  assignedAt: string;
  isActive: boolean;
  note: string | null;
  group?: { id: string; name: string } | null;
}

interface UserRoleLegacy {
  id: number;
  userId: string;
  tenantId: string;
  role: string;
  groupId: string | null;
  assignmentId: string | null;
}

interface YouthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  roles: UserRoleLegacy[];
  roleAssignments: RoleAssignment[];
}

type MainFilter = 'ALL' | 'BEYONDERS' | 'TIMKERJA' | 'KOMISI' | 'BPMJ';

const MAIN_FILTERS: { id: MainFilter; label: string; color: string }[] = [
  { id: 'ALL', label: 'All', color: 'bg-[#181818] text-white' },
  { id: 'BEYONDERS', label: 'Beyonders', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'TIMKERJA', label: 'Tim Kerja', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'KOMISI', label: 'Komisi', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'BPMJ', label: 'BPMJ', color: 'bg-blue-100 text-blue-700' },
];

const BEYONDER_ROLES = ['MENTOR', 'CO_MENTOR', 'MENTEE'];

const ROLE_COLORS: Record<string, string> = {
  BPMJ: 'bg-blue-100 text-blue-700',
  KOMISI: 'bg-indigo-100 text-indigo-700',
  COMMITTEE: 'bg-cyan-100 text-cyan-700',
  MENTOR: 'bg-emerald-100 text-emerald-700',
  CO_MENTOR: 'bg-emerald-100 text-emerald-700',
  MENTEE: 'bg-emerald-100 text-emerald-700',
  ALUMNI: 'bg-slate-100 text-slate-500',
  COMMUNITY: 'bg-emerald-100 text-emerald-700',
};

const ROLE_LABELS: Record<string, string> = {
  BPMJ: 'BPMJ',
  KOMISI: 'Komisi',
  COMMITTEE: 'Tim Kerja',
  MENTOR: 'Community',
  CO_MENTOR: 'Community',
  MENTEE: 'Community',
  ALUMNI: 'Alumni',
  COMMUNITY: 'Community',
};

// Tim Kerja groupings
const TIMKERJA_GROUPS = [
  { key: 'BOD', label: 'BOD', divisions: ['TIMKERJA'] },
  { key: 'PANCA_TUGAS', label: 'Panca Tugas', divisions: ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'] },
  { key: 'BENZARPR', label: 'Benzarpreneurship', divisions: ['BENZARPR'] },
];

const BEYONDER_GROUPS = [
  { id: 'grp-1', name: 'Avodah', color: '#FF416C' },
  { id: 'grp-2', name: 'Agape', color: '#E94057' },
  { id: 'grp-3', name: 'Shalom', color: '#2A81FF' },
  { id: 'grp-4', name: 'Hesed', color: '#8A2387' },
  { id: 'grp-5', name: 'Kairos', color: '#F27121' },
  { id: 'grp-6', name: 'Logos', color: '#00B4D8' },
  { id: 'grp-7', name: 'Metanoia', color: '#059669' },
  { id: 'grp-8', name: 'Koinonia', color: '#0EA5E9' },
  { id: 'grp-9', name: 'Diakonia', color: '#EA580C' },
  { id: 'grp-10', name: 'Marturia', color: '#DC2626' },
];

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

function hasRoleInAssignment(y: YouthUser, role: string): boolean {
  return y.roleAssignments?.some((ra) => ra.isActive && ra.role === role) || false;
}

function hasRoleInLegacy(y: YouthUser, role: string): boolean {
  return y.roles?.some((ur) => ur.role === role) || false;
}

function matchesMainFilter(y: YouthUser, filter: MainFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'BEYONDERS') {
    return BEYONDER_ROLES.some((r) => hasRoleInAssignment(y, r) || hasRoleInLegacy(y, r));
  }
  if (filter === 'TIMKERJA') {
    return hasRoleInAssignment(y, 'COMMITTEE') || hasRoleInLegacy(y, 'COMMITTEE');
  }
  return hasRoleInAssignment(y, filter) || hasRoleInLegacy(y, filter);
}

function buildSubFilters(y: YouthUser[], filter: MainFilter): Array<{ key: string; label: string; count: number }> {
  if (filter === 'ALL') return [];

  const usersWithFilter = y.filter((u) => matchesMainFilter(u, filter));

  if (filter === 'BPMJ' || filter === 'KOMISI') {
    const posMap: Record<string, number> = {};
    const roleKey = filter === 'BPMJ' ? 'BPMJ' : 'KOMISI';
    usersWithFilter.forEach((u) => {
      u.roleAssignments
        .filter((ra) => ra.isActive && ra.role === roleKey)
        .forEach((ra) => {
          const pos = ra.position || 'Anggota';
          posMap[pos] = (posMap[pos] || 0) + 1;
        });
    });
    return Object.entries(posMap).map(([label, count]) => ({ key: label, label, count }));
  }

  if (filter === 'TIMKERJA') {
    const groupCounts: Record<string, number> = {};
    TIMKERJA_GROUPS.forEach((g) => { groupCounts[g.key] = 0; });
    usersWithFilter.forEach((u) => {
      u.roleAssignments
        .filter((ra) => ra.isActive && ra.role === 'COMMITTEE')
        .forEach((ra) => {
          const grp = TIMKERJA_GROUPS.find((g) => g.divisions.includes(ra.division || ''));
          if (grp) {
            groupCounts[grp.key] = (groupCounts[grp.key] || 0) + 1;
          }
        });
    });
    return TIMKERJA_GROUPS
      .map((g) => ({ key: g.key, label: g.label, count: groupCounts[g.key] || 0 }))
      .filter((g) => g.count > 0);
  }

  if (filter === 'BEYONDERS') {
    const groupMap: Record<string, number> = {};
    usersWithFilter.forEach((u) => {
      u.roleAssignments
        .filter((ra) => ra.isActive && BEYONDER_ROLES.includes(ra.role))
        .forEach((ra) => {
          const grp = ra.group?.name || 'Tanpa Group';
          groupMap[grp] = (groupMap[grp] || 0) + 1;
        });
    });
    return Object.entries(groupMap).map(([label, count]) => ({ key: label, label, count }));
  }

  return [];
}

function matchesSubFilter(y: YouthUser, filter: MainFilter, subKey: string | null): boolean {
  if (!subKey) return true;

  if (filter === 'BPMJ' || filter === 'KOMISI') {
    const roleKey = filter === 'BPMJ' ? 'BPMJ' : 'KOMISI';
    return y.roleAssignments.some(
      (ra) => ra.isActive && ra.role === roleKey && (ra.position || 'Anggota') === subKey
    );
  }

  if (filter === 'TIMKERJA') {
    const grp = TIMKERJA_GROUPS.find((g) => g.key === subKey);
    if (!grp) return false;
    return y.roleAssignments.some(
      (ra) => ra.isActive && ra.role === 'COMMITTEE' && grp.divisions.includes(ra.division || '')
    );
  }

  if (filter === 'BEYONDERS') {
    return y.roleAssignments.some(
      (ra) => ra.isActive && BEYONDER_ROLES.includes(ra.role) && (ra.group?.name || 'Tanpa Group') === subKey
    );
  }

  return true;
}

function displayRoles(user: YouthUser): Array<{ key: string; role: string; label: string; color: string; detail: string }> {
  if (user.roleAssignments?.length > 0) {
    return user.roleAssignments
      .filter((ra) => ra.isActive)
      .map((ra) => {
        if (BEYONDER_ROLES.includes(ra.role)) {
          const detail = ra.group?.name
            ? `${ra.group.name} ${ra.familyRole || ''}`.trim()
            : 'Individu';
          return {
            key: ra.id,
            role: 'COMMUNITY',
            label: 'Community',
            color: ROLE_COLORS.COMMUNITY,
            detail,
          };
        }

        const parts: string[] = [];
        if (ra.position) parts.push(ra.position);
        if (ra.division) parts.push(ra.subdivision ? `${ra.division}/${ra.subdivision}` : ra.division);
        return {
          key: ra.id,
          role: ra.role,
          label: ROLE_LABELS[ra.role] || ra.role,
          color: ROLE_COLORS[ra.role] || 'bg-gray-100 text-gray-600',
          detail: parts.join(' · '),
        };
      });
  }

  return (user.roles || []).map((ur) => ({
    key: `legacy-${ur.id}`,
    role: ur.role,
    label: ROLE_LABELS[ur.role] || ur.role,
    color: ROLE_COLORS[ur.role] || 'bg-gray-100 text-gray-600',
    detail: '',
  }));
}

interface BeyondersGroupData {
  group: { id: string; name: string; color: string } | null;
  members: Array<{
    user: YouthUser;
    role: 'MENTOR' | 'CO_MENTOR' | 'MENTEE';
    isPending: boolean;
    assignmentId: string;
  }>;
}

export const YouthGEHCList: React.FC = () => {
  const { addToast } = useApp();
  const [youth, setYouth] = useState<YouthUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [mainFilter, setMainFilter] = useState<MainFilter>('ALL');
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [assignWizardUser, setAssignWizardUser] = useState<{ id: string; name: string; email: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youth-gehc', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setYouth(d.youth || []);
      }
    } catch (err) {
      console.error('Failed to fetch youth GEHC:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSubFilter(null); }, [mainFilter]);

  const allFiltered = useMemo(() => {
    if (!youth) return [];
    return youth.filter((y) => {
      if (!q) return true;
      return y.name.toLowerCase().includes(q.toLowerCase()) || y.email?.toLowerCase().includes(q.toLowerCase());
    });
  }, [youth, q]);

  const mainCounts = useMemo(() => {
    const counts: Record<MainFilter, number> = { ALL: 0, BEYONDERS: 0, TIMKERJA: 0, KOMISI: 0, BPMJ: 0 };
    allFiltered.forEach((y) => {
      counts.ALL++;
      if (BEYONDER_ROLES.some((r) => hasRoleInAssignment(y, r) || hasRoleInLegacy(y, r))) counts.BEYONDERS++;
      if (hasRoleInAssignment(y, 'COMMITTEE') || hasRoleInLegacy(y, 'COMMITTEE')) counts.TIMKERJA++;
      if (hasRoleInAssignment(y, 'KOMISI') || hasRoleInLegacy(y, 'KOMISI')) counts.KOMISI++;
      if (hasRoleInAssignment(y, 'BPMJ') || hasRoleInLegacy(y, 'BPMJ')) counts.BPMJ++;
    });
    return counts;
  }, [allFiltered]);

  const subFilters = useMemo(() => buildSubFilters(allFiltered, mainFilter), [allFiltered, mainFilter]);

  const displayed = useMemo(() => {
    return allFiltered.filter((y) => matchesMainFilter(y, mainFilter) && matchesSubFilter(y, mainFilter, subFilter));
  }, [allFiltered, mainFilter, subFilter]);

  // Build Beyonders grouped data
  const beyondersGrouped = useMemo((): BeyondersGroupData[] => {
    const groupMap = new Map<string, BeyondersGroupData>();
    
    // Initialize all 10 groups
    BEYONDER_GROUPS.forEach((g) => {
      groupMap.set(g.name, { group: g, members: [] });
    });
    groupMap.set('Tanpa Group', { group: null, members: [] });

    allFiltered.forEach((y) => {
      y.roleAssignments
        .filter((ra) => ra.isActive && BEYONDER_ROLES.includes(ra.role))
        .forEach((ra) => {
          const groupName = ra.group?.name || 'Tanpa Group';
          const gData = groupMap.get(groupName);
          if (gData) {
            // Check if this assignment is pending (from PlacementItem with status PENDING/APPROVED/REVISED)
            const isPending = ra.note?.includes('BEYONDERS: Pending') || false;
            gData.members.push({
              user: y,
              role: ra.role as 'MENTOR' | 'CO_MENTOR' | 'MENTEE',
              isPending,
              assignmentId: ra.id,
            });
          }
        });
    });

    return Array.from(groupMap.values()).filter((g) => g.members.length > 0);
  }, [allFiltered]);

  const revokeRole = async (assignmentId: string) => {
    setRevokingId(assignmentId);
    try {
      await fetch(`/api/role-assignments/${assignmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      addToast({ type: 'success', title: 'Role Dicabut', description: 'Role assignment berhasil dicabut.' });
      fetchData();
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal mencabut role.' });
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat Youth GEHC…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
          <Users className="w-3.5 h-3.5 text-[#FF416C]" />
          <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
            Youth GEHC · {mainCounts.ALL} Anggota
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Youth GEHC</h2>
        <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
          Semua anggota yang sudah mendapat role. Klik untuk lihat detail multi-role.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8880]" />
        <input
          placeholder="Cari nama atau email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-full bg-white border border-[#D9D7D0] text-xs font-medium"
        />
      </div>

      {/* Main Role Slicer */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {MAIN_FILTERS.map((f) => {
          const isActive = mainFilter === f.id;
          const count = mainCounts[f.id] || 0;
          return (
            <button
              key={f.id}
              onClick={() => setMainFilter(f.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all shrink-0 ${
                isActive ? 'bg-[#181818] text-white shadow-md' : 'bg-[#F3F1EC] text-[#8C8880] hover:bg-gray-200'
              }`}
            >
              {f.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-0.5 ${
                isActive ? 'bg-white/20 text-white' : 'bg-[#D9D7D0] text-[#8C8880]'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tabs (only for Tim Kerja, Komisi, BPMJ) */}
      {subFilters.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {subFilters.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setSubFilter(subFilter === sf.key ? null : sf.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold whitespace-nowrap transition-all shrink-0 ${
                subFilter === sf.key
                  ? 'bg-[#FF416C] text-white'
                  : 'bg-white border border-[#D9D7D0] text-[#8C8880] hover:border-[#FF416C]/40'
              }`}
            >
              {sf.label}
              <span className={`text-[8px] px-1 py-0.5 rounded ${
                subFilter === sf.key ? 'bg-white/20 text-white' : 'bg-[#F3F1EC] text-[#8C8880]'
              }`}>
                {sf.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Result Count */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-[#8C8880]">
          Menampilkan {displayed.length} dari {mainCounts.ALL} anggota
          {mainFilter !== 'ALL' && (
            <button onClick={() => setMainFilter('ALL')} className="ml-2 text-[#FF416C] hover:underline">
              Reset filter
            </button>
          )}
        </p>
      </div>

      {/* Content based on mainFilter */}
      {mainFilter === 'BEYONDERS' ? (
        // BEYONDERS TAB - Grouped by 10 groups with pending indicator
        <div className="space-y-4">
          {beyondersGrouped.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-12 text-center">
              <Users className="w-8 h-8 text-[#8C8880] mx-auto mb-3" />
              <p className="text-sm font-bold text-[#1B1B1B]">Belum ada Beyonders</p>
              <p className="text-xs text-[#8C8880] mt-1">Belum ada anggota kelompok mentoring.</p>
            </div>
          ) : (
            beyondersGrouped.map((gData) => (
              <div key={gData.group?.name || 'no-group'} className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
                {/* Group Header */}
                <div className="px-4 py-3 border-b border-[#D9D7D0]/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {gData.group && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: gData.group.color }}>
                        {gData.group.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-[#1B1B1B]">{gData.group?.name || 'Tanpa Group'}</p>
                      <p className="text-[10px] text-[#8C8880]">
                        {gData.members.length} anggota
                        {gData.members.some(m => m.isPending) && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                            {gData.members.filter(m => m.isPending).length} Pending
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 text-[9px] text-[#8C8880]">
                    {gData.members.filter(m => m.role === 'MENTOR').length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">M: {gData.members.filter(m => m.role === 'MENTOR').length}</span>
                    )}
                    {gData.members.filter(m => m.role === 'CO_MENTOR').length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700">CM: {gData.members.filter(m => m.role === 'CO_MENTOR').length}</span>
                    )}
                    {gData.members.filter(m => m.role === 'MENTEE').length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">Me: {gData.members.filter(m => m.role === 'MENTEE').length}</span>
                    )}
                  </div>
                </div>

                {/* Group Members */}
                <div className="p-4 space-y-2">
                  {gData.members.map((member) => {
                    const roles = displayRoles(member.user).filter(r => BEYONDER_ROLES.includes(r.role));
                    return (
                      <div key={member.assignmentId} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        member.isPending ? 'bg-amber-50 border-l-4 border-amber-400' : 'bg-[#FAF9F5] hover:bg-[#F3F1EC]'
                      }`}>
                        <img
                          src={member.user.avatar || initialsAvatar(member.user.name)}
                          alt={member.user.name}
                          className="w-9 h-9 rounded-full object-cover border border-[#D9D7D0]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold truncate">{member.user.name}</p>
                            {member.isPending && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                                <AlertCircle className="w-2.5 h-2.5" /> Menunggu Review
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#8C8880] truncate">{member.user.email || 'No email'}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${
                            member.role === 'MENTOR' ? 'bg-emerald-100 text-emerald-700' :
                            member.role === 'CO_MENTOR' ? 'bg-teal-100 text-teal-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {member.role === 'MENTOR' ? 'Mentor' : member.role === 'CO_MENTOR' ? 'Co-Mentor' : 'Mentee'}
                          </span>
                          <button
                            onClick={() => revokeRole(member.assignmentId)}
                            disabled={revokingId === member.assignmentId}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                            title="Cabut role"
                          >
                            {revokingId === member.assignmentId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : mainFilter === 'TIMKERJA' || mainFilter === 'KOMISI' || mainFilter === 'BPMJ' ? (
        // TIM KERJA / KOMISI / BPMJ - Standard list with sub-tabs
        <div className="space-y-2">
          {displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-12 text-center">
              <Users className="w-8 h-8 text-[#8C8880] mx-auto mb-3" />
              <p className="text-sm font-bold text-[#1B1B1B]">
                {mainFilter === 'ALL' ? 'Belum ada Youth GEHC' : `Tidak ada anggota ${MAIN_FILTERS.find((f) => f.id === mainFilter)?.label}`}
              </p>
              <p className="text-xs text-[#8C8880] mt-1">
                {mainFilter === 'ALL' ? 'Role assignment belum dilakukan.' : 'Tidak ada anggota dengan filter ini.'}
              </p>
            </div>
          ) : (
            displayed.map((y) => {
              const isExpanded = expanded === y.id;
              const roles = displayRoles(y);

              return (
                <div key={y.id} className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
                  <div className="w-full flex items-center gap-3 p-4">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : y.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <img
                        src={y.avatar || initialsAvatar(y.name)}
                        alt={y.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#D9D7D0]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{y.name}</p>
                        <p className="text-[10px] text-[#8C8880] truncate">{y.email || 'No email'}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0 max-w-[200px] justify-end">
                        {roles.slice(0, 3).map((r) => (
                          <span key={r.key} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${r.color}`}>
                            {r.label}
                          </span>
                        ))}
                        {roles.length > 3 && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            +{roles.length - 3}
                          </span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8C8880] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#8C8880] shrink-0" />}
                    </button>

                    {/* Assign Role button */}
                    <button
                      onClick={() => setAssignWizardUser({ id: y.id, name: y.name, email: y.email })}
                      className="p-2 rounded-xl bg-[#FF416C]/10 hover:bg-[#FF416C]/20 text-[#FF416C] shrink-0 transition-colors"
                      title="Assign Role"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[#D9D7D0]/40">
                      <div className="pt-3 space-y-2">
                        {roles.length === 0 ? (
                          <p className="text-xs text-[#8C8880]">Tidak ada role aktif.</p>
                        ) : (
                          roles.map((r) => (
                            <div key={r.key} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FAF9F5]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded shrink-0 ${r.color}`}>
                                  {r.label}
                                </span>
                                {r.detail && <span className="text-[10px] text-[#8C8880] truncate">{r.detail}</span>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {r.key.startsWith('legacy-') ? (
                                  <span className="text-[8px] text-[#8C8880] italic">legacy</span>
                                ) : (
                                  <button
                                    onClick={() => revokeRole(r.key)}
                                    disabled={revokingId === r.key}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                                    title="Cabut role"
                                  >
                                    {revokingId === r.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        // ALL tab - Standard list
        <div className="space-y-2">
          {displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-12 text-center">
              <Users className="w-8 h-8 text-[#8C8880] mx-auto mb-3" />
              <p className="text-sm font-bold text-[#1B1B1B]">Belum ada Youth GEHC</p>
              <p className="text-xs text-[#8C8880] mt-1">Role assignment belum dilakukan.</p>
            </div>
          ) : (
            displayed.map((y) => {
              const isExpanded = expanded === y.id;
              const roles = displayRoles(y);

              return (
                <div key={y.id} className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
                  <div className="w-full flex items-center gap-3 p-4">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : y.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <img
                        src={y.avatar || initialsAvatar(y.name)}
                        alt={y.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#D9D7D0]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{y.name}</p>
                        <p className="text-[10px] text-[#8C8880] truncate">{y.email || 'No email'}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0 max-w-[200px] justify-end">
                        {roles.slice(0, 3).map((r) => (
                          <span key={r.key} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${r.color}`}>
                            {r.label}
                          </span>
                        ))}
                        {roles.length > 3 && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            +{roles.length - 3}
                          </span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8C8880] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#8C8880] shrink-0" />}
                    </button>

                    {/* Assign Role button */}
                    <button
                      onClick={() => setAssignWizardUser({ id: y.id, name: y.name, email: y.email })}
                      className="p-2 rounded-xl bg-[#FF416C]/10 hover:bg-[#FF416C]/20 text-[#FF416C] shrink-0 transition-colors"
                      title="Assign Role"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[#D9D7D0]/40">
                      <div className="pt-3 space-y-2">
                        {roles.length === 0 ? (
                          <p className="text-xs text-[#8C8880]">Tidak ada role aktif.</p>
                        ) : (
                          roles.map((r) => (
                            <div key={r.key} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FAF9F5]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded shrink-0 ${r.color}`}>
                                  {r.label}
                                </span>
                                {r.detail && <span className="text-[10px] text-[#8C8880] truncate">{r.detail}</span>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {r.key.startsWith('legacy-') ? (
                                  <span className="text-[8px] text-[#8C8880] italic">legacy</span>
                                ) : (
                                  <button
                                    onClick={() => revokeRole(r.key)}
                                    disabled={revokingId === r.key}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                                    title="Cabut role"
                                  >
                                    {revokingId === r.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Assign Role Wizard Modal */}
      {assignWizardUser && (
        <RoleAssignmentWizard
          userId={assignWizardUser.id}
          userName={assignWizardUser.name}
          onClose={() => setAssignWizardUser(null)}
          onAssigned={() => {
            setAssignWizardUser(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};