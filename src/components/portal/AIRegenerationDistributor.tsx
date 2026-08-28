import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Brain, Sparkles, TrendingUp, Minus, Plus, AlertCircle, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
import ConfirmationModal from '../ui/ConfirmationModal';

interface Assignment {
  groupId: string;
  groupName: string;
  currentMembers: number;
  suggestedMembers: string[];
  giftCoverage: Record<string, number>;
  diversityScore: number;
}

interface RegenerationPlan {
  assignments: Assignment[];
  unassigned: string[];
  stats: {
    totalMentees: number;
    totalGroups: number;
    avgPerGroup: number;
    minGroupSize: number;
    maxGroupSize: number;
    giftDiversityIndex: number;
  };
}

interface MenteeOption {
  id: string;
  name: string;
  giftsTop5: string[];
}

export const AIRegenerationDistributor: React.FC = () => {
  const { groups, groupMembers, users } = useApp();
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedMenteeIds, setSelectedMenteeIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<RegenerationPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [options, setOptions] = useState({
    maxPerGroup: 15,
    prioritizeDiversity: true,
  });

  const parentGroups = groups.filter((g) => !g.parentGroupId);
  const menteeUsers = users.filter(
    (u) => u.accountStatus === 'ACTIVE' && u.giftsTop5 && Array.isArray(u.giftsTop5) && u.giftsTop5.length > 0
  );

  const groupMembersMap = new Map<string, number>();
  for (const gm of groupMembers) {
    if (gm.batchPeriod === period) {
      groupMembersMap.set(gm.groupId, (groupMembersMap.get(gm.groupId) || 0) + 1);
    }
  }

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleMentee = (id: string) => {
    setSelectedMenteeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const generatePreview = async () => {
    if (selectedGroupIds.length === 0 || selectedMenteeIds.length === 0) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/regeneration/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menteeUserIds: selectedMenteeIds, groupIds: selectedGroupIds, options }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Gagal generate preview');
      setPlan(data);
      setShowPreview(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const applyPlan = async () => {
    if (!plan) return;
    setApplying(true);
    try {
      const resp = await fetch('/api/regeneration/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: plan.assignments, period }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Gagal menerapkan regenerasi');
      alert(data.message);
      setPlan(null);
      setShowPreview(false);
      setSelectedMenteeIds([]);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const getGroup = (id: string) => groups.find((g) => g.id === id);
  const getUser = (id: string) => users.find((u) => u.id === id);

  const formatGifts = (gifts: Record<string, number>) => {
    return Object.entries(gifts)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([gift, count]) => `${gift}(${count})`)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[28px] p-6 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C] mb-1 flex items-center gap-2">
              <Brain className="w-4 h-4" /> AI Regenerasi Distribusi
            </p>
            <h2 className="text-xl font-bold">Distribusi Mentee Merata & Adil (1 Kor 12)</h2>
            <p className="text-xs text-[#8C8880] mt-1">
              Algoritma mengoptimalkan: (1) ukuran kelompok seimbang, (2) keragaman karunia per kelompok
            </p>
          </div>
        </div>

        {/* Step 1: Select Groups */}
        <div className="space-y-4 mb-6 p-4 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/50">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4" /> 1. Pilih Kelompok Tujuan ({selectedGroupIds.length} dipilih)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {parentGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={`p-3 rounded-xl text-left transition-all ${
                  selectedGroupIds.includes(g.id)
                    ? 'bg-white shadow-sm border-2'
                    : 'bg-white border border-[#D9D7D0] hover:border-black'
                }`}
                style={{ borderColor: selectedGroupIds.includes(g.id) ? g.color : '#D9D7D0' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold mb-2 shrink-0" style={{ backgroundColor: g.color }}>
                  {g.name.substring(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-bold truncate">{g.name}</p>
                <p className="text-[10px] text-[#8C8880]">
                  {groupMembersMap.get(g.id) || 0} anggota (batch {period})
                </p>
                {selectedGroupIds.includes(g.id) && <CheckCircle className="absolute top-2 right-2 w-4 h-4" style={{ color: g.color }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Select Mentees */}
        <div className="space-y-4 mb-6 p-4 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 2. Pilih Mentee Calon ({selectedMenteeIds.length} dipilih)
            </h3>
            {menteeUsers.length > 0 && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMenteeIds.length === menteeUsers.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMenteeIds(menteeUsers.map((u) => u.id));
                    } else {
                      setSelectedMenteeIds([]);
                    }
                  }}
                  className="w-4 h-4 accent-[#FF416C]"
                />
                Pilih Semua
              </label>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {menteeUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => toggleMentee(u.id)}
                className={`p-2.5 rounded-xl text-left transition-all ${
                  selectedMenteeIds.includes(u.id)
                    ? 'bg-white shadow-sm border-2 border-[#FF416C]'
                    : 'bg-white border border-[#D9D7D0] hover:border-black'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF416C] to-[#FF4B2B] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(u.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{u.name}</p>
                    <p className="text-[9px] text-[#8C8880] truncate">
                      {u.giftsTop5?.slice(0, 3).join(', ')}
                    </p>
                  </div>
                  {selectedMenteeIds.includes(u.id) && <CheckCircle className="w-3.5 h-3.5 text-[#FF416C]" />}
                </div>
              </button>
            ))}
            {menteeUsers.length === 0 && (
              <p className="col-span-full text-center text-xs text-[#8C8880] py-4">
                Tidak ada mentee dengan data karunia. Lengkapi profil terlebih dahulu.
              </p>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6 p-4 rounded-xl bg-white border border-[#D9D7D0]/50">
          <h3 className="text-sm font-bold">Opsi Distribusi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                Maks Anggota per Kelompok
              </label>
              <input
                type="number"
                min="5"
                max="25"
                value={options.maxPerGroup}
                onChange={(e) => setOptions({ ...options, maxPerGroup: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex items-center gap-3 pt-4">
              <input
                type="checkbox"
                id="prioritizeDiversity"
                checked={options.prioritizeDiversity}
                onChange={(e) => setOptions({ ...options, prioritizeDiversity: e.target.checked })}
                className="w-4 h-4 accent-[#FF416C]"
              />
              <label htmlFor="prioritizeDiversity" className="text-xs font-bold">
                Prioritaskan Keragaman Karunia (1 Kor 12)
              </label>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                Periode Regenerasi (YYYY-MM)
              </label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
              />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex gap-3">
          <button
            onClick={generatePreview}
            disabled={loading || selectedGroupIds.length === 0 || selectedMenteeIds.length === 0}
            className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Menganalisis...' : 'Generate Preview Distribusi'}
          </button>
          {plan && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-3 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold hover:border-black transition-colors"
            >
              {showPreview ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {showPreview && plan && (
        <div className="space-y-4">
          <div className="bg-white rounded-[28px] p-6 border border-[#D9D7D0]/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: '#FF416C' }} /> Preview Distribusi
              </h3>
              <div className="flex items-center gap-2 text-xs text-[#8C8880]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                  Diversity Index: {(plan.stats.giftDiversityIndex * 100).toFixed(1)}%
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                  Rata-rata: {plan.stats.avgPerGroup.toFixed(1)}/kelompok
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {plan.assignments.map((a) => {
                const group = getGroup(a.groupId);
                const size = a.currentMembers + a.suggestedMembers.length;
                return (
                  <div
                    key={a.groupId}
                    className={`p-4 rounded-xl border ${
                      size > options.maxPerGroup
                        ? 'border-red-300 bg-red-50'
                        : size < 5
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-[#D9D7D0]/60 bg-white'
                    }`}
                    style={{ borderColor: size > options.maxPerGroup ? '#FF416C' : group?.color }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: group?.color || '#181818' }}>
                        {group?.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{a.groupName}</p>
                        <p className="text-[10px] text-[#8C8880]">
                          {a.currentMembers} → <span className="font-bold text-[#FF416C]">{size}</span> anggota
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      <p className="text-[#8C8880]">
                        <span className="font-bold">Diversity:</span> {(a.diversityScore * 100).toFixed(1)}%
                      </p>
                      <p className="text-[#8C8880] truncate">
                        <span className="font-bold">Karunia:</span> {formatGifts(a.giftCoverage) || '—'}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {a.suggestedMembers.map((uid) => {
                        const u = getUser(uid);
                        return u ? (
                          <span key={uid} className="px-2 py-0.5 rounded-full bg-[#FF416C]/10 text-[#FF416C] text-[9px] font-bold">
                            {u.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    {a.suggestedMembers.length === 0 && (
                      <p className="text-[10px] text-[#8C8880] italic mt-2">Tidak ada mentee baru</p>
                    )}
                  </div>
                );
              })}
            </div>

            {plan.unassigned.length > 0 && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {plan.unassigned.length} mentee tidak terdistribusi (kelompok penuh)
                </p>
                <p className="text-[10px] text-red-600 mt-1">
                  {plan.unassigned.map((id) => getUser(id)?.name).filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-[#D9D7D0]/60 flex justify-end gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 rounded-full bg-white border border-[#D9D7D0] text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={applyPlan}
                disabled={applying || plan.unassigned.length > 0}
                className="px-5 py-2 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {applying ? 'Menerapkan...' : 'Terapkan Regenerasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={false}
        onClose={() => {}}
        onConfirm={() => {}}
        title=""
        message=""
        confirmText="Ya"
        cancelText="Batal"
      />
    </div>
  );
};