import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Users,
  User,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  CheckSquare,
  Square,
  MinusSquare,
  Send,
  Brain,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ROLE_LABELS = {
  MENTOR: 'Mentor',
  COMENTOR: 'Co-Mentor',
  MENTEE: 'Mentee',
};

const ROLE_COLORS = {
  MENTOR: 'bg-emerald-100 text-emerald-700',
  COMENTOR: 'bg-teal-100 text-teal-700',
  MENTEE: 'bg-blue-100 text-blue-700',
};

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REVISED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  INDIVIDU: 'bg-purple-100 text-purple-700',
};

const STATUS_LABELS = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REVISED: 'Direvisi',
  REJECTED: 'Ditolak',
  INDIVIDU: 'Individu',
};

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

interface PlacementItem {
  id: string;
  newcomerId: string;
  newcomerName: string;
  newcomerGender: string;
  newcomerGiftsTop5: string[];
  newcomerMaturityScore: number | null;
  recommendedGroupId: string | null;
  recommendedGroupName: string | null;
  recommendedRole: string | null;
  confidence: number;
  reasons: string[];
  scoreBreakdown: {
    evenDistribution: number;
    genderBalance: number;
    giftDiversity: number;
    maturityFit: number;
  } | null;
  status: string;
  finalGroupId: string | null;
  finalGroupName?: string | null;
  finalRole: string | null;
  finalIsIndividu: boolean;
}

interface PlacementBatch {
  id: string;
  status: string;
  createdBy: string;
  createdAt: string;
  generatedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  committedAt: string | null;
  committedBy: string | null;
  items: PlacementItem[];
}

interface EligibleNewcomer {
  id: string;
  name: string;
  gender: string;
  giftsTop5: string[];
  giftsScores: Record<string, number>;
}

export const JethroPlacementReview: React.FC = () => {
  const { addToast, currentRole } = useApp();
  const canWritePlacement = currentRole !== 'BPMJ';

  // State
  const [eligibleNewcomers, setEligibleNewcomers] = useState<EligibleNewcomer[]>([]);
  const [batches, setBatches] = useState<PlacementBatch[]>([]);
  const [currentBatch, setCurrentBatch] = useState<PlacementBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Fetch eligible newcomers
  const fetchEligible = useCallback(async () => {
    try {
      const res = await fetch('/api/jethro/placement/eligible', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setEligibleNewcomers(d.newcomers || []);
      }
    } catch (e) {
      console.error('Failed to fetch eligible newcomers:', e);
    }
  }, []);

  // Fetch batches
  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/jethro/placement/batches?limit=20', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setBatches(d.batches || []);
        // Auto-load latest batch if none selected
        if (!currentBatch && d.batches?.length > 0) {
          fetchBatch(d.batches[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch batches:', e);
    }
  }, [currentBatch]);

  // Fetch single batch
  const fetchBatch = useCallback(async (batchId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jethro/placement/batch/${batchId}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setCurrentBatch(d);
      }
    } catch (e) {
      console.error('Failed to fetch batch:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEligible();
    fetchBatches();
  }, [fetchEligible, fetchBatches]);

  // Generate recommendations for all eligible newcomers
  const handleGenerate = async () => {
    if (eligibleNewcomers.length === 0) {
      addToast({ type: 'error', title: 'Tidak Ada Calon', description: 'Belum ada newcomer yang eligible (perlu gender + gift test).' });
      return;
    }

    setGenerating(true);
    try {
      const ids = eligibleNewcomers.map((n) => n.id).join(',');
      const res = await fetch(`/api/jethro/placement/advanced?ids=${ids}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal generate rekomendasi');

      const { recommendations } = await res.json();

      // Create batch
      const batchRes = await fetch('/api/jethro/placement/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations }),
      });

      if (!batchRes.ok) throw new Error('Gagal buat batch');

      const batch = await batchRes.json();
      addToast({ type: 'success', title: 'Rekomendasi Dibuat', description: `${recommendations.length} newcomer dianalisis.` });
      fetchBatches();
      fetchBatch(batch.id);
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  // Update single item
  const handleUpdateItem = async (itemId: string, status: string, overrides: { finalGroupId?: string; finalRole?: string; finalIsIndividu?: boolean } = {}) => {
    try {
      const res = await fetch(`/api/jethro/placement/item/${itemId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...overrides }),
      });
      if (!res.ok) throw new Error('Gagal update item');

      addToast({ type: 'success', title: 'Berhasil', description: `Item ${STATUS_LABELS[status] || status}.` });
      if (currentBatch) fetchBatch(currentBatch.id);
      fetchBatches();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    }
  };

  // Bulk approve
  const handleBulkApprove = async () => {
    if (!currentBatch) return;
    try {
      const res = await fetch(`/api/jethro/placement/batch/${currentBatch.id}/bulk-approve`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal bulk approve');
      addToast({ type: 'success', title: 'Bulk Approve', description: 'Semua item pending disetujui.' });
      fetchBatch(currentBatch.id);
      fetchBatches();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    }
  };

  // Commit batch
  const handleCommit = async () => {
    if (!currentBatch) return;
    try {
      const res = await fetch(`/api/jethro/placement/batch/${currentBatch.id}/commit`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Gagal commit');
      const result = await res.json();
      addToast({ type: 'success', title: 'Commit Berhasil', description: `Created: ${result.created}, Individu: ${result.individu}, Errors: ${result.errors.length}` });
      fetchBatch(currentBatch.id);
      fetchBatches();
      fetchEligible();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    }
};

  // AI Analysis for current batch recommendations
  const handleAiAnalysis = async () => {
    if (!currentBatch) return;
    setAiAnalyzing(true);
    setAiAnalysis(null);
    try {
      const res = await fetch('/api/jethro/placement/ai-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations: currentBatch.items,
          batchId: currentBatch.id,
        }),
      });
      if (!res.ok) throw new Error('Gagal analisis AI');
      const { analysis } = await res.json();
      setAiAnalysis(analysis);
      addToast({ type: 'success', title: 'Analisis AI Selesai', description: 'Jethro telah menganalisis rekomendasi penempatan.' });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Get groups for dropdown
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch('/api/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups((d.groups || []).filter((g: any) => g.status === 'ACTIVE')))
      .catch(console.error);
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!currentBatch) return [];
    return currentBatch.items.filter((item) => {
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (searchQuery && !item.newcomerName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [currentBatch, filterStatus, searchQuery]);

  const pendingCount = currentBatch?.items.filter((i) => i.status === 'PENDING').length || 0;
  const approvedCount = currentBatch?.items.filter((i) => i.status === 'APPROVED').length || 0;
  const revisedCount = currentBatch?.items.filter((i) => i.status === 'REVISED').length || 0;
  const rejectedCount = currentBatch?.items.filter((i) => i.status === 'REJECTED').length || 0;
  const individuCount = currentBatch?.items.filter((i) => i.status === 'INDIVIDU').length || 0;

  if (!currentBatch && batches.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Jethro Placement Review
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Jethro Placement Review</h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Review rekomendasi penempatan newcomer ke kelompok mentoring.
            {!canWritePlacement && ' Mode baca-saja untuk BPMJ.'}
          </p>
        </div>

        {!canWritePlacement && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800 mb-4">
            Anda login sebagai BPMJ — dapat melihat batch penempatan, tetapi approve/commit hanya untuk Komisi.
          </div>
        )}

        {/* Eligible Newcomers */}
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Newcomer Eligible ({eligibleNewcomers.length})</h3>
            {canWritePlacement && (
            <button
              onClick={handleGenerate}
              disabled={eligibleNewcomers.length === 0 || generating}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {generating ? 'Menganalisis...' : 'Generate Rekomendasi'}
            </button>
            )}
          </div>

          {eligibleNewcomers.length === 0 ? (
            <div className="text-center py-8 text-[#8C8880]">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Belum ada newcomer eligible</p>
              <p className="text-xs mt-1">Perlu: gender + gift test selesai + status PROFILE_COMPLETED</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {eligibleNewcomers.map((n) => (
                <div key={n.id} className="p-4 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/50">
                  <div className="flex items-center gap-3">
                    <img src={initialsAvatar(n.name)} alt={n.name} className="w-10 h-10 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{n.name}</p>
                      <p className="text-xs text-[#8C8880]">{n.gender === 'LAKI-LAKI' ? '👦' : '👧'} {n.gender}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {n.giftsTop5.slice(0, 3).map((g, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white text-[#1B1B1B] border border-[#D9D7D0]">
                        {g}
                      </span>
                    ))}
                    {n.giftsTop5.length > 3 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        +{n.giftsTop5.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* No batch message */}
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-12 text-center">
          <Sparkles className="w-16 h-16 text-[#8C8880]/30 mx-auto mb-4" />
          <p className="text-lg font-bold text-[#1B1B1B]">Belum ada batch placement</p>
          <p className="text-sm text-[#8C8880] mt-2">Klik "Generate Rekomendasi" untuk memulai analisis Jethro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#FF416C]" />
              <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
                Jethro Placement Review
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Jethro Placement Review</h2>
            <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
              Review & approve rekomendasi penempatan newcomer ke kelompok mentoring.
              {!canWritePlacement && ' Mode baca-saja untuk BPMJ.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={fetchBatches} className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-bold hover:bg-[#FAF9F5] flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {!canWritePlacement && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
          Anda login sebagai BPMJ — dapat melihat batch penempatan, tetapi approve/commit hanya untuk Komisi.
        </div>
      )}

      {/* Batch Selector + Stats */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-[#8C8880]">Batch:</label>
            <select
              value={currentBatch?.id || ''}
              onChange={(e) => e.target.value && fetchBatch(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium min-w-[250px]"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} — {new Date(b.createdAt).toLocaleDateString('id-ID')} ({b.items?.length || 0} items) [{b.status}]
                </option>
              ))}
            </select>
            {currentBatch && (
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                currentBatch.status === 'GENERATED' ? 'bg-blue-100 text-blue-700' :
                currentBatch.status === 'REVIEWING' ? 'bg-yellow-100 text-yellow-700' :
                currentBatch.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                currentBatch.status === 'COMMITTED' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {currentBatch.status}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">Pending: {pendingCount}</span>
          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Approved: {approvedCount}</span>
          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Revised: {revisedCount}</span>
          <span className="px-2 py-1 rounded bg-red-100 text-red-700">Rejected: {rejectedCount}</span>
          <span className="px-2 py-1 rounded bg-purple-100 text-purple-700">Individu: {individuCount}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8880]" />
          <input
            placeholder="Cari nama newcomer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium"
          />
        </div>

        {/* Filter */}
        <div className="flex gap-1">
          {['ALL', 'PENDING', 'APPROVED', 'REVISED', 'REJECTED', 'INDIVIDU'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${
                filterStatus === s
                  ? 'bg-[#181818] text-white'
                  : 'bg-[#F3F1EC] text-[#8C8880] hover:bg-gray-200'
              }`}
            >
              {STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {currentBatch && canWritePlacement && (
          <div className="flex gap-2">
            <button
              onClick={handleAiAnalysis}
              disabled={aiAnalyzing || pendingCount === 0}
              className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 text-xs font-bold hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
            >
              {aiAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {aiAnalyzing ? 'Menganalisis...' : 'Analisis AI'}
            </button>
            {pendingCount > 0 && (
              <button
                onClick={handleBulkApprove}
                className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200 flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Bulk Approve
              </button>
            )}
            {(approvedCount + revisedCount) > 0 && (
              <button
                onClick={handleCommit}
                disabled={loading}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Commit ke Youth GEHC
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Analysis Result */}
      {aiAnalysis && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-purple-700">Analisis AI Jethro</h3>
            </div>
            <button
              onClick={() => setAiAnalysis(null)}
              className="p-1.5 rounded-lg hover:bg-purple-100 text-purple-500"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-purple-800 whitespace-pre-wrap">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-12 text-center">
            <Filter className="w-12 h-12 text-[#8C8880]/30 mx-auto mb-3" />
            <p className="text-lg font-bold text-[#1B1B1B]">Tidak ada item</p>
            <p className="text-sm text-[#8C8880] mt-1">Coba ubah filter atau search.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <PlacementItemCard
              key={item.id}
              item={item}
              groups={groups}
              onUpdate={handleUpdateItem}
              readOnly={!canWritePlacement}
            />
          ))
        )}
      </div>
    </div>
  );
};

const PlacementItemCard: React.FC<{
  item: PlacementItem;
  groups: { id: string; name: string }[];
  onUpdate: (id: string, status: string, overrides?: any) => void;
  readOnly?: boolean;
}> = ({ item, groups, onUpdate, readOnly = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [overrideGroup, setOverrideGroup] = useState(item.finalGroupId || item.recommendedGroupId || '');
  const [overrideRole, setOverrideRole] = useState(item.finalRole || item.recommendedRole || 'MENTEE');
  const [overrideIndividu, setOverrideIndividu] = useState(item.finalIsIndividu || item.status === 'INDIVIDU');

  const isPending = item.status === 'PENDING';
  const isApproved = item.status === 'APPROVED';
  const isRevised = item.status === 'REVISED';
  const isRejected = item.status === 'REJECTED';
  const isIndividu = item.status === 'INDIVIDU' || item.finalIsIndividu;

  const genderIcon = item.newcomerGender === 'LAKI-LAKI' ? '👦' : '👧';

  const handleApprove = () => {
    onUpdate(item.id, 'APPROVED', {
      finalGroupId: overrideIndividu ? null : overrideGroup,
      finalRole: overrideIndividu ? 'MENTEE' : overrideRole,
      finalIsIndividu: overrideIndividu,
    });
  };

  const handleRevise = () => {
    onUpdate(item.id, 'REVISED', {
      finalGroupId: overrideIndividu ? null : overrideGroup,
      finalRole: overrideIndividu ? 'MENTEE' : overrideRole,
      finalIsIndividu: overrideIndividu,
    });
  };

  const handleReject = () => {
    onUpdate(item.id, 'REJECTED', { finalGroupId: null, finalRole: null, finalIsIndividu: false });
  };

  const handleIndividu = () => {
    onUpdate(item.id, 'INDIVIDU', { finalGroupId: null, finalRole: 'MENTEE', finalIsIndividu: true });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-[#FAF9F5] transition-colors"
      >
        <img src={initialsAvatar(item.newcomerName)} alt={item.newcomerName} className="w-10 h-10 rounded-full" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate">{item.newcomerName}</p>
            <span className="text-xs text-[#8C8880]">{genderIcon} {item.newcomerGender}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {item.newcomerGiftsTop5.slice(0, 3).map((g, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#F3F1EC] text-[#1B1B1B] border border-[#D9D7D0]">
                {g}
              </span>
            ))}
            {item.newcomerGiftsTop5.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                +{item.newcomerGiftsTop5.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Jethro Recommendation */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-[#8C8880]">Jethro Confidence</p>
            <p className="text-lg font-black text-[#FF416C]">{Math.round(item.confidence * 100)}%</p>
          </div>
          {item.recommendedGroupName && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-[#8C8880]">Group</p>
              <p className="text-sm font-bold">{item.recommendedGroupName}</p>
            </div>
          )}
          {item.recommendedRole && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-[#8C8880]">Role</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ROLE_COLORS[item.recommendedRole] || 'bg-gray-100 text-gray-600'}`}>
                {ROLE_LABELS[item.recommendedRole] || item.recommendedRole}
              </span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABELS[item.status] || item.status}
        </span>

        <ChevronDown className={`w-4 h-4 text-[#8C8880] shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#D9D7D0]/40 bg-[#FAF9F5]">
          <div className="pt-3 space-y-4">
            {/* Jethro Recommendation Details */}
            <div className="rounded-xl bg-white border border-[#D9D7D0]/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-[#FF416C]" />
                <h4 className="text-sm font-bold">Jethro Engine Recommendation</h4>
                <span className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold ${ROLE_COLORS[item.recommendedRole] || 'bg-gray-100 text-gray-600'}`}>
                  {ROLE_LABELS[item.recommendedRole] || item.recommendedRole}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-bold text-[#8C8880]">Kelompok</p>
                  <p className="text-sm font-medium">{item.recommendedGroupName || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#8C8880]">Confidence</p>
                  <p className="text-sm font-bold text-[#FF416C]">{Math.round(item.confidence * 100)}%</p>
                </div>
              </div>

              {/* Score Breakdown */}
              {item.scoreBreakdown && (
                <div className="space-y-2 mb-3">
                  <p className="text-[10px] font-bold text-[#8C8880]">Score Breakdown</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded bg-blue-50">
                      <p className="text-[10px] font-bold text-blue-700">{Math.round(item.scoreBreakdown.evenDistribution * 100)}%</p>
                      <p className="text-[9px] text-blue-600">Even Dist.</p>
                    </div>
                    <div className="p-2 rounded bg-pink-50">
                      <p className="text-[10px] font-bold text-pink-700">{Math.round(item.scoreBreakdown.genderBalance * 100)}%</p>
                      <p className="text-[9px] text-pink-600">Gender</p>
                    </div>
                    <div className="p-2 rounded bg-emerald-50">
                      <p className="text-[10px] font-bold text-emerald-700">{Math.round(item.scoreBreakdown.giftDiversity * 100)}%</p>
                      <p className="text-[9px] text-emerald-600">Gift Div.</p>
                    </div>
                    <div className="p-2 rounded bg-purple-50">
                      <p className="text-[10px] font-bold text-purple-700">{Math.round(item.scoreBreakdown.maturityFit * 100)}%</p>
                      <p className="text-[9px] text-purple-600">Maturity</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reasons */}
              {item.reasons.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-[#8C8880]">Alasan</p>
                  <div className="flex flex-wrap gap-1">
                    {item.reasons.map((r, i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-[#F3F1EC] text-[#1B1B1B] border border-[#D9D7D0]">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Override Controls */}
            {!readOnly && isPending && (
              <div className="rounded-xl bg-white border border-[#D9D7D0]/50 p-4 space-y-3">
                <h4 className="text-sm font-bold text-[#1B1B1B] flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#FF416C]" />
                  Override (Optional)
                </h4>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#1B1B1B] block mb-1">Kelompok</label>
                    <select
                      value={overrideGroup}
                      onChange={(e) => setOverrideGroup(e.target.value)}
                      disabled={overrideIndividu}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium disabled:opacity-50"
                    >
                      <option value="">— Pilih Kelompok —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#1B1B1B] block mb-1">Role</label>
                    <select
                      value={overrideRole}
                      onChange={(e) => setOverrideRole(e.target.value)}
                      disabled={overrideIndividu}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium disabled:opacity-50"
                    >
                      <option value="MENTOR">Mentor</option>
                      <option value="COMENTOR">Co-Mentor</option>
                      <option value="MENTEE">Mentee</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideIndividu}
                        onChange={(e) => setOverrideIndividu(e.target.checked)}
                        className="w-4 h-4 rounded border-[#D9D7D0] text-[#FF416C] focus:ring-[#FF416C]"
                      />
                      <span className="text-xs font-medium text-[#1B1B1B]">Individu (Tanpa Kelompok)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {!readOnly && isPending && (
                <>
                  <button onClick={handleApprove} className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={handleRevise} className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 flex items-center justify-center gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> Revise
                  </button>
                  <button onClick={handleReject} className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 flex items-center justify-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button onClick={handleIndividu} className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 flex items-center justify-center gap-1">
                    <User className="w-3.5 h-3.5" /> Individu
                  </button>
                </>
              )}
              {isApproved && (
                <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
                  {item.finalIsIndividu ? ' (Individu)' : item.finalGroupName && ` → ${item.finalGroupName} / ${ROLE_LABELS[item.finalRole]}`}
                </span>
              )}
              {isRevised && (
                <span className="px-4 py-2 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1">
                  <Edit2 className="w-3.5 h-3.5" /> Direvisi
                  {item.finalIsIndividu ? ' (Individu)' : item.finalGroupName && ` → ${item.finalGroupName} / ${ROLE_LABELS[item.finalRole]}`}
                </span>
              )}
              {isRejected && (
                <span className="px-4 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Ditolak
                </span>
              )}
              {isIndividu && (
                <span className="px-4 py-2 rounded-xl bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Individu
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};