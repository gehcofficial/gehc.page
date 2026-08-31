import React, { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { GiftTestWizard } from '../public/JoinPage';

type GiftItem = { key?: string; label?: string; score?: number } | string;

function normalizeGifts(raw: unknown): Array<{ key: string; label: string; score?: number }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((g, i) => {
    if (typeof g === 'string') return { key: `gift-${i}`, label: g };
    const o = g as GiftItem & Record<string, unknown>;
    return {
      key: String(o.key || `gift-${i}`),
      label: String(o.label || o.key || g),
      score: typeof o.score === 'number' ? o.score : undefined,
    };
  });
}

export const ProfileGiftsSection: React.FC<{
  giftsTop5: unknown;
  onSaved: () => void;
  addToast: (t: { type: 'success' | 'error'; title: string; description?: string }) => void;
}> = ({ giftsTop5, onSaved, addToast }) => {
  const [retaking, setRetaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const existing = normalizeGifts(giftsTop5);
  const showWizard = retaking || existing.length === 0;

  const handleFinish = async (result: {
    top5: { key: string; label: string; score: number }[];
    scores: Record<string, number>;
  }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/gifttest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'user', giftsTop5: result.top5, giftsScores: result.scores }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan tes karunia');
      addToast({ type: 'success', title: 'Tes karunia tersimpan', description: 'Top-5 karunia rohani sudah diperbarui.' });
      setRetaking(false);
      onSaved();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Gagal',
        description: e instanceof Error ? e.message : 'Gagal menyimpan tes karunia',
      });
    } finally {
      setSaving(false);
    }
  };

  if (saving) {
    return (
      <div className="py-8 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan hasil tes…
      </div>
    );
  }

  if (showWizard) {
    return (
      <div className="space-y-3">
        {existing.length > 0 && (
          <button
            type="button"
            onClick={() => setRetaking(false)}
            className="text-[10px] font-bold text-[#8C8880] hover:text-[#181818]"
          >
            ← Kembali ke hasil
          </button>
        )}
        <p className="text-[10px] text-[#8C8880]">
          Jawab semua pernyataan (skala 1–5). Hasil Top-5 karunia dihitung otomatis.
        </p>
        <GiftTestWizard onFinish={handleFinish} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Top-5 Karunia Rohani</p>
      <div className="space-y-2">
        {existing.map((g, i) => (
          <div key={g.key} className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-[#181818] text-white text-[10px] font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="text-sm font-bold flex-1">{g.label}</span>
            {g.score != null && (
              <span className="text-[10px] font-bold text-[#8C8880] tabular-nums">{g.score}/15</span>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRetaking(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D7D0] text-[10px] font-bold text-[#8C8880] hover:border-[#181818] hover:text-[#181818]"
      >
        <RefreshCw className="w-3 h-3" /> Ulangi tes
      </button>
    </div>
  );
};
