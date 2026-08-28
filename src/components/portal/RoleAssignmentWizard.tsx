import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, X, ChevronDown, Users, User, Building, BookOpen, Heart, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PANTATUGAS, SUB_DIVISIONS } from '../../lib/pantatugas';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  accountStatus: string;
  onboardingStatus: string;
}

interface RoleAssignmentWizardProps {
  userId?: string;
  userName?: string;
  onClose: () => void;
  onAssigned: () => void;
}

type RoleTab = 'superadmin' | 'bpmj' | 'komisi' | 'komite';

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

const BPMJ_POSITIONS = ['Ketua BPMJ', 'Wakil Ketua BPMJ', 'Sekretaris', 'Wakil Sekretaris', 'Bendahara', 'Anggota'];
const KOMISI_POSITIONS = ['Ketua Komisi', 'Wakil Ketua Komisi', 'Sekretaris', 'Bendahara', 'Anggota'];
const FAMILY_ROLES = [
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'CO_MENTOR', label: 'Co-Mentor' },
  { value: 'MENTEE', label: 'Mentee' },
];

export const RoleAssignmentWizard: React.FC<RoleAssignmentWizardProps> = ({
  userId: initialUserId,
  userName: initialUserName,
  onClose,
  onAssigned,
}) => {
  const { addToast } = useApp();
  const [activeTab, setActiveTab] = useState<RoleTab>('superadmin');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    initialUserId ? { id: initialUserId, name: initialUserName || '', email: '', avatar: null, accountStatus: '', onboardingStatus: '' } : null
  );
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // BPMJ
  const [bpmjPosition, setBpmjPosition] = useState(BPMJ_POSITIONS[0]);

  // KOMISI
  const [komisiPosition, setKomisiPosition] = useState(KOMISI_POSITIONS[0]);

  // KOMITE
  const [komiteDivision, setKomiteDivision] = useState(PANTATUGAS[0].name);
  const [komiteSubdivision, setKomiteSubdivision] = useState('');

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
      const body: Record<string, unknown> = { userId: selectedUser.id };

      switch (activeTab) {
        case 'superadmin':
          body.role = 'SUPERADMIN';
          break;
        case 'bpmj':
          body.role = 'BPMJ';
          body.position = bpmjPosition;
          break;
        case 'komisi':
          body.role = 'KOMISI';
          body.position = komisiPosition;
          break;
        case 'komite':
          body.role = 'COMMITTEE';
          body.division = komiteDivision;
          body.subdivision = komiteSubdivision || null;
          break;
      }

      const res = await fetch('/api/role-assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      addToast({ type: 'success', title: 'Role Ditugaskan', description: `${selectedUser.name} berhasil ditugaskan sebagai ${activeTab}.` });
      onAssigned();
      onClose();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setAssigning(false);
    }
  };

  const tabs: { id: RoleTab; label: string; icon: React.ReactNode }[] = [
    { id: 'superadmin', label: 'Superadmin', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'bpmj', label: 'BPMJ', icon: <Building className="w-4 h-4" /> },
    { id: 'komisi', label: 'Komisi', icon: <Users className="w-4 h-4" /> },
    { id: 'komite', label: 'Komite', icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-[32px] border-b border-[#D9D7D0]/50 p-6 pb-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Assign Role</h2>
              <p className="text-xs text-[#8C8880] mt-0.5">Pilih role dan sub-detail untuk user</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
              <X className="w-5 h-5 text-[#8C8880]" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* User Search/Select */}
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

          {/* Role Tabs */}
          <div className="flex gap-1 border-b border-[#D9D7D0]/60 pb-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                  activeTab === t.id ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#8C8880] hover:bg-gray-200'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {/* SUPERADMIN */}
            {activeTab === 'superadmin' && (
              <div className="rounded-2xl bg-purple-50 border border-purple-200 p-4">
                <p className="text-xs font-bold text-purple-700 mb-2">Superadmin</p>
                <p className="text-[10px] text-purple-600">
                  Akses penuh ke seluruh sistem. Hanya bisa ditambah oleh Superadmin yang sudah ada.
                </p>
              </div>
            )}

            {/* BPMJ */}
            {activeTab === 'bpmj' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#1B1B1B]">Posisi di BPMJ</label>
                <select
                  value={bpmjPosition}
                  onChange={(e) => setBpmjPosition(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                >
                  {BPMJ_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* KOMISI */}
            {activeTab === 'komisi' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#1B1B1B]">Posisi di Komisi</label>
                <select
                  value={komisiPosition}
                  onChange={(e) => setKomisiPosition(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                >
                  {KOMISI_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* KOMITE */}
            {activeTab === 'komite' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Divisi</label>
                  <select
                    value={komiteDivision}
                    onChange={(e) => { setKomiteDivision(e.target.value); setKomiteSubdivision(''); }}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                  >
                    {PANTATUGAS.map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
                  </select>
                </div>
                {SUB_DIVISIONS[komiteDivision] && SUB_DIVISIONS[komiteDivision].length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-[#1B1B1B] mb-1 block">Sub-Divisi</label>
                    <select
                      value={komiteSubdivision}
                      onChange={(e) => setKomiteSubdivision(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
                    >
                      <option value="">— Pilih Sub-Divisi —</option>
                      {SUB_DIVISIONS[komiteDivision].map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={assignRole}
            disabled={!selectedUser || assigning}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {assigning ? 'Menugaskan…' : 'Assign Role'}
          </button>
        </div>
      </div>
    </div>
  );
};
