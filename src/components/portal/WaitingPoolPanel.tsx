import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardList, Clock, Gift, Send, Loader2, X, Download, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleAssignmentWizard } from './RoleAssignmentWizard';
import { PlacementChoiceModal, PlacementTarget } from './PlacementChoiceModal';
import { DOMICILE_OPTIONS, domicileLabel } from '../../lib/domicile';
import { useLang } from '../../context/LangContext';
import { fmt } from '../../lib/portal-i18n';
import { PanelGuide } from './PanelGuide';
import { useListPager } from './ListPager';

const BAKU_TAU_EVENT = 'BAKU TAU 4.0';

interface WaitingPoolEntry {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  origin: string | null;
  domicileKind: string | null;
  domicileDetail: string | null;
  status: string;
  giftTestDone: boolean;
  giftsTop5: unknown;
  profileCompleted: boolean;
  profileCompletedAt: string | null;
  sourceEvent: string | null;
  registeredAt: string;
  lastReminder: string | null;
  reminderCount: number;
  user?: {
    id: string;
    name: string;
    email: string | null;
    bipra?: string | null;
    kolomId?: string | null;
    kolom?: { id: string; name: string } | null;
    roles?: { role: string; groupId: string | null; tenantId?: string }[];
  };
}

interface WaitingPoolPanelProps {
  onNavigate?: (tabId: string) => void;
}

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export const WaitingPoolPanel: React.FC<WaitingPoolPanelProps> = ({ onNavigate }) => {
  const { addToast } = useApp();
  const { t } = useLang();
  const o = t.portal.onboarding;
  const [tab, setTab] = useState<'registered' | 'waiting' | 'pending'>('registered');
  const [bakuTauOnly, setBakuTauOnly] = useState(true);
  const [domicileFilter, setDomicileFilter] = useState<string>('');
  const [registeredPool, setRegisteredPool] = useState<WaitingPoolEntry[] | null>(null);
  const [eventStats, setEventStats] = useState<{ registered: number; withAccount: number; profileComplete: number; byDomicile?: Record<string, number> } | null>(null);
  const [waitingPool, setWaitingPool] = useState<WaitingPoolEntry[] | null>(null);
  const [pendingApproval, setPendingApproval] = useState<WaitingPoolEntry[] | null>(null);
  const [roleAssignedCount, setRoleAssignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [assignWizardUser, setAssignWizardUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showJethroHint, setShowJethroHint] = useState(false);
  const [placementTargets, setPlacementTargets] = useState<PlacementTarget[] | null>(null);

  const { pageItems: pagedPending, pager: pendingPager } = useListPager<WaitingPoolEntry>(pendingApproval || []);
  const poolQuery = (status: string) => {
    const params = new URLSearchParams({ status });
    if (bakuTauOnly) params.set('sourceEvent', BAKU_TAU_EVENT);
    if (domicileFilter) params.set('domicileKind', domicileFilter);
    return `/api/waiting-pool?${params.toString()}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, wpRes, paRes, raRes, statsRes] = await Promise.all([
        fetch(poolQuery('REGISTERED'), { credentials: 'include' }),
        fetch(poolQuery('WAITING_POOL'), { credentials: 'include' }),
        fetch(poolQuery('PROFILE_COMPLETED'), { credentials: 'include' }),
        fetch('/api/waiting-pool?status=ROLE_ASSIGNED', { credentials: 'include' }),
        fetch('/api/events/baku-tau-4-0/stats', { credentials: 'include' }),
      ]);

      if (regRes.ok) {
        const d = await regRes.json();
        setRegisteredPool(d.pool || []);
      }
      if (wpRes.ok) {
        const d = await wpRes.json();
        setWaitingPool(d.pool || []);
      }
      if (paRes.ok) {
        const d = await paRes.json();
        setPendingApproval(d.pool || d.pending || []);
      }
      if (raRes.ok) {
        const d = await raRes.json();
        setRoleAssignedCount((d.pool || []).length);
      }
      if (statsRes.ok) {
        setEventStats(await statsRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch onboarding data:', err);
    } finally {
      setLoading(false);
    }
  }, [bakuTauOnly, domicileFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportCsv = () => {
    const rows = [
      ...(registeredPool || []),
      ...(waitingPool || []),
      ...(pendingApproval || []),
    ].filter((e) => !bakuTauOnly || e.sourceEvent === BAKU_TAU_EVENT);
    if (!rows.length) {
      addToast({ type: 'error', title: 'Kosong', description: 'Tidak ada data untuk diekspor.' });
      return;
    }
    const header = ['nama', 'wa', 'gender', 'asal', 'domicileKind', 'domicileDetail', 'status'];
    const lines = [header.join(',')];
    for (const e of rows) {
      lines.push([
        e.name,
        e.phone || '',
        e.gender || '',
        e.origin || '',
        e.domicileKind || '',
        e.domicileDetail || '',
        e.status,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baku-tau-registrations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };


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

  const openPlacementModal = (poolIds: string[]) => {
    const entries = (pendingApproval || []).filter((e) => poolIds.includes(e.id));
    if (entries.length === 0) return;
    setPlacementTargets(entries.map((e) => ({
      poolId: e.id,
      userId: e.userId,
      name: e.name,
      giftTestDone: e.giftTestDone,
      gender: e.gender,
    })));
  };

  const handleJethroPlacement = async (poolIds: string[]) => {
    setPlacementTargets(null);
    setBulkActionLoading(true);
    try {
      const entries = (pendingApproval || []).filter((e) => poolIds.includes(e.id));
      const validEntries = entries.filter((e) => e.userId && e.giftTestDone && e.gender);

      if (validEntries.length === 0) {
        addToast({ type: 'error', title: 'Tidak Valid', description: 'Pilih newcomer yang sudah lengkap profil + gift test + gender.' });
        return;
      }

      const newcomerIds = validEntries.map((e) => e.userId!).join(',');

      const placeRes = await fetch(`/api/jethro/placement/advanced?ids=${newcomerIds}`, { credentials: 'include' });
      if (!placeRes.ok) {
        const err = await placeRes.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal dapat rekomendasi Jethro');
      }
      const { recommendations } = await placeRes.json();

      const batchRes = await fetch('/api/jethro/placement/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations: recommendations.map((r: Record<string, unknown>) => ({
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

      addToast({
        type: 'success',
        title: 'Dikirim ke Jethro Review',
        description: `${validEntries.length} newcomer menunggu review & commit di Jethro Placement Review.`,
      });
      setShowJethroHint(true);
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleIndividu = async (poolIds: string[]) => {
    setPlacementTargets(null);
    setBulkActionLoading(true);
    try {
      const entries = (pendingApproval || []).filter((e) => poolIds.includes(e.id));
      const validEntries = entries.filter((e) => e.userId);

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

  const handleManualPlacement = (poolIds: string[]) => {
    const entries = (pendingApproval || []).filter((e) => poolIds.includes(e.id) && e.userId);
    if (entries.length === 0) {
      addToast({ type: 'error', title: 'Tidak Valid', description: 'Newcomer harus punya akun terlebih dahulu.' });
      return;
    }
    setPlacementTargets(null);
    if (entries.length === 1) {
      setAssignWizardUser({ id: entries[0].userId!, name: entries[0].name });
      return;
    }
    addToast({
      type: 'info',
      title: 'Manual satu per satu',
      description: 'Wizard manual untuk bulk: assign satu newcomer, lalu ulangi untuk yang lain.',
    });
    setAssignWizardUser({ id: entries[0].userId!, name: entries[0].name });
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
        {eventStats && bakuTauOnly && (
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0]">
              Terdaftar: {eventStats.registered}
            </span>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700">
              Punya akun: {eventStats.withAccount}
            </span>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
              Profil lengkap: {eventStats.profileComplete}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setBakuTauOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${bakuTauOnly ? 'bg-[#FF416C] text-white' : 'bg-white border border-[#D9D7D0]'}`}
        >
          BAKU TAU 4.0
        </button>
        {DOMICILE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setDomicileFilter((f) => (f === o.value ? '' : o.value))}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${domicileFilter === o.value ? 'bg-[#181818] text-white' : 'bg-white border border-[#D9D7D0]'}`}
          >
            {o.value}
            {eventStats?.byDomicile?.[o.value] != null ? ` (${eventStats.byDomicile[o.value]})` : ''}
          </button>
        ))}
        <button
          onClick={exportCsv}
          className="ml-auto px-3 py-1.5 rounded-full text-[10px] font-bold bg-white border border-[#D9D7D0] flex items-center gap-1"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>

      <PanelGuide
        guideId={tab === 'registered' ? 'onboarding.registered' : tab === 'waiting' ? 'onboarding.waiting' : 'onboarding.pending'}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D9D7D0]/60 pb-3 flex-wrap">
        {([
          ['registered', fmt(o.tabRegistered, { n: (registeredPool || []).length })],
          ['waiting', fmt(o.tabWaiting, { n: (waitingPool || []).length })],
          ['pending', fmt(o.tabPending, { n: (pendingApproval || []).length })],
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

      {tab === 'registered' && (
        <PoolList
          entries={registeredPool || []}
          emptyTitle={o.emptyRegisteredTitle}
          emptyDesc={o.emptyRegisteredDesc}
          onReminder={sendReminder}
          sendingReminder={sendingReminder}
        />
      )}

      {/* WAITING POOL */}
      {tab === 'waiting' && (
        <PoolList
          entries={waitingPool || []}
          emptyTitle={o.emptyWaitingTitle}
          emptyDesc={o.emptyWaitingDesc}
          onReminder={sendReminder}
          sendingReminder={sendingReminder}
        />
      )}

      {/* PENDING APPROVAL - NEW UI with inline actions + bulk */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {showJethroHint && onNavigate && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-emerald-800 font-medium">
                Batch placement sudah dibuat. Review dan commit di Jethro Placement Review.
              </p>
              <button
                onClick={() => { onNavigate('jethro-placement'); setShowJethroHint(false); }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0"
              >
                Buka Jethro Review →
              </button>
            </div>
          )}
          {(pendingApproval || []).length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8 text-[#8C8880]" />}
              title={o.emptyPendingTitle}
              desc={o.emptyPendingDesc}
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
                      onClick={() => openPlacementModal(Array.from(selectedIds))}
                      disabled={bulkActionLoading}
                      className="px-3 py-1.5 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Penempatan ({selectedIds.size})
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

              {pendingPager}
              <div className="space-y-2">
                {pagedPending.map((entry) => {
                  const isSelected = selectedIds.has(entry.id);
                  const canPlace = entry.userId;
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
                            {canPlace ? (
                              <button
                                onClick={() => openPlacementModal([entry.id])}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-lg bg-[#181818] text-white text-[9px] font-bold hover:bg-black disabled:opacity-50 flex items-center gap-1"
                                title="Pilih: Jethro, manual, atau Individu"
                              >
                                <Sparkles className="w-3 h-3" /> Penempatan
                              </button>
                            ) : (
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

      {/* Link to Jemaat for role-assigned */}
      {roleAssignedCount > 0 && onNavigate && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-emerald-800">{roleAssignedCount} jemaat sudah dapat role — lihat di Direktori Jemaat.</p>
          <button
            onClick={() => onNavigate('youth-gehc')}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0"
          >
            Lihat di Jemaat →
          </button>
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

      {placementTargets && placementTargets.length > 0 && (
        <PlacementChoiceModal
          targets={placementTargets}
          onClose={() => setPlacementTargets(null)}
          onJethro={() => handleJethroPlacement(placementTargets.map((t) => t.poolId))}
          onManual={() => handleManualPlacement(placementTargets.map((t) => t.poolId))}
          onIndividu={() => handleIndividu(placementTargets.map((t) => t.poolId))}
        />
      )}
    </div>
  );
};

const BIPRA_SHORT: Record<string, string> = {
  BAPAK: 'Bapak', IBU: 'Ibu', PEMUDA: 'Pemuda', REMAJA: 'Remaja', ANAK: 'Anak',
};

const PoolList: React.FC<{
  entries: WaitingPoolEntry[];
  emptyTitle: string;
  emptyDesc: string;
  onReminder: (e: WaitingPoolEntry) => void;
  sendingReminder: string | null;
}> = ({ entries, emptyTitle, emptyDesc, onReminder, sendingReminder }) => {
  const { pageItems, pager } = useListPager<WaitingPoolEntry>(entries);
  return (
  <div className="space-y-2">
    {pager}
    {entries.length === 0 ? (
      <EmptyState icon={<ClipboardList className="w-8 h-8 text-[#8C8880]" />} title={emptyTitle} desc={emptyDesc} />
    ) : (
      pageItems.map((entry) => (
        <div key={entry.id} className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-4">
          <div className="flex items-center gap-3">
            <img src={initialsAvatar(entry.name)} alt={entry.name} className="w-10 h-10 rounded-full object-cover border border-[#D9D7D0]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{entry.user?.name || entry.name}</p>
              <p className="text-[10px] text-[#8C8880] truncate">{entry.email || entry.phone || 'No contact'}</p>
              {(entry.origin || entry.domicileKind) && (
                <p className="text-[9px] text-[#8C8880] mt-0.5 truncate">
                  {entry.origin || '—'} · {domicileLabel(entry.domicileKind, entry.domicileDetail)}
                </p>
              )}
              {entry.user && (
                <p className="text-[9px] mt-0.5 truncate">
                  <span className={entry.user.bipra ? 'text-[#5C5850]' : 'text-red-600 font-bold'}>
                    {entry.user.bipra ? BIPRA_SHORT[entry.user.bipra] || entry.user.bipra : 'BIPRA kosong'}
                  </span>
                  {' · '}
                  <span className={entry.user.kolom ? 'text-[#5C5850]' : 'text-red-600 font-bold'}>
                    {entry.user.kolom?.name || 'Kolom kosong'}
                  </span>
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full block mb-1">
                {entry.status}
              </span>
              {!entry.profileCompleted && entry.status !== 'REGISTERED' && (
                <span className="text-[9px] font-bold text-red-600 block mb-1">Profil belum lengkap</span>
              )}
              <span className="text-[10px] font-bold text-[#8C8880]">{daysSince(entry.registeredAt)} hari</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#D9D7D0]/40">
            <div className="flex gap-1 text-[9px] text-[#8C8880] flex-wrap">
              {entry.sourceEvent && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{entry.sourceEvent}</span>}
              {entry.giftTestDone && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Gift</span>}
            </div>
            {entry.status !== 'REGISTERED' && (
              <button
                onClick={() => onReminder(entry)}
                disabled={sendingReminder === entry.id}
                className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white disabled:opacity-50 flex items-center gap-1"
              >
                {sendingReminder === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Reminder
              </button>
            )}
          </div>
        </div>
      ))
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