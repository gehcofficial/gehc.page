import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Users, Loader2, Search, ChevronDown, ChevronUp, Trash2, Edit2, Pencil, X, AlertCircle, UserPlus, Link2, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleAssignmentWizard } from './RoleAssignmentWizard';
import { type RecreationalNode } from '../../lib/recreational';
import { AddressForm, addressFromUser, emptyAddress, type AddressValue } from './AddressForm';
import { churchRequestSummaryForAdmin, type ChurchDataRequest } from './ProfileChurchDataRequestPanel';
import { countryName } from '../../lib/countries';

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
  email: string | null;
  avatar: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  addressScope?: string;
  addressCountry?: string;
  addressLine?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  addressNote?: string | null;
  provinceCode?: string | null;
  cityCode?: string | null;
  districtCode?: string | null;
  villageCode?: string | null;
  giftsTop5?: string[] | null;
  isBeyonders?: boolean;
  membershipKind?: 'JEMAAT' | 'SIMPATISAN';
  bipra?: string;
  kolomId?: string | null;
  kolom?: { id: string; number: number; name: string } | null;
  linkStatus?: string;
  authProvider?: string;
  recreational?: Array<{ id: string; slug: string; name: string; kind?: string; parentId?: string | null }>;
  recreationalIds?: string[];
  birthDate?: string | null;
  demographics?: {
    age?: number | null;
    daysToBirthday?: number | null;
    bipraMismatch?: boolean;
    bipraSuggest?: { suggested?: string | null; reason?: string; needsConfirm?: boolean };
  };
  roles: UserRoleLegacy[];
  roleAssignments: RoleAssignment[];
}

interface EditForm {
  name: string;
  gender: string;
  phone: string;
  address: AddressValue;
  giftsTop5: string;
  isBeyonders: boolean;
  bipra: string;
  kolomId: string;
  recreationalIds: string[];
  birthDate: string;
  membershipKind: 'JEMAAT' | 'SIMPATISAN';
}

type MainFilter = 'ALL' | 'INDIVIDU' | 'BEYONDERS' | 'TIMKERJA' | 'KOMISI' | 'BPMJ';

const MAIN_FILTERS: { id: MainFilter; label: string; color: string }[] = [
  { id: 'ALL', label: 'All', color: 'bg-[#181818] text-white' },
  { id: 'INDIVIDU', label: 'Individu', color: 'bg-amber-100 text-amber-800' },
  { id: 'BEYONDERS', label: 'Beyonders', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'TIMKERJA', label: 'Tim Kerja', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'KOMISI', label: 'Komisi', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'BPMJ', label: 'BPMJ', color: 'bg-blue-100 text-blue-700' },
];

const BIPRA_TABS = [
  { id: 'PEMUDA', label: 'Pemuda' },
  { id: 'BAPAK', label: 'Bapak' },
  { id: 'IBU', label: 'Ibu' },
  { id: 'REMAJA', label: 'Remaja' },
  { id: 'ANAK', label: 'Anak' },
  { id: '', label: 'Semua' },
] as const;

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

// Tim Kerja groupings — fallback if org tree not loaded
const TIMKERJA_GROUPS_FALLBACK = [
  { key: 'TIMKERJA_BOD', label: 'BOD', divisions: ['TIMKERJA'] },
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
  if (filter === 'INDIVIDU') {
    return !y.isBeyonders && !BEYONDER_ROLES.some((r) => hasRoleInAssignment(y, r) || hasRoleInLegacy(y, r));
  }
  if (filter === 'BEYONDERS') {
    return Boolean(y.isBeyonders) || BEYONDER_ROLES.some((r) => hasRoleInAssignment(y, r) || hasRoleInLegacy(y, r));
  }
  if (filter === 'TIMKERJA') {
    return hasRoleInAssignment(y, 'COMMITTEE') || hasRoleInLegacy(y, 'COMMITTEE');
  }
  return hasRoleInAssignment(y, filter) || hasRoleInLegacy(y, filter);
}

function buildSubFilters(y: YouthUser[], filter: MainFilter, timKerjaGroups: Array<{ key: string; label: string; divisions: string[] }>): Array<{ key: string; label: string; count: number }> {
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
    timKerjaGroups.forEach((g) => { groupCounts[g.key] = 0; });
    usersWithFilter.forEach((u) => {
      u.roleAssignments
        .filter((ra) => ra.isActive && ra.role === 'COMMITTEE')
        .forEach((ra) => {
          const grp = timKerjaGroups.find((g) => g.divisions.includes(ra.division || ''));
          if (grp) {
            groupCounts[grp.key] = (groupCounts[grp.key] || 0) + 1;
          }
        });
    });
    return timKerjaGroups
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

function matchesSubFilter(y: YouthUser, filter: MainFilter, subKey: string | null, timKerjaGroups: Array<{ key: string; label: string; divisions: string[] }>): boolean {
  if (!subKey) return true;

  if (filter === 'BPMJ' || filter === 'KOMISI') {
    const roleKey = filter === 'BPMJ' ? 'BPMJ' : 'KOMISI';
    return y.roleAssignments.some(
      (ra) => ra.isActive && ra.role === roleKey && (ra.position || 'Anggota') === subKey
    );
  }

  if (filter === 'TIMKERJA') {
    const grp = timKerjaGroups.find((g) => g.key === subKey);
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

function domicileLabel(u: YouthUser): string {
  if (u.addressScope === 'INTL' && u.addressCountry && u.addressCountry !== 'ID') {
    return countryName(u.addressCountry);
  }
  return 'Indonesia';
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
  const [editUser, setEditUser] = useState<YouthUser | null>(null);
  const emptyForm: EditForm = { name: '', gender: '', phone: '', address: emptyAddress(), giftsTop5: '[]', isBeyonders: false, bipra: 'PEMUDA', kolomId: '', recreationalIds: [], birthDate: '', membershipKind: 'JEMAAT' };
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [bipraFilter, setBipraFilter] = useState('PEMUDA');
  const [membershipFilter, setMembershipFilter] = useState<'ALL' | 'JEMAAT' | 'SIMPATISAN'>('ALL');
  const [birthdayFilter, setBirthdayFilter] = useState(false);
  const [kolomFilter, setKolomFilter] = useState('');
  const [domicileFilter, setDomicileFilter] = useState('');
  const [recFilter, setRecFilter] = useState('');
  const [recPillarFilter, setRecPillarFilter] = useState('');
  const [recCategoryFilter, setRecCategoryFilter] = useState('');
  const [recLeafFilter, setRecLeafFilter] = useState('');
  const [kolomList, setKolomList] = useState<Array<{ id: string; number: number; name: string }>>([]);
  const [kolomLeaders, setKolomLeaders] = useState<Record<string, { diaken?: { name: string }; penatua?: { name: string } }>>({});
  const [timKerjaGroups, setTimKerjaGroups] = useState(TIMKERJA_GROUPS_FALLBACK);
  const [recFlat, setRecFlat] = useState<RecreationalNode[]>([]);
  const [creating, setCreating] = useState(false);
  const [claimInfo, setClaimInfo] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addingName, setAddingName] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<Array<{
    id: string;
    name: string;
    kind: string;
    user?: { name?: string; email?: string | null };
  }>>([]);
  const [pendingChurchRequests, setPendingChurchRequests] = useState<Array<
    ChurchDataRequest & { user?: { name?: string; email?: string | null; bipra?: string; kolom?: { name: string } | null } }
  >>([]);
  const [suggestionBusy, setSuggestionBusy] = useState<string | null>(null);
  const [churchRequestBusy, setChurchRequestBusy] = useState<string | null>(null);

  const openEditModal = (user: YouthUser) => {
    setCreating(false);
    setEditUser(user);
    setEditForm({
      name: user.name || '',
      gender: user.gender || '',
      phone: user.phone || '',
      address: addressFromUser(user as any),
      giftsTop5: JSON.stringify(user.giftsTop5 || [], null, 2),
      isBeyonders: Boolean(user.isBeyonders),
      bipra: user.bipra || 'PEMUDA',
      kolomId: user.kolomId || '',
      recreationalIds: user.recreationalIds || user.recreational?.map((g) => g.id) || [],
      birthDate: user.birthDate ? String(user.birthDate).slice(0, 10) : '',
      membershipKind: user.membershipKind || 'JEMAAT',
    });
  };

  const approveBipraSuggest = async (userId: string) => {
    try {
      const res = await fetch(`/api/jemaat/${userId}/bipra-suggest`, { method: 'PATCH', credentials: 'include' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal');
      addToast({ type: 'success', title: 'BIPRA diperbarui', description: 'Kategorial disesuaikan dengan usulan demografi.' });
      fetchData();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal' });
    }
  };

  const renderBipraBanner = (y: YouthUser) => {
    const suggest = y.demographics?.bipraSuggest;
    const mismatch =
      y.demographics?.bipraMismatch ||
      (suggest?.suggested && y.bipra && suggest.suggested !== y.bipra);
    if (!mismatch || !suggest?.suggested) return null;
    const currentLabel = BIPRA_TABS.find((t) => t.id === y.bipra)?.label || y.bipra || '—';
    const suggestedLabel =
      BIPRA_TABS.find((t) => t.id === suggest.suggested)?.label || suggest.suggested;
    return (
      <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-[11px] text-amber-900">
          <p className="font-bold">Konfirmasi kategorial BIPRA</p>
          <p className="mt-0.5">
            Saat ini: {currentLabel}. Usulan: {suggestedLabel}.
            {suggest.reason ? ` ${suggest.reason}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => approveBipraSuggest(y.id)}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold"
        >
          Setujui {suggestedLabel}
        </button>
      </div>
    );
  };

  const openCreateModal = () => {
    setCreating(true);
    setEditUser({} as YouthUser);
    setEditForm({ ...emptyForm });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    let giftsTop5: string[] = [];
    if (!creating) {
      try {
        giftsTop5 = JSON.parse(editForm.giftsTop5);
        if (!Array.isArray(giftsTop5)) throw new Error('not array');
      } catch {
        addToast({ type: 'error', title: 'Gagal', description: 'giftsTop5 harus JSON array valid.' });
        return;
      }
    }
    setEditSaving(true);
    try {
      if (creating) {
        const res = await fetch('/api/jemaat', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editForm.name,
            gender: editForm.gender || null,
            phone: editForm.phone || null,
            ...editForm.address,
            bipra: editForm.bipra,
            kolomId: editForm.kolomId || null,
            isBeyonders: editForm.isBeyonders,
            recreationalIds: editForm.recreationalIds,
            birthDate: editForm.birthDate || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Gagal membuat jemaat');
        }
        addToast({ type: 'success', title: 'Jemaat ditambah', description: editForm.name });
      } else {
        const res = await fetch(`/api/admin/users/${editUser.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editForm.name,
            gender: editForm.gender || null,
            phone: editForm.phone || null,
            ...editForm.address,
            giftsTop5,
            isBeyonders: editForm.isBeyonders,
            bipra: editForm.bipra,
            kolomId: editForm.kolomId || null,
            recreationalIds: editForm.recreationalIds,
            birthDate: editForm.birthDate || null,
            membershipKind: editForm.membershipKind,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Update gagal');
        }
        addToast({ type: 'success', title: 'Profil Diperbarui', description: `${editForm.name} berhasil disimpan.` });
      }
      setEditUser(null);
      setCreating(false);
      fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal menyimpan profil.' });
    } finally {
      setEditSaving(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (bipraFilter) qs.set('bipra', bipraFilter);
      if (kolomFilter) qs.set('kolomId', kolomFilter);
      if (membershipFilter !== 'ALL') qs.set('membershipKind', membershipFilter);
      if (domicileFilter) qs.set('addressScope', domicileFilter);
      if (recFilter) qs.set('recreational', recFilter);
      if (birthdayFilter) qs.set('birthdayWithin', '30');
      const res = await fetch(`/api/jemaat?${qs.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setYouth(d.youth || []);
      }
    } catch (err) {
      console.error('Failed to fetch jemaat:', err);
    } finally {
      setLoading(false);
    }
  }, [bipraFilter, kolomFilter, domicileFilter, recFilter, birthdayFilter, membershipFilter]);

  const fetchMeta = useCallback(async () => {
    try {
      const r = await fetch('/api/jemaat/meta', { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      setKolomList(d.kolom || []);
      setKolomLeaders(d.kolomLeaders || {});
      if (Array.isArray(d.timKerjaBranches) && d.timKerjaBranches.length) {
        setTimKerjaGroups(d.timKerjaBranches);
      }
      setRecFlat(d.recreational || []);
      setPendingSuggestions(d.pendingSuggestions || []);
      setPendingChurchRequests(d.pendingChurchRequests || []);
    } catch { /* skip */ }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const addRecreational = async (payload: { name: string; kind?: string; parentId?: string }) => {
    const name = payload.name.trim();
    if (!name) return;
    setAddingBusy(true);
    try {
      const res = await fetch('/api/recreational', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menambah minat');
      addToast({ type: 'success', title: 'Minat ditambah', description: name });
      setAddingKey(null);
      setAddingName('');
      await fetchMeta();
      if (d.group?.id && d.group.selectable !== false) {
        setEditForm((f) => ({ ...f, recreationalIds: [...f.recreationalIds, d.group.id] }));
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal menambah minat' });
    } finally {
      setAddingBusy(false);
    }
  };

  const approveSuggestion = async (id: string) => {
    setSuggestionBusy(id);
    try {
      const res = await fetch(`/api/recreational/suggestions/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menyetujui');
      addToast({ type: 'success', title: 'Minat disetujui', description: d.group?.name || 'Ditambahkan ke daftar' });
      await fetchMeta();
      await fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal menyetujui' });
    } finally {
      setSuggestionBusy(null);
    }
  };

  const rejectSuggestion = async (id: string) => {
    setSuggestionBusy(id);
    try {
      const res = await fetch(`/api/recreational/suggestions/${id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menolak');
      addToast({ type: 'success', title: 'Saran ditolak' });
      await fetchMeta();
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal menolak' });
    } finally {
      setSuggestionBusy(null);
    }
  };

  const approveChurchRequest = async (id: string) => {
    setChurchRequestBusy(id);
    try {
      const res = await fetch(`/api/profile/church-data-requests/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menyetujui');
      addToast({ type: 'success', title: 'Data gereja diperbarui', description: d.user?.name || 'Permintaan disetujui' });
      await fetchMeta();
      await fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal menyetujui' });
    } finally {
      setChurchRequestBusy(null);
    }
  };

  const rejectChurchRequest = async (id: string) => {
    setChurchRequestBusy(id);
    try {
      const res = await fetch(`/api/profile/church-data-requests/${id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menolak');
      addToast({ type: 'success', title: 'Permintaan ditolak', description: 'Data gereja tidak diubah.' });
      await fetchMeta();
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal', description: err instanceof Error ? err.message : 'Gagal menolak permintaan' });
    } finally {
      setChurchRequestBusy(null);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSubFilter(null); }, [mainFilter]);
  useEffect(() => {
    setRecCategoryFilter('');
    setRecLeafFilter('');
    setRecFilter('');
  }, [recPillarFilter]);
  useEffect(() => {
    setRecLeafFilter('');
    setRecFilter(recCategoryFilter);
  }, [recCategoryFilter]);
  useEffect(() => {
    setRecFilter(recLeafFilter || recCategoryFilter);
  }, [recLeafFilter, recCategoryFilter]);

  const recCategories = useMemo(
    () => recFlat.filter((r) => !r.parentId && (!recPillarFilter || r.kind === recPillarFilter)),
    [recFlat, recPillarFilter]
  );

  const recLeavesInCategory = useMemo(() => {
    if (!recCategoryFilter) return [];
    const cat = recFlat.find((r) => r.slug === recCategoryFilter);
    if (!cat) return [];
    return recFlat.filter((r) => r.parentId === cat.id && r.selectable !== false);
  }, [recFlat, recCategoryFilter]);

  const allFiltered = useMemo(() => {
    if (!youth) return [];
    return youth.filter((y) => {
      if (!q) return true;
      return y.name.toLowerCase().includes(q.toLowerCase()) || y.email?.toLowerCase().includes(q.toLowerCase());
    });
  }, [youth, q]);

  const mainCounts = useMemo(() => {
    const counts: Record<MainFilter, number> = { ALL: 0, INDIVIDU: 0, BEYONDERS: 0, TIMKERJA: 0, KOMISI: 0, BPMJ: 0 };
    allFiltered.forEach((y) => {
      counts.ALL++;
      if (matchesMainFilter(y, 'INDIVIDU')) counts.INDIVIDU++;
      if (matchesMainFilter(y, 'BEYONDERS')) counts.BEYONDERS++;
      if (hasRoleInAssignment(y, 'COMMITTEE') || hasRoleInLegacy(y, 'COMMITTEE')) counts.TIMKERJA++;
      if (hasRoleInAssignment(y, 'KOMISI') || hasRoleInLegacy(y, 'KOMISI')) counts.KOMISI++;
      if (hasRoleInAssignment(y, 'BPMJ') || hasRoleInLegacy(y, 'BPMJ')) counts.BPMJ++;
    });
    return counts;
  }, [allFiltered]);

  const subFilters = useMemo(() => buildSubFilters(allFiltered, mainFilter, timKerjaGroups), [allFiltered, mainFilter, timKerjaGroups]);

  const displayed = useMemo(() => {
    return allFiltered.filter((y) => matchesMainFilter(y, mainFilter) && matchesSubFilter(y, mainFilter, subFilter, timKerjaGroups));
  }, [allFiltered, mainFilter, subFilter, timKerjaGroups]);

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
        Memuat direktori jemaat…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
              <Users className="w-3.5 h-3.5 text-[#FF416C]" />
              <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
                Jemaat · {mainCounts.ALL} orang
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Direktori Jemaat</h2>
            <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
              Kategorial, Kolom, dan rekreasional. Kerja saat ini: Pemuda (Individu / Beyonders).
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#181818] text-white text-[11px] font-bold shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" /> Tambah
          </button>
        </div>
      </div>

      {pendingChurchRequests.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-sky-800">
            Permintaan ubah data gereja ({pendingChurchRequests.length})
          </p>
          {pendingChurchRequests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-sky-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-sky-950">
                  {churchRequestSummaryForAdmin(r, kolomList)}
                </p>
                {r.reason && <p className="text-[10px] text-sky-800 mt-0.5">Alasan: {r.reason}</p>}
              </div>
              <button
                type="button"
                disabled={churchRequestBusy === r.id}
                onClick={() => approveChurchRequest(r.id)}
                className="px-2.5 py-1 rounded-lg bg-[#181818] text-white text-[9px] font-bold disabled:opacity-50"
              >
                Setujui
              </button>
              <button
                type="button"
                disabled={churchRequestBusy === r.id}
                onClick={() => rejectChurchRequest(r.id)}
                className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-[9px] font-bold text-sky-900 disabled:opacity-50"
              >
                Tolak
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingSuggestions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
            Saran minat baru ({pendingSuggestions.length})
          </p>
          {pendingSuggestions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-amber-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-950">{s.name}</p>
                <p className="text-[10px] text-amber-800">
                  {s.kind === 'SPORTS' ? 'Sports' : 'Arts'}
                  {s.user?.name ? ` · ${s.user.name}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={suggestionBusy === s.id}
                onClick={() => approveSuggestion(s.id)}
                className="px-2.5 py-1 rounded-lg bg-[#181818] text-white text-[9px] font-bold disabled:opacity-50"
              >
                Setujui
              </button>
              <button
                type="button"
                disabled={suggestionBusy === s.id}
                onClick={() => rejectSuggestion(s.id)}
                className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-[9px] font-bold text-amber-900 disabled:opacity-50"
              >
                Tolak
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {BIPRA_TABS.map((t) => (
          <button
            key={t.id || 'all'}
            onClick={() => setBipraFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
              bipraFilter === t.id ? 'bg-[#FF416C] text-white' : 'bg-[#F3F1EC] text-[#8C8880]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(['ALL', 'JEMAAT', 'SIMPATISAN'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMembershipFilter(id)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
              membershipFilter === id
                ? id === 'SIMPATISAN' ? 'bg-violet-600 text-white' : 'bg-[#181818] text-white'
                : 'bg-[#F3F1EC] text-[#8C8880]'
            }`}
          >
            {id === 'ALL' ? 'Semua Keanggotaan' : id === 'JEMAAT' ? 'Jemaat' : 'Simpatisan'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={kolomFilter}
          onChange={(e) => setKolomFilter(e.target.value)}
          className="px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[10px] font-bold"
        >
          <option value="">Semua Kolom</option>
          <option value="none">Belum di-assign</option>
          {kolomList.map((k) => {
            const leaders = kolomLeaders[k.id];
            const leaderHint = leaders?.diaken || leaders?.penatua
              ? ` (${[leaders.diaken ? `Diaken: ${leaders.diaken.name}` : null, leaders.penatua ? `Penatua: ${leaders.penatua.name}` : null].filter(Boolean).join(', ')})`
              : '';
            return (
              <option key={k.id} value={k.id}>{k.name}{leaderHint}</option>
            );
          })}
        </select>
        <select
          value={domicileFilter}
          onChange={(e) => setDomicileFilter(e.target.value)}
          className="px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[10px] font-bold"
        >
          <option value="">Semua Domisili</option>
          <option value="ID">Indonesia</option>
          <option value="INTL">Luar negeri</option>
        </select>
        <select
          value={recPillarFilter}
          onChange={(e) => setRecPillarFilter(e.target.value)}
          className="px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[10px] font-bold"
        >
          <option value="">Semua Minat</option>
          <option value="SPORTS">Sports</option>
          <option value="ARTS">Arts</option>
        </select>
        <select
          value={recCategoryFilter}
          onChange={(e) => {
            const v = e.target.value;
            setRecCategoryFilter(v);
            setRecFilter(v);
          }}
          className="px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[10px] font-bold min-w-[140px]"
        >
          <option value="">Semua subkategori</option>
          {recCategories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        {recCategoryFilter && recLeavesInCategory.length > 0 && (
          <select
            value={recLeafFilter}
            onChange={(e) => setRecLeafFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white border border-[#D9D7D0] text-[10px] font-bold min-w-[160px]"
          >
            <option value="">Semua item</option>
            {recLeavesInCategory.map((leaf) => (
              <option key={leaf.id} value={leaf.slug}>{leaf.name}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setBirthdayFilter((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
            birthdayFilter ? 'bg-[#FF416C] text-white' : 'bg-white border border-[#D9D7D0] text-[#8C8880]'
          }`}
        >
          Ulang tahun 30 hari
        </button>
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
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 shrink-0">
                              {domicileLabel(member.user)}
                            </span>
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
                            onClick={() => openEditModal(member.user)}
                            className="p-1.5 rounded-lg hover:bg-[#FF416C]/10 text-[#FF416C]"
                            title="Edit profil"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
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
                {mainFilter === 'ALL' ? 'Belum ada jemaat di filter ini' : `Tidak ada anggota ${MAIN_FILTERS.find((f) => f.id === mainFilter)?.label}`}
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
                        <p className="text-[10px] text-[#8C8880] truncate">
                          {y.email || 'Belum ada email'}
                          {y.kolom ? ` · ${y.kolom.name}` : ''}
                          {y.demographics?.age != null ? ` · ${y.demographics.age} th` : ''}
                          {y.demographics?.daysToBirthday != null && y.demographics.daysToBirthday <= 30
                            ? ` · HUT ${y.demographics.daysToBirthday}h`
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0 max-w-[220px] justify-end">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                          y.linkStatus === 'LINKED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {y.linkStatus === 'LINKED' ? (y.authProvider === 'LOCAL' ? 'Lokal' : 'Google') : 'Belum taut'}
                        </span>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                          {domicileLabel(y)}
                        </span>
                        {y.membershipKind === 'SIMPATISAN' ? (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">Simpatisan</span>
                        ) : null}
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

                    {/* Action buttons */}
                    <button
                      onClick={() => openEditModal(y)}
                      className="p-2 rounded-xl bg-white border border-[#D9D7D0] hover:bg-[#F3F1EC] text-[#8C8880] shrink-0 transition-colors"
                      title="Edit profil"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {y.linkStatus !== 'LINKED' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch(`/api/admin/users/${y.id}/claim-link`, { method: 'POST', credentials: 'include' });
                          const d = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            addToast({ type: 'error', title: 'Gagal', description: d.error || 'Tidak bisa buat taut' });
                            return;
                          }
                          try { await navigator.clipboard.writeText(d.claimUrl); } catch { /* ignore */ }
                          setClaimInfo(d.claimUrl);
                          addToast({ type: 'success', title: 'Link taut disalin', description: 'Kirim ke jemaat untuk bind Google.' });
                        }}
                        className="p-2 rounded-xl bg-white border border-[#D9D7D0] hover:bg-[#F3F1EC] text-[#8C8880] shrink-0"
                        title="Buat taut Google"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setAssignWizardUser({ id: y.id, name: y.name, email: y.email || '' })}
                      className="p-2 rounded-xl bg-[#FF416C]/10 hover:bg-[#FF416C]/20 text-[#FF416C] shrink-0 transition-colors"
                      title="Assign Role"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[#D9D7D0]/40">
                      <div className="pt-3 space-y-2">
                        {renderBipraBanner(y)}
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
                        <p className="text-[10px] text-[#8C8880] truncate">
                          {y.email || 'Belum ada email'}
                          {y.kolom ? ` · ${y.kolom.name}` : ''}
                          {y.demographics?.age != null ? ` · ${y.demographics.age} th` : ''}
                          {y.demographics?.daysToBirthday != null && y.demographics.daysToBirthday <= 30
                            ? ` · HUT ${y.demographics.daysToBirthday}h`
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0 max-w-[220px] justify-end">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                          y.linkStatus === 'LINKED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {y.linkStatus === 'LINKED' ? (y.authProvider === 'LOCAL' ? 'Lokal' : 'Google') : 'Belum taut'}
                        </span>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                          {domicileLabel(y)}
                        </span>
                        {y.membershipKind === 'SIMPATISAN' ? (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">Simpatisan</span>
                        ) : null}
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

                    <button
                      onClick={() => openEditModal(y)}
                      className="p-2 rounded-xl bg-white border border-[#D9D7D0] hover:bg-[#F3F1EC] text-[#8C8880] shrink-0 transition-colors"
                      title="Edit profil"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {y.linkStatus !== 'LINKED' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch(`/api/admin/users/${y.id}/claim-link`, { method: 'POST', credentials: 'include' });
                          const d = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            addToast({ type: 'error', title: 'Gagal', description: d.error || 'Tidak bisa buat taut' });
                            return;
                          }
                          try { await navigator.clipboard.writeText(d.claimUrl); } catch { /* ignore */ }
                          setClaimInfo(d.claimUrl);
                          addToast({ type: 'success', title: 'Link taut disalin', description: 'Kirim ke jemaat untuk bind Google.' });
                        }}
                        className="p-2 rounded-xl bg-white border border-[#D9D7D0] hover:bg-[#F3F1EC] text-[#8C8880] shrink-0"
                        title="Buat taut Google"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setAssignWizardUser({ id: y.id, name: y.name, email: y.email || '' })}
                      className="p-2 rounded-xl bg-[#FF416C]/10 hover:bg-[#FF416C]/20 text-[#FF416C] shrink-0 transition-colors"
                      title="Assign Role"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[#D9D7D0]/40">
                      <div className="pt-3 space-y-2">
                        {renderBipraBanner(y)}
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

      {editUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="bg-[#FAF9F5] rounded-[36px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D9D7D0]">
            <div className="sticky top-0 z-20 bg-[#FAF9F5]/90 backdrop-blur-md px-6 py-4 border-b border-[#D9D7D0]/60 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1B1B1B]">{creating ? 'Tambah Jemaat' : 'Edit Profil'}</h3>
              <button
                onClick={() => setEditUser(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-[#D9D7D0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Nama</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Kategorial (BIPRA)</label>
                <select
                  value={editForm.bipra}
                  onChange={(e) => setEditForm({ ...editForm, bipra: e.target.value, isBeyonders: e.target.value === 'PEMUDA' ? editForm.isBeyonders : false })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                >
                  {BIPRA_TABS.filter((t) => t.id).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Keanggotaan</label>
                <select
                  value={editForm.membershipKind}
                  onChange={(e) => setEditForm({ ...editForm, membershipKind: e.target.value as 'JEMAAT' | 'SIMPATISAN' })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                >
                  <option value="JEMAAT">Jemaat</option>
                  <option value="SIMPATISAN">Simpatisan (direktori saja)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Kolom</label>
                <select
                  value={editForm.kolomId}
                  onChange={(e) => setEditForm({ ...editForm, kolomId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                >
                  <option value="">— Belum di-assign —</option>
                  {kolomList.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Rekreasional</label>
                <div className="space-y-4">
                  {(['SPORTS', 'ARTS'] as const).map((kind) => {
                    const categories = recFlat.filter((r) => !r.parentId && r.kind === kind);
                    const kindKey = `kind-${kind}`;
                    return (
                      <div key={kind} className="rounded-2xl border border-[#D9D7D0]/60 bg-white/60 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">
                            {kind === 'SPORTS' ? 'Sports' : 'Arts'}
                          </p>
                          <button
                            type="button"
                            onClick={() => { setAddingKey(kindKey); setAddingName(''); }}
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#FF416C]"
                          >
                            <Plus className="w-3 h-3" /> Subkategori
                          </button>
                        </div>
                        {addingKey === kindKey && (
                          <div className="flex gap-1.5 mb-3">
                            <input
                              autoFocus
                              value={addingName}
                              onChange={(e) => setAddingName(e.target.value)}
                              placeholder={kind === 'SPORTS' ? 'Contoh: Outdoor' : 'Contoh: Fotografi'}
                              className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[10px]"
                            />
                            <button
                              type="button"
                              disabled={addingBusy}
                              onClick={() => addRecreational({ name: addingName, kind })}
                              className="px-2.5 py-1.5 rounded-xl bg-[#181818] text-white text-[9px] font-bold disabled:opacity-50"
                            >
                              {addingBusy ? '…' : 'Simpan'}
                            </button>
                          </div>
                        )}
                        {categories.map((cat) => {
                          const leaves = recFlat.filter((r) => r.parentId === cat.id && r.selectable !== false);
                          const catKey = `cat-${cat.id}`;
                          return (
                            <div key={cat.id} className="mb-3 last:mb-0">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-bold text-[#1B1B1B]">{cat.name}</p>
                                <button
                                  type="button"
                                  onClick={() => { setAddingKey(catKey); setAddingName(''); }}
                                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#8C8880] hover:text-[#FF416C]"
                                >
                                  <Plus className="w-3 h-3" /> Item
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {leaves.map((leaf) => {
                                  const on = editForm.recreationalIds.includes(leaf.id);
                                  return (
                                    <button
                                      key={leaf.id}
                                      type="button"
                                      onClick={() => setEditForm({
                                        ...editForm,
                                        recreationalIds: on
                                          ? editForm.recreationalIds.filter((id) => id !== leaf.id)
                                          : [...editForm.recreationalIds, leaf.id],
                                      })}
                                      className={`px-2.5 py-1 rounded-full text-[9px] font-bold ${on ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#8C8880]'}`}
                                    >
                                      {leaf.name}
                                    </button>
                                  );
                                })}
                              </div>
                              {addingKey === catKey && (
                                <div className="flex gap-1.5 mt-2">
                                  <input
                                    autoFocus
                                    value={addingName}
                                    onChange={(e) => setAddingName(e.target.value)}
                                    placeholder={`Nama di ${cat.name}…`}
                                    className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[10px]"
                                  />
                                  <button
                                    type="button"
                                    disabled={addingBusy}
                                    onClick={() => addRecreational({ name: addingName, parentId: cat.id })}
                                    className="px-2.5 py-1.5 rounded-xl bg-[#181818] text-white text-[9px] font-bold disabled:opacity-50"
                                  >
                                    {addingBusy ? '…' : 'Simpan'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Gender</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                >
                  <option value="">— Pilih —</option>
                  <option value="LAKI-LAKI">Laki-laki</option>
                  <option value="PEREMPUAN">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Tanggal lahir</label>
                <input
                  type="date"
                  value={editForm.birthDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Telepon</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Alamat</label>
                <AddressForm
                  value={editForm.address}
                  onChange={(address) => setEditForm((f) => ({ ...f, address }))}
                />
              </div>
              {!creating && (
              <div>
                <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">Gifts Top 5 (JSON)</label>
                <textarea
                  rows={4}
                  value={editForm.giftsTop5}
                  onChange={(e) => setEditForm({ ...editForm, giftsTop5: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-mono focus:outline-none focus:border-black resize-none"
                />
              </div>
              )}
              {editForm.bipra === 'PEMUDA' && (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider">Beyonders</span>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isBeyonders: !editForm.isBeyonders })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isBeyonders ? 'bg-emerald-500' : 'bg-[#D9D7D0]'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editForm.isBeyonders ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-[#D9D7D0] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded-2xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {claimInfo && (
        <div className="text-[10px] bg-white border border-[#D9D7D0] rounded-2xl px-4 py-2 break-all">
          Link taut: {claimInfo}
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