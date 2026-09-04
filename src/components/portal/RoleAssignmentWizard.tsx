import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Loader2, X, Building } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  accountStatus: string;
  onboardingStatus: string;
}

interface OrgNode {
  id: string;
  domain: string;
  parentId: string | null;
  slug: string;
  label: string;
  nodeKind: string;
  metadata?: Record<string, unknown> | null;
  sortOrder: number;
  children?: OrgNode[];
}

interface RoleAssignmentWizardProps {
  userId?: string;
  userName?: string;
  onClose: () => void;
  onAssigned: () => void;
}

type WizardMode = 'superadmin' | 'org';

const GROUPS = [
  { id: 'grp-1', name: 'Avodah', color: '#FF416C' },
  { id: 'grp-2', name: 'Agape', color: '#E94057' },
  { id: 'grp-3', name: 'Shalom', color: '#2A81FF' },
  { id: 'grp-4', name: 'Hesed', color: '#8A2387' },
  { id: 'grp-5', name: 'Kairos', color: '#F27121' },
  { id: 'grp-6', name: 'Logos', color: '#00B4D8' },
  { id: 'grp-7', name: 'Metanoia', color: '#059669' },
  { id: 'grp-8', name: 'Ruach', color: '#7C3AED' },
  { id: 'grp-9', name: 'Dunamis', color: '#DC2626' },
  { id: 'grp-10', name: 'Echad', color: '#0D9488' },
];

const FAMILY_ROLES = [
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'CO_MENTOR', label: 'Co-Mentor' },
  { value: 'MENTEE', label: 'Mentee' },
];

const DOMAINS = [
  { id: 'YOUTH', label: 'Pemuda (YOUTH)' },
  { id: 'KOLOM', label: 'Kolom (KOLOM)' },
];

function flattenBranches(nodes: OrgNode[]): OrgNode[] {
  return nodes.filter((n) => n.nodeKind === 'BRANCH' || n.nodeKind === 'GROUP_REF');
}

function collectAssignableSlots(node: OrgNode | null): OrgNode[] {
  if (!node) return [];
  const out: OrgNode[] = [];
  const walk = (n: OrgNode, prefix: string) => {
    const label = prefix ? `${prefix} → ${n.label}` : n.label;
    if (n.nodeKind === 'POSITION_SLOT' || n.nodeKind === 'GROUP_REF') {
      out.push({ ...n, label });
      return;
    }
    (n.children || []).forEach((c) => walk(c, label));
  };
  walk(node, '');
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export const RoleAssignmentWizard: React.FC<RoleAssignmentWizardProps> = ({
  userId: initialUserId,
  userName: initialUserName,
  onClose,
  onAssigned,
}) => {
  const { addToast } = useApp();
  const [mode, setMode] = useState<WizardMode>('org');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    initialUserId ? { id: initialUserId, name: initialUserName || '', email: '', avatar: null, accountStatus: '', onboardingStatus: '' } : null
  );
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState('');
  const [domain, setDomain] = useState('YOUTH');
  const [selectedBranch, setSelectedBranch] = useState<OrgNode | null>(null);
  const [selectedSubBranch, setSelectedSubBranch] = useState<OrgNode | null>(null);
  const [selectedDeepBranch, setSelectedDeepBranch] = useState<OrgNode | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<OrgNode | null>(null);
  const [groupId, setGroupId] = useState(GROUPS[0].id);
  const [familyRole, setFamilyRole] = useState('MENTEE');

  const loadTree = useCallback(async (d: string) => {
    setTreeLoading(true);
    setTreeError('');
    try {
      const res = await fetch(`/api/org/nodes?domain=${d}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrgTree(data.tree || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setOrgTree([]);
        setTreeError((err as { error?: string }).error || `Gagal memuat pohon (${res.status})`);
      }
    } catch {
      setOrgTree([]);
      setTreeError('Tidak bisa memuat pohon organisasi.');
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => { loadTree(domain); }, [domain, loadTree]);

  useEffect(() => {
    setSelectedBranch(null);
    setSelectedSubBranch(null);
    setSelectedDeepBranch(null);
    setSelectedSlot(null);
  }, [domain]);

  const topBranches = useMemo(() => flattenBranches(orgTree), [orgTree]);
  const subBranches = useMemo(() => {
    if (!selectedBranch?.children) return [];
    return selectedBranch.children.filter((c) => c.nodeKind === 'BRANCH');
  }, [selectedBranch]);
  const deepBranches = useMemo(() => {
    if (!selectedSubBranch?.children) return [];
    return selectedSubBranch.children.filter((c) => c.nodeKind === 'BRANCH');
  }, [selectedSubBranch]);
  const slotSource = selectedDeepBranch || selectedSubBranch || selectedBranch;
  const slots = useMemo(() => collectAssignableSlots(slotSource), [slotSource]);

  const isBeyondersSlot = selectedSlot?.nodeKind === 'GROUP_REF' || selectedSlot?.slug === 'BEYONDERS';

  const searchUser = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setSearchResults(d.users || []);
      }
    } catch { /* skip */ }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUser(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch, searchUser]);

  const assignRole = async () => {
    if (!selectedUser) { addToast({ type: 'error', title: 'Pilih user dulu' }); return; }
    setAssigning(true);
    try {
      if (mode === 'superadmin') {
        const res = await fetch('/api/role-assignments', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id, role: 'SUPERADMIN' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      } else {
        if (!selectedSlot) {
          addToast({ type: 'error', title: 'Pilih slot posisi' });
          return;
        }
        const res = await fetch('/api/org/assignments', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser.id,
            orgNodeId: selectedSlot.id,
            groupId: isBeyondersSlot ? groupId : null,
            familyRole: isBeyondersSlot ? familyRole : null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      }

      addToast({ type: 'success', title: 'Role Ditugaskan', description: `${selectedUser.name} berhasil ditugaskan.` });
      onAssigned();
      onClose();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setAssigning(false);
    }
  };

  const tabs: { id: WizardMode; label: string; icon: React.ReactNode }[] = [
    { id: 'org', label: 'Struktur Org', icon: <Building className="w-4 h-4" /> },
    { id: 'superadmin', label: 'Superadmin', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white rounded-t-[32px] border-b border-[#D9D7D0]/50 p-6 pb-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Assign Role</h2>
              <p className="text-xs text-[#8C8880] mt-0.5">Pilih slot dari pohon organisasi</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
              <X className="w-5 h-5 text-[#8C8880]" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!selectedUser ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1B1B1B]">Cari User</label>
              <div className="relative">
                <input
                  placeholder="Ketik nama atau email…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#8C8880]" />}
              </div>
              {searchResults.length > 0 && (
                <div className="bg-white border border-[#D9D7D0] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserSearch(''); setSearchResults([]); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAF9F5] text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{u.name}</p>
                        <p className="text-[10px] text-[#8C8880] truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-[#FAF9F5] rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                {selectedUser.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{selectedUser.name}</p>
                <p className="text-[10px] text-[#8C8880] truncate">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg hover:bg-gray-200">
                <X className="w-3.5 h-3.5 text-[#8C8880]" />
              </button>
            </div>
          )}

          <div className="flex gap-1 border-b border-[#D9D7D0]/60 pb-2 overflow-x-auto overscroll-x-contain touch-pan-x [&>*]:shrink-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                  mode === t.id ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#8C8880] hover:bg-gray-200'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {mode === 'superadmin' && (
            <div className="rounded-2xl bg-purple-50 border border-purple-200 p-4">
              <p className="text-xs font-bold text-purple-700 mb-2">Superadmin</p>
              <p className="text-[10px] text-purple-600">
                Akses penuh ke seluruh sistem. Hanya bisa ditambah oleh Superadmin yang sudah ada.
              </p>
            </div>
          )}

          {mode === 'org' && (
            <div className="space-y-3">
              {treeLoading && (
                <div className="flex items-center gap-2 text-xs text-[#8C8880]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuat pohon organisasi…
                </div>
              )}
              {treeError ? (
                <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{treeError}</p>
              ) : null}

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                >
                  {DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Cabang</label>
                <select
                  value={selectedBranch?.id || ''}
                  onChange={(e) => {
                    const b = topBranches.find((n) => n.id === e.target.value) || null;
                    setSelectedBranch(b);
                    setSelectedSubBranch(null);
                    setSelectedDeepBranch(null);
                    setSelectedSlot(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                >
                  <option value="">— Pilih cabang —</option>
                  {topBranches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>

              {subBranches.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Sub-cabang</label>
                  <select
                    value={selectedSubBranch?.id || ''}
                    onChange={(e) => {
                      const b = subBranches.find((n) => n.id === e.target.value) || null;
                      setSelectedSubBranch(b);
                      setSelectedDeepBranch(null);
                      setSelectedSlot(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                  >
                    <option value="">— Pilih sub-cabang —</option>
                    {subBranches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
              )}

              {deepBranches.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Divisi / Unit</label>
                  <select
                    value={selectedDeepBranch?.id || ''}
                    onChange={(e) => {
                      const b = deepBranches.find((n) => n.id === e.target.value) || null;
                      setSelectedDeepBranch(b);
                      setSelectedSlot(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                  >
                    <option value="">— Pilih divisi —</option>
                    {deepBranches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
              )}

              {slots.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Posisi / Slot</label>
                  <select
                    value={selectedSlot?.id || ''}
                    onChange={(e) => setSelectedSlot(slots.find((s) => s.id === e.target.value) || null)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                  >
                    <option value="">— Pilih posisi —</option>
                    {slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              )}

              {isBeyondersSlot && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Grup Beyonders</label>
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                    >
                      {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Peran Keluarga</label>
                    <select
                      value={familyRole}
                      onChange={(e) => setFamilyRole(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                    >
                      {FAMILY_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {!treeLoading && topBranches.length === 0 && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Pohon organisasi belum di-seed. Jalankan <code>npm run db:seed:org-tree</code>.
                </p>
              )}
            </div>
          )}

          <button
            onClick={assignRole}
            disabled={!selectedUser || assigning || (mode === 'org' && !selectedSlot)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {assigning ? 'Menugaskan…' : 'Assign Role'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
