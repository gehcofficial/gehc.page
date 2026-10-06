import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Clapperboard, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorshipPatternCatalog } from './WorshipPatternCatalog';
import { SessionDraftTab } from './SessionDraftTab';
import { MentoringControl } from '../mentoring/MentoringControl';
import type { WorshipPatternLite } from '../../lib/worship-patterns';

type WeekMeta = {
  index: number;
  date: string;
  theme?: string;
  mentoringTheme?: string;
  servingTheme?: string;
  patternCode?: string;
};

type Props = {
  yearMonth?: string;
  weekIndex?: number;
  eventName?: string;
};

async function readJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

function fmtDate(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/**
 * Tab paralel "Pola & Sesi" (Didaskalia) — eksekusi hari-H per event.
 * Mengikuti tanggal kegiatan dari DivisionWorkspacePanel (ym/weekIndex dari selectedEvent),
 * jadi ganti event di atas otomatis reload pola + draft + kontrol di bawah.
 */
export const PolaSesiPanel: React.FC<Props> = ({ yearMonth, weekIndex: weekIndexProp, eventName }) => {
  const { addToast, currentRole, isKomisi, isBodTimkerja, isDidaskalia } = useApp();
  const canWrite = isKomisi || currentRole === 'SUPERADMIN' || isBodTimkerja || isDidaskalia;

  const [ym] = useState(yearMonth || '');
  const [weekIndex] = useState(weekIndexProp || 1);
  // Ikuti event terpilih — tanggal dipilih sekali di DivisionWorkspacePanel.
  const activeYm = yearMonth || ym;
  const activeWeek = weekIndexProp || weekIndex;

  const [weekMeta, setWeekMeta] = useState<WeekMeta | null>(null);
  const [patterns, setPatterns] = useState<WorshipPatternLite[]>([]);
  const [event, setEvent] = useState<{ id: string; name: string; serviceType?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeYm || !activeWeek) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/didaskalia/studio/${activeYm}/${activeWeek}`, { credentials: 'include' });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || `Gagal memuat pola (server ${r.status}).`);
      setWeekMeta({
        index: d.week?.index,
        date: d.week?.date,
        theme: d.week?.theme,
        mentoringTheme: d.week?.mentoringTheme,
        servingTheme: d.week?.servingTheme,
        patternCode: d.week?.patternCode || 'MONOLOG',
      });
      setEvent(d.event || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat.');
    } finally {
      setLoading(false);
    }
  }, [activeYm, activeWeek]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch('/api/worship/patterns', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { patterns: [] }))
      .then((d) => setPatterns(((d.patterns || []) as WorshipPatternLite[]).filter((p) => p.code)))
      .catch(() => setPatterns([]));
  }, []);

  const savePattern = useCallback(
    async (code: string) => {
      if (!canWrite) return;
      const next = code || 'MONOLOG';
      setWeekMeta((m) => (m ? { ...m, patternCode: next } : m));
      setBusy('pattern');
      try {
        const r = await fetch(`/api/didaskalia/studio/${activeYm}/${activeWeek}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patternCode: next }),
        });
        if (!r.ok) throw new Error('Gagal menyimpan pola.');
        addToast({ type: 'success', title: `Pola pekan: ${next}` });
      } catch (e: unknown) {
        addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan pola.' });
      } finally {
        setBusy(null);
      }
    },
    [addToast, canWrite, activeYm, activeWeek],
  );

  if (!activeYm) {
    return (
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
        <p className="text-xs text-[#8C8880]">Pilih event dulu untuk melihat pola & sesi pekan ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Clapperboard className="w-4 h-4 text-[#0EA5E9]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Pola & Sesi</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold">
            {weekMeta?.patternCode || 'MONOLOG'}
          </span>
          <span className="ml-auto text-[11px] text-[#8C8880] inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Event: {event?.name || eventName || 'terpilih'}
            {weekMeta?.date ? ` · ${fmtDate(String(weekMeta.date))}` : ''}
          </span>
        </div>
        <p className="text-[11px] text-[#8C8880]">
          Pola pekan ini menentukan POV kontrol hari-H: tiap pola menyembunyikan modul yang tidak relevan. Draft, kontrol, dan 3 link
          (peserta/layar/kontrol) mengikuti event di atas.
        </p>
        {error && <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat pola…
        </p>
      ) : (
        <>
          <WorshipPatternCatalog
            patterns={patterns}
            activeCode={weekMeta?.patternCode || 'MONOLOG'}
            canWrite={canWrite}
            busy={!!busy}
            onUse={(code) => void savePattern(code)}
            onCopyPlaybook={() => addToast({ type: 'success', title: 'Naskah pola disalin' })}
          />
          <SessionDraftTab
            ym={activeYm}
            weekIndex={activeWeek}
            patternCode={weekMeta?.patternCode || 'MONOLOG'}
            event={event}
            weekDate={weekMeta?.date}
            canWrite={canWrite}
            onPatternReset={() => void load()}
          />
          <MentoringControl eventId={event?.id || null} />
        </>
      )}
    </div>
  );
};
