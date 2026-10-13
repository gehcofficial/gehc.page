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
  patternVariant?: { opening?: string | null; offering?: string | null };
};

type Props = {
  yearMonth?: string;
  weekIndex?: number;
  eventName?: string;
  initialSub?: 'katalog' | 'draft' | 'kontrol';
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
export const PolaSesiPanel: React.FC<Props> = ({ yearMonth, weekIndex: weekIndexProp, eventName, initialSub }) => {
  const { addToast, currentRole, isKomisi, isBodTimkerja, isDidaskalia } = useApp();
  const canWrite = isKomisi || currentRole === 'SUPERADMIN' || isBodTimkerja || isDidaskalia;

  // Sub-tab dalam Pola & Sesi: katalog (pilih pola pekan) / draft (isi sesi event) / kontrol (hari-H).
  // Default draft — aksi tersering; pindah sub-tab tidak unmount isi (pakai hidden).
  const [subTab, setSubTab] = useState<'katalog' | 'draft' | 'kontrol'>(initialSub || 'draft');
  useEffect(() => {
    if (initialSub) setSubTab(initialSub);
  }, [initialSub]);

  const [ym] = useState(yearMonth || '');
  const [weekIndex] = useState(weekIndexProp || 1);
  // Ikuti event terpilih — tanggal dipilih sekali di DivisionWorkspacePanel.
  const activeYm = yearMonth || ym;
  const activeWeek = weekIndexProp || weekIndex;

  const [weekMeta, setWeekMeta] = useState<WeekMeta | null>(null);
  const [patterns, setPatterns] = useState<WorshipPatternLite[]>([]);
  const [event, setEvent] = useState<{ id: string; name: string; serviceType?: string | null; eventDate?: string | null } | null>(null);
  // Jam jemaat mulai (T0): preview lokal + tersimpan di eventDate (ISO). PRA tampil T-minus sebelumnya.
  const [t0Input, setT0Input] = useState('');
  const [t0Dirty, setT0Dirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Naikkan tiap savePattern berhasil agar SessionDraftTab + MentoringControl reload list sesi.
  const [sessionEpoch, setSessionEpoch] = useState(0);

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
        patternVariant: d.week?.patternVariant || { opening: 'KEDUANYA', offering: 'HEMAT' },
      });
      setEvent(d.event || null);
      // Prefill jam T0 dari eventDate (bagian jam, WIB). Tanggal ikut weekMeta.date.
      const evDate = String(d.event?.eventDate || '');
      if (evDate) {
        const t = new Date(evDate);
        if (!Number.isNaN(t.getTime())) {
          const pad = (n: number) => String(n).padStart(2, '0');
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(t);
          const hh = parts.find((p) => p.type === 'hour')?.value || '13';
          const mm = parts.find((p) => p.type === 'minute')?.value || '00';
          setT0Input(`${pad(Number(hh))}:${pad(Number(mm))}`);
        }
      } else {
        setT0Input('');
      }
      setT0Dirty(false);
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
        // Sinkronkan list sesi di bawah (SessionDraftTab linked + MentoringControl)
        // agar tidak menunjuk sesi pola lama setelah pekan berganti.
        setSessionEpoch((e) => e + 1);
      } catch (e: unknown) {
        addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan pola.' });
      } finally {
        setBusy(null);
      }
    },
    [addToast, canWrite, activeYm, activeWeek],
  );

  const saveVariant = useCallback(
    async (patch: { opening?: string; offering?: string }) => {
      if (!canWrite) return;
      const next = {
        opening: String(patch.opening ?? weekMeta?.patternVariant?.opening ?? 'KEDUANYA').toUpperCase(),
        offering: String(patch.offering ?? weekMeta?.patternVariant?.offering ?? 'HEMAT').toUpperCase(),
      };
      setWeekMeta((m) => (m ? { ...m, patternVariant: next } : m));
      setBusy('variant');
      try {
        const r = await fetch(`/api/didaskalia/studio/${activeYm}/${activeWeek}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patternVariant: next }),
        });
        if (!r.ok) throw new Error('Gagal menyimpan varian.');
        addToast({ type: 'success', title: 'Varian pekan tersimpan' });
      } catch (e: unknown) {
        addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal menyimpan varian.' });
      } finally {
        setBusy(null);
      }
    },
    [addToast, canWrite, activeYm, activeWeek, weekMeta?.patternVariant],
  );

  // Simpan jam jemaat mulai (T0) ke eventDate (reuse PATCH /api/events/:id).
  // Tanggal ikut weekMeta.date; jam dari input. Butuh peran Komisi+ (Didaskalia saja → 403 ramah).
  const saveT0 = useCallback(async () => {
    if (!canWrite || !event?.id || !t0Input) return;
    const day = String(weekMeta?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      addToast({ type: 'error', title: 'Tanggal pekan belum ada.' });
      return;
    }
    setBusy('t0');
    try {
      const r = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventDate: `${day}T${t0Input}:00+07:00` }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error((d as { error?: string }).error || `Gagal menyimpan jam (server ${r.status}).`);
      setEvent((e) => (e ? { ...e, eventDate: `${day}T${t0Input}:00+07:00` } : e));
      setT0Dirty(false);
      addToast({ type: 'success', title: `Jam jemaat mulai: ${t0Input} WIB` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menyimpan jam.';
      addToast({
        type: 'error',
        title: 'Jam belum tersimpan',
        description: /403|Forbidden|akses|peran/i.test(msg) ? 'Butuh peran Komisi+ untuk ubah jam event — jam di bawah hanya preview lokal.' : msg,
      });
    } finally {
      setBusy(null);
    }
  }, [addToast, canWrite, event?.id, t0Input, weekMeta?.date]);

  if (!activeYm) {
    return (
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
        <p className="text-xs text-[#8C8880]">Pilih event dulu untuk melihat pola & sesi pekan ini.</p>
      </div>
    );
  }

  const subTabs: Array<{ id: 'katalog' | 'draft' | 'kontrol'; label: string }> = [
    { id: 'katalog', label: 'Katalog' },
    { id: 'draft', label: 'Draft' },
    { id: 'kontrol', label: 'Kontrol' },
  ];

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
        <div className="flex flex-wrap gap-1.5">
          {subTabs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubTab(s.id)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-bold border ${subTab === s.id ? 'bg-[#1B1B1B] text-white border-[#1B1B1B]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#8C8880]">
          Pola pekan ini menentukan POV kontrol hari-H: tiap pola menyembunyikan modul yang tidak relevan. Draft, kontrol, dan 3 link
          (peserta/layar/kontrol) mengikuti event di atas.
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/60 px-3 py-2">
          <span className="text-[11px] font-bold text-[#1B1B1B]">Jam jemaat mulai (T0):</span>
          <input
            type="time"
            value={t0Input}
            onChange={(e) => { setT0Input(e.target.value); setT0Dirty(true); }}
            disabled={!canWrite}
            className="rounded-lg border border-[#D9D7D0] bg-white px-2 py-1 text-xs disabled:opacity-60"
          />
          <span className="text-[10px] text-[#8C8880]">PRA (doa petugas + siap kru) jalan T-minus sebelumnya.</span>
          {canWrite && t0Dirty && event?.id && (
            <button
              type="button"
              disabled={busy === 't0'}
              onClick={() => void saveT0()}
              className="ml-auto px-2.5 py-1.5 rounded-lg bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-50"
            >
              {busy === 't0' ? 'Menyimpan…' : 'Simpan jam ke event'}
            </button>
          )}
        </div>
        {error && <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat pola…
        </p>
      ) : (
        <>
          <div className={subTab === 'katalog' ? '' : 'hidden'}>
            <WorshipPatternCatalog
              patterns={patterns}
              activeCode={weekMeta?.patternCode || 'MONOLOG'}
              canWrite={canWrite}
              busy={!!busy}
              weekVariant={weekMeta?.patternVariant || { opening: 'KEDUANYA', offering: 'HEMAT' }}
              t0={(() => {
                const day = String(weekMeta?.date || '').slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(day) && t0Input) return `${day}T${t0Input}:00+07:00`;
                return event?.eventDate || null;
              })()}
              onVariantChange={(patch) => void saveVariant(patch)}
              onUse={(code) => void savePattern(code)}
              onCopyPlaybook={() => addToast({ type: 'success', title: 'Naskah pola disalin' })}
            />
            <button
              type="button"
              onClick={() => setSubTab('draft')}
              className="mt-3 text-[11px] font-bold text-sky-700 hover:underline"
            >
              Lanjut ke Draft →
            </button>
          </div>
          <div className={subTab === 'draft' ? '' : 'hidden'}>
            <SessionDraftTab
              key={`draft-${sessionEpoch}`}
              ym={activeYm}
              weekIndex={activeWeek}
              patternCode={weekMeta?.patternCode || 'MONOLOG'}
              event={event}
              weekDate={weekMeta?.date}
              canWrite={canWrite}
              onPatternReset={() => void load()}
            />
          </div>
          <div className={subTab === 'kontrol' ? '' : 'hidden'}>
            <MentoringControl
              key={`kontrol-${sessionEpoch}-${weekMeta?.patternCode || ''}`}
              eventId={event?.id || null}
              preferPattern={weekMeta?.patternCode || null}
            />
          </div>
        </>
      )}
    </div>
  );
};
