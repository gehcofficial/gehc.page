import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  KIND_LABEL,
  LivePayload,
  activeSection,
} from '../../lib/liturgy-live';

/**
 * Kontrol tata ibadah — operator Liturgia (wajib login + peran tulis).
 * Rute `#/ibadah/<eventKey>/kontrol`.
 */
export const LiturgyControl: React.FC<{ eventKey: string }> = ({ eventKey }) => {
  const { addToast } = useApp();
  const [data, setData] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventKey)}/liturgy-live`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const d = (await r.json().catch(() => ({}))) as LivePayload & { error?: string };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setErr('');
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat.');
    } finally {
      setLoading(false);
    }
  }, [eventKey]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const save = async (body: Record<string, unknown>, ok = 'Tersimpan') => {
    setSaving(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventKey)}/liturgy-live`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; state?: { accessCode?: string } };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (d.state?.accessCode) setCode(d.state.accessCode);
      await load();
      addToast({ type: 'success', title: ok });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const items = data?.items || [];
  const currentId = data?.state?.currentItemId || null;
  const currentIdx = currentId ? items.findIndex((i) => i.id === currentId) : -1;
  const sectionIndex = data?.state?.sectionIndex || 0;

  const goItem = (idx: number) => {
    const it = items[idx];
    if (!it) return;
    void save({ status: 'LIVE', currentItemId: it.id, sectionIndex: 0 }, `Momen ${idx + 1} live`);
  };
  const stepSection = (dir: 1 | -1) => {
    if (currentIdx < 0) return;
    void save({ sectionIndex: Math.max(0, sectionIndex + dir) }, dir > 0 ? 'Bait berikut' : 'Bait sebelum');
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const screenUrl = `${origin}/#/ibadah/${encodeURIComponent(eventKey)}/layar`;

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C8880]">Kontrol Tata Ibadah</p>
            <h1 className="text-xl font-black truncate">{data?.eventName || eventKey}</h1>
          </div>
          <span className="px-2 py-1 rounded-full text-[11px] font-black bg-[#1B1B1B] text-white">{data?.state?.status || 'DRAFT'}</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>

        {err && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{err} (operator wajib login Liturgia/Komisi.)</p>}

        <div className="p-3 rounded-2xl bg-white border border-[#D9D7D0] flex flex-wrap items-center gap-2">
          <button type="button" disabled={saving || !items.length} onClick={() => goItem(0)} className="px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
            Mulai ibadah
          </button>
          <button type="button" disabled={saving || currentIdx <= 0} onClick={() => goItem(currentIdx - 1)} className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-50">
            ← Momen
          </button>
          <button type="button" disabled={saving || currentIdx < 0 || currentIdx >= items.length - 1} onClick={() => goItem(currentIdx + 1)} className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-50">
            Momen →
          </button>
          <button type="button" disabled={saving || currentIdx < 0} onClick={() => stepSection(-1)} className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-50">
            <ChevronLeft className="w-3 h-3 inline" /> Bait
          </button>
          <button type="button" disabled={saving || currentIdx < 0} onClick={() => stepSection(1)} className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-50">
            Bait <ChevronRight className="w-3 h-3 inline" />
          </button>
          <span className="flex-1" />
          <button type="button" disabled={saving} onClick={() => void save({ status: 'DONE', currentItemId: null }, 'Ibadah selesai')} className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-50">
            Selesai
          </button>
          <button type="button" disabled={saving} onClick={() => void save({ rotateCode: true }, 'Kode proyektor dirotasi')} title="Rotasi kode proyektor" className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-xs font-bold disabled:opacity-50">
            <RefreshCw className="w-3 h-3 inline" /> Kode
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-[#D9D7D0] text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[#8C8880] font-bold">Link layar:</span>
            <code className="flex-1 truncate bg-[#FAF9F5] px-2 py-1 rounded-lg">{screenUrl}</code>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(screenUrl); addToast({ type: 'success', title: 'Link layar disalin' }); }}
              className="p-1.5 rounded-lg border border-[#D9D7D0]"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {code && (
            <p>Kode proyektor saat ini: <strong className="tracking-[0.2em]">{code}</strong> (bagikan ke operator proyektor)</p>
          )}
        </div>

        <ol className="space-y-2">
          {items.map((it, idx) => {
            const isCur = it.id === currentId;
            const sec = it.display && it.display.kind === 'song' ? activeSection(it.display, isCur ? sectionIndex : 0) : null;
            return (
              <li key={it.id} className={`p-3 rounded-xl border ${isCur ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white border-[#D9D7D0]'}`}>
                <button type="button" onClick={() => goItem(idx)} className="w-full text-left flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${isCur ? 'bg-amber-200 text-black' : 'bg-[#1B1B1B] text-white'}`}>
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-black truncate">
                      [{KIND_LABEL[it.kind] || it.kind}] {it.serviceSong?.song?.title || it.title || '—'}
                    </span>
                    <span className={`block text-[10px] truncate ${isCur ? 'text-white/60' : 'text-[#8C8880]'}`}>
                      {sec ? `${sec.name} · bait ${isCur ? Math.min(sectionIndex + 1, (it.display?.sections || []).length) : 1}/${(it.display?.sections || []).length}` : (it.owner || it.note || '')}
                      {it.display && it.display.kind === 'song' && !it.display.hasLyrics ? ' · lirik belum ada' : ''}
                    </span>
                  </span>
                  {isCur && <span className="text-[10px] font-black text-amber-200">LIVE</span>}
                </button>
              </li>
            );
          })}
        </ol>
        {!items.length && !loading && <p className="text-sm text-[#8C8880] italic">Belum ada susunan — Liturgia menyusunnya di tab Ibadah portal.</p>}
      </div>
    </div>
  );
};
