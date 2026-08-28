import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardList, Clock, Gift, Send, UserCheck, Loader2, Phone, Mail, AlertCircle, ShieldCheck, CheckSquare, Square, MinusSquare, Users, User, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleAssignmentWizard } from './RoleAssignmentWizard';

interface WaitingPoolEntry {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  origin: string | null;
  status: string;
  giftTestDone: boolean;
  giftsTop5: unknown;
  profileCompleted: boolean;
  profileCompletedAt: string | null;
  sourceEvent: string | null;
  registeredAt: string;
  lastReminder: string | null;
  reminderCount: number;
}

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export const WaitingPoolPanel: React.FC = () => {
  const { addToast } = useApp();
  const [tab, setTab] = useState<'waiting' | 'pending' | 'youth'>('waiting');
  const [waitingPool, setWaitingPool] = useState<WaitingPoolEntry[] | null>(null);
  const [pendingApproval, setPendingApproval] = useState<WaitingPoolEntry[] | null>(null);
  const [youthGeHc, setYouthGeHc] = useState<WaitingPoolEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [assignWizardUser, setAssignWizardUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [wpRes, paRes, ygRes] = await Promise.all([
        fetch('/api/waiting-pool', { credentials: 'include' }),
        fetch('/api/pending-approval', { credentials: 'include' }),
        fetch('/api/youth-gehc', { credentials: 'include' }),
      ]);

      if (wpRes.ok) {
        const d = await wpRes.json();
        setWaitingPool(d.pool || []);
      }
      if (paRes.ok) {
        const d = await paRes.json();
        setPendingApproval(d.pending || []);
      }
      if (ygRes.ok) {
        const d = await ygRes.json();
        setYouthGeHc(d.youth || []);
      }
    } catch (err) {
      console.error('Failed to fetch onboarding data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendReminder = async (entry: WaitingPoolEntry) => {
    setSendingReminder(entry.id);
    try {
      await fetch(`/api/waiting-pool/${entry.id}/reminder`, {
        method: 'POST',
        credentials: 'include',
      });
      addToast({ type: 'success', title: 'Reminder Terkirim', description: `Reminder untuk ${entry.name} berhasil dikirim.` });
      fetchData();
    } catch {
      addToast({ type: 'error', title: 'Gagal', description: 'Gagal mengirim reminder.' });
    } finally {
      setSendingReminder(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  };

  const handleBeyonders = async (ids: string[]) => {
    setBulkActionLoading(true);
    try {
      // Fetch details for these entries
      const entries = (pendingApproval || []).filter(e => ids.includes(e.id));
      const validEntries = entries.filter(e => e.userId && e.giftTestDone && e.gender);
      
      if (validEntries.length === 0) {
        addToast({ type: 'error', title: 'Tidak Valid', description: 'Pilih newcomer yang sudah lengkap profil + gift test + gender.' });
        return;
      }

      // Get newcomer IDs for Jethro advanced placement
      const newcomerIds = validEntries.map(e => e.id).join(',');
      
      // Call advanced placement
      const placeRes = await fetch(`/api/jethro/placement/advanced?ids=${newcomerIds}`, { credentials: 'include' });
      if (!placeRes.ok) throw new Error('Gagal dapat rekomendasi Jethro');
      const { recommendations } = await placeRes.json();

      // Create batch
      const batchRes = await fetch('/api/jethro/placement/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations: recommendations.map((r: any) => ({
          newcomerId: r.newcomerId,
          newcomerName: r.newcomerName,
          newcomerGender: r.newcomerGender,
          newcomerGiftsTop5: r.newcomerGiftsTop5,
          newcomerMaturityScore: r.newcomerMaturityScore,
          recommendedGroupId: r.recommendedGroupId,
          recommendedGroupName: r.recommendedGroupName,
          recommendedRole: r.recommendedRole,
          confidence: r.confidence,
          reasons: r.reasons,
          scoreBreakdown: r.scoreBreakdown,
        })) }),
      });

      if (!batchRes.ok) throw new Error('Gagal buat batch placement');
      
      addToast({ type: 'success', title: 'Beyonders Diajukan', description: `${validEntries.length} newcomer dikirim ke Jethro Placement Review.` });
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleIndividu = async (ids: string[]) => {
    setBulkActionLoading(true);
    try {
      const entries = (pendingApproval || []).filter(e => ids.includes(e.id));
      const validEntries = entries.filter(e => e.userId);
      
      if (validEntries.length === 0) {
        addToast({ type: 'error', title: 'Tidak Valid', description: 'Tidak ada newcomer valid.' });
        return;
      }

      const userIds = validEntries.map(e => e.userId!).filter(Boolean);
      
      const res = await fetch('/api/role-assignments/bulk-individu', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal assign Individu');
      }

      addToast({ type: 'success', title: 'Individu Diassign', description: `${validEntries.length} newcomer langsung jadi Individu (Community · Individu).` });
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setBulkActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data onboarding…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
          <ClipboardList className="w-3.5 h-3.5 text-[#FF416C]" />
          <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
            Onboarding Pipeline
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Waitlist & Onboarding</h2>
        <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
          Pantau pipeline onboarding dari registrasi sampai role assignment.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D9D7D0]/60 pb-3">
        {([
          ['waiting', `Menunggu Profil (${(waitingPool || []).length})`],
          ['pending', `Menunggu Role (${(pendingApproval || []).length})`],
          ['youth', `Youth GEHC (${(youthGeHc || []).length})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              tab === id ? 'bg-[#181818] text-white shadow-md' : 'bg-white border border-[#D9D7D0]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* WAITING POOL */}
      {tab === 'waiting' && (
        <div className="space-y-2">
          {(waitingPool || []).length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-8 h-8 text-[#8C8880]" />}
              title="Belum ada yang menunggu profil"
              desc="Semua pendaftar sudah melengkapi profil."
            />
          ) : (
            (waitingPool || []).map((entry) => (
              <div key={entry.id} className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={initialsAvatar(entry.name)}
                    alt={entry.name}
                    className="w-10 h-10 rounded-full object-cover border border-[#D9D7D0]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{entry.name}</p>
                    <p className="text-[10px] text-[#8C8880] truncate">
                      {entry.email || entry.phone || 'No contact'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      {daysSince(entry.registeredAt)} hari
                    </span>
                    {entry.giftTestDone && (
                      <span className="ml-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Gift className="w-2.5 h-2.5 inline mr-0.5" /> Gift
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#D9D7D0]/40">
                  <div className="flex gap-1 text-[9px] text-[#8C8880]">
                    {entry.sourceEvent && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded-full">{entry.sourceEvent}</span>
                    )}
                    {entry.reminderCount > 0 && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                        <Send className="w-2.5 h-2.5 inline mr-0.5" /> {entry.reminderCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => sendReminder(entry)}
                    disabled={sendingReminder === entry.id}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white disabled:opacity-50 flex items-center gap-1"
                  >
                    {sendingReminder === entry.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    Kirim Reminder
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PENDING APPROVAL - NEW UI with inline actions + bulk */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {(pendingApproval || []).length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8 text-[#8C8880]" />}
              title="Belum ada yang menunggu role"
              desc="Semua sudah melengkapi profil, tapi belum ada yang siap assign role."
            />
          ) : (
            <>
              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === (pendingApproval || []).length}
                        onChange={() => toggleSelectAll((pendingApproval || []).map(e => e.id))}
                        className="w-4 h-4 rounded border-[#D9D7D0] text-[#FF416C] focus:ring-[#FF416C]"
                      />
                      <span className="text-xs font-bold text-[#1B1B1B]">Select All ({selectedIds.size})</span>
                    </label>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
                      {selectedIds.size} dipilih
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBeyonders(Array.from(selectedIds))}
                      disabled={bulkActionLoading}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" /> Beyonders
                    </button>
                    <button
                      onClick={() => handleIndividu(Array.from(selectedIds))}
                      disabled={bulkActionLoading}
                      className="px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      <User className="w-3.5 h-3.5" /> Individu
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-bold text-[#8C8880] hover:bg-gray-50 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* List */}
              <div className="space-y-2">
                {(pendingApproval || []).map((entry) => {
                  const isSelected = selectedIds.has(entry.id);
                  const canBeyonders = entry.userId && entry.giftTestDone && entry.gender;
                  const canIndividu = entry.userId;
                  const isProcessing = bulkActionLoading && isSelected;

                  return (
                    <div
                      key={entry.id}
                      className={`bg-white rounded-2xl border p-4 transition-all ${
                        isSelected ? 'border-amber-300 bg-amber-50' : 'border-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(entry.id)}
                          className="w-4 h-4 rounded border-[#D9D7D0] text-[#FF416C] focus:ring-[#FF416C] shrink-0"
                        />

                        <img
                          src={initialsAvatar(entry.name)}
                          alt={entry.name}
                          className="w-10 h-10 rounded-full object-cover border border-amber-200"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{entry.name}</p>
                          <p className="text-[10px] text-[#8C8880] truncate">
                            {entry.email || entry.phone || 'No contact'}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.gender && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                entry.gender === 'LAKI-LAKI' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                              }`}>
                                {entry.gender === 'LAKI-LAKI' ? '👦' : '👧'} {entry.gender}
                              </span>
                            )}
                            {entry.giftTestDone && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                <Gift className="w-2.5 h-2.5 inline mr-0.5" /> Gift Done
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline Action Dropdown */}
                        <div className="relative shrink-0">
                          <div className="flex gap-1">
                            {canBeyonders && (
                              <button
                                onClick={() => handleBeyonders([entry.id])}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-[9px] font-bold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1"
                                title="Kirim ke Jethro Placement Review"
                              >
                                <Users className="w-3 h-3" /> Beyonders
                              </button>
                            )}
                            {canIndividu && (
                              <button
                                onClick={() => handleIndividu([entry.id])}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-500 text-white text-[9px] font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                                title="Assign langsung sebagai Individu"
                              >
                                <User className="w-3 h-3" /> Individu
                              </button>
                            )}
                            {!canBeyonders && !canIndividu && (
                              <span className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-[9px] font-bold">
                                Belum Siap
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detail row */}
                      <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#8C8880]">
                          Profil lengkap {entry.profileCompletedAt ? `· ${daysSince(entry.profileCompletedAt)} hari lalu` : ''}
                        </span>
                        <div className="flex gap-1 text-[9px] text-[#8C8880]">
                          {entry.sourceEvent && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded-full">{entry.sourceEvent}</span>
                          )}
                          {entry.reminderCount > 0 && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                              <Send className="w-2.5 h-2.5 inline mr-0.5" /> {entry.reminderCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* YOUTH GEHC */}
      {tab === 'youth' && (
        <div className="space-y-2">
          {(youthGeHc || []).length === 0 ? (
            <EmptyState
              icon={<UserCheck className="w-8 h-8 text-[#8C8880]" />}
              title="Belum ada Youth GEHC"
              desc="Role assignment belum dilakukan."
            />
          ) : (
            (youthGeHc || []).map((entry) => (
              <div key={entry.id} className="bg-white rounded-2xl border border-emerald-200 p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={initialsAvatar(entry.name)}
                    alt={entry.name}
                    className="w-10 h-10 rounded-full object-cover border border-emerald-200"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{entry.name}</p>
                    <p className="text-[10px] text-[#8C8880] truncate">
                      {entry.email || entry.phone || 'No contact'}
                    </p>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">
                    Active
                  </span>
                </div>
                {entry.user && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-emerald-100">
                    {(entry.user as any).roles?.map((r: any, i: number) => (
                      <span key={i} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 uppercase">
                        {r.role}{r.groupId ? `@${r.groupId}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Role Assignment Wizard */}
      {assignWizardUser && (
        <RoleAssignmentWizard
          userId={assignWizardUser.id}
          userName={assignWizardUser.name}
          onClose={() => setAssignWizardUser(null)}
          onAssigned={fetchData}
        />
      )}
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-12 text-center">
    <div className="flex justify-center mb-3">{icon}</div>
    <p className="text-sm font-bold text-[#1B1B1B]">{title}</p>
    <p className="text-xs text-[#8C8880] mt-1">{desc}</p>
  </div>
);