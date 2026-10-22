import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, Timer } from 'lucide-react';
import {
  STATUS_LABELS,
  codeFromMentoringHash,
  labStationCopy,
  mentoringCodeKey,
  parseMentoringHash,
  type MentoringLivePayload,
} from '../../lib/mentoring';
import SessionTimer from './SessionTimer';
import FilmPreRoll from './FilmPreRoll';
import { TestimonyWheel } from './TestimonyWheel';
import WordCloud from './WordCloud';
import { ROUND_STEP_SECONDS, roundStepLabel } from '../../lib/session-engine';
import { labDisplayShowsRepNames } from '../../lib/creative-lab-rundown';
import { briefingFirmanOnly, labPresentationOrder, presentSlidePlan } from '../../lib/creative-lab-draft';
import { fetchWithEtag, startVisiblePoll } from '../../lib/visible-poll';

/**
 * Nada bioskop bawaan (WebAudio, tanpa file): sapuan lembut naik
 * sebagai penanda lampu redup. Diputar via klik (kebijakan autoplay).
 */
const CinemaToneButton: React.FC = () => {
  const play = () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.6);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 2.4);
      window.setTimeout(() => void ctx.close(), 3000);
    } catch {
      /* audio tak didukung — abaikan */
    }
  };
  return (
    <button
      type="button"
      onClick={play}
      className="mt-4 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/20"
    >
      ▶ Nada bioskop
    </button>
  );
};

const LabSlideArt: React.FC<{
  label: string;
  meaning: string;
  photos: { id: string; photoUrl: string | null }[];
  tone: 'emerald' | 'brand';
}> = ({ label, meaning, photos, tone }) => {
  const shown = photos.filter((p) => p.photoUrl).slice(0, 2);
  const frame = 'h-[58vh] rounded-2xl bg-black/40 border border-white/10 grid place-items-center overflow-hidden';
  return (
    <div className="space-y-4">
      <div className={shown.length > 1 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-1'}>
        {(shown.length ? shown : [{ id: 'empty', photoUrl: null }]).map((p) => (
          <div key={p.id} className={frame}>
            {p.photoUrl ? (
              <img src={p.photoUrl} alt={`Karya ${label}`} className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="text-sm text-white/50">Foto {label} belum diunggah.</p>
            )}
          </div>
        ))}
      </div>
      <div className={`rounded-2xl border p-4 text-center ${tone === 'emerald' ? 'bg-emerald-400/10 border-emerald-300/20' : 'bg-brand/10 border-brand/30'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${tone === 'emerald' ? 'text-emerald-300' : 'text-brand'}`}>Makna {label}</p>
        <p className="font-display text-xl sm:text-3xl font-black mt-1.5">{meaning}</p>
      </div>
    </div>
  );
};

/** Label timer langkah film (M0/M3/M4) — timer sesi penuh tak dipakai; bagian film tanpa timer. */
const FILM_STEP_LABELS: Record<string, { label: string; sub: string }> = {
  M0: { label: 'Likert Awal', sub: 'Isi 5 pernyataan di HP — tidak ada jawaban salah.' },
  M3: { label: 'Likert Akhir & Lesson Learned', sub: 'Isi 5 pernyataan + pilih chip pelajaran di HP.' },
  M4: { label: 'Undi & Kesaksian', sub: 'Dengarkan kesaksian yang terundi.' },
};

const MentoringScreen: React.FC = () => {
  const route = parseMentoringHash(typeof window !== 'undefined' ? window.location.hash : '');
  const slug = route?.slug || '';

  const [code, setCode] = useState(() => {
    if (typeof window === 'undefined' || !slug) return '';
    const fromHash = codeFromMentoringHash(window.location.hash);
    if (fromHash) {
      try {
        window.localStorage.setItem(mentoringCodeKey(slug), fromHash);
      } catch {
        /* storage diblokir */
      }
      return fromHash;
    }
    try {
      return window.localStorage.getItem(mentoringCodeKey(slug)) || '';
    } catch {
      return '';
    }
  });
  const [codeInput, setCodeInput] = useState('');
  const [data, setData] = useState<MentoringLivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveEtag = useRef({ etag: null as string | null });
  const load = useCallback(async () => {
    if (!slug || !code) return false;
    try {
      const polled = await fetchWithEtag(
        `/api/worship/live/${encodeURIComponent(slug)}?code=${encodeURIComponent(code)}`,
        liveEtag.current,
      );
      if (polled.unchanged) return false;
      const r = polled.response;
      const d = polled.data as MentoringLivePayload & { error?: string };
      if (r.status === 401) {
        setError('Kode sesi salah atau sudah dirotasi.');
        setData(null);
        return true;
      }
      if (!r.ok) {
        setError(d?.error || `Gagal memuat (server ${r.status}).`);
        return true;
      }
      setError(null);
      setData(d);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat layar.');
      return true;
    }
  }, [slug, code]);

  useEffect(() => startVisiblePoll(() => load(), 15000, 30000), [load]);

  // Detik berjalan untuk countdown fase + carousel Q (selalu dipanggil — aturan hooks).
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setTick(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  const [qIndex, setQIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setQIndex((i) => i + 1);
    }, 8000);
    return () => window.clearInterval(id);
  }, []);

  const saveCode = () => {
    const value = codeInput.trim().toUpperCase();
    if (!value) return;
    try {
      window.localStorage.setItem(mentoringCodeKey(slug), value);
    } catch {
      /* storage diblokir */
    }
    setCode(value);
    setError(null);
  };

  if (!slug) {
    return (
      <div className="min-h-screen bg-[#111] text-white flex items-center justify-center text-sm">
        Slug sesi tidak ada di tautan.
      </div>
    );
  }

  if (!code) {
    return (
      <div className="min-h-screen bg-[#111] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
          <KeyRound className="w-6 h-6 text-brand" />
          <p className="font-display text-lg font-black">Kode sesi proyektor</p>
          <p className="text-xs text-white/60">Masukkan kode dari panel kontrol Didaskalia untuk menampilkan layar ini.</p>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && saveCode()}
            placeholder="XXXXXX"
            className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-center tracking-[0.3em] font-black text-lg focus:outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={saveCode}
            className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-end py-3 text-xs font-bold uppercase tracking-wider"
          >
            Tampilkan layar
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#111] text-white flex items-center justify-center text-sm">
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Menyiapkan layar…
          </>
        )}
      </div>
    );
  }

  const { session, timer, progress, rooms, wordcloud } = data;
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.submitted / progress.total) * 100)) : 0;
  const patternCode = String(session.pattern?.code || '').toUpperCase();
  const testimony = data.testimony || [];
  const isFilm = patternCode === 'BEDAH_FILM';
  // Finale film: WRAPUP/CLOSED atau sudah ada terundi — layar gabungan
  // (delta + hasil Lesson Learned + nama & grup terundi) sekaligus.
  const filmFinale = isFilm && (session.status === 'WRAPUP' || session.status === 'CLOSED' || testimony.length > 0);
  // MONOLOG: word cloud (Lesson Learned) hanya mengambil alih layar saat WRAPUP/CLOSED —
  // vote awal saat RUNNING tidak boleh menyembunyikan FGD/diskusi.
  const showWordCloud = patternCode === 'MONOLOG'
    ? session.status === 'WRAPUP' || session.status === 'CLOSED'
    : isFilm
      ? filmFinale || wordcloud.length > 0
      : patternCode === 'DEBAT'
        ? wordcloud.length > 0
        : session.status === 'WRAPUP' || wordcloud.length > 0;
  const phaseName = String(data.phase?.name || '').toUpperCase() || null;
  const phaseRemainMs = data.phase?.startedAt
    ? Math.max(0, new Date(data.phase.startedAt).getTime() + Number(data.phase.durationSec) * 1000 - tick)
    : null;
  const phaseExpired = phaseRemainMs !== null && data.phase
    ? Date.now() >= new Date(data.phase.startedAt).getTime() + Number(data.phase.durationSec) * 1000
    : false;
  const PHASE_LABEL: Record<string, string> = {
    F1: 'Sesi 1 · Bedah Lagu',
    F2: 'Sesi 2 · Deep Sharing',
    F3: 'Sesi 3 · Kesaksian',
    CLOSING: 'Konklusi',
  };
  /** Timer fase tampil di layar? Mati = hitung diam-diam (HP peserta tetap melihat). */
  const phaseVisible = data.phase?.showOnScreen !== false;
  const fmtPhase = (ms: number) =>
    `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  const isMonologStandby = patternCode === 'MONOLOG' && !showWordCloud && phaseName !== 'F2';
  /** Label timer langkah film + kartu delta (dipakai blok utama & saat word cloud tampil). */
  const filmStepInfo = isFilm && phaseName ? FILM_STEP_LABELS[phaseName] || null : null;
  const filmMeans = data.likertMeans;
  const filmDeltaCard = filmMeans && (filmMeans.pre.n > 0 || filmMeans.post.n > 0) ? (
    <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">Perubahan setelah film (awal → akhir)</p>
      <p className="font-display text-5xl font-black tabular-nums">
        {filmMeans.pre.avg?.toFixed(1) ?? '–'} <span className="text-white/40 text-3xl">→</span> {filmMeans.post.avg?.toFixed(1) ?? '–'}
        {filmMeans.delta != null && (
          <span className={`ml-3 text-2xl px-3 py-1 rounded-full ${filmMeans.delta > 0 ? 'bg-emerald-400/20 text-emerald-300' : filmMeans.delta < 0 ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white/60'}`}>
            {filmMeans.delta > 0 ? `+${filmMeans.delta}` : filmMeans.delta}
          </span>
        )}
      </p>
      <p className="text-xs text-white/50 mt-2 tabular-nums">dari {filmMeans.pre.n} jawaban awal · {filmMeans.post.n} jawaban akhir</p>
    </section>
  ) : null;

  return (
    <div className="min-h-screen bg-[#111] text-white p-8 sm:p-12 flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">GEHC Youth — Mentoring Day</p>
          <h1 className="font-display text-3xl sm:text-4xl font-black mt-1">{session.title}</h1>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/10">
          {STATUS_LABELS[session.status]}
        </span>
      </header>

      {!showWordCloud && (
        <>
          {isFilm && filmStepInfo && phaseRemainMs !== null && (
            <section className="rounded-[28px] bg-white/5 border border-white/10 p-8 flex items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{filmStepInfo.label}</p>
                <p className="text-sm text-white/60 mt-1">{filmStepInfo.sub}</p>
              </div>
              {phaseVisible ? (
                <p className="font-display text-5xl font-black tabular-nums">
                  {phaseExpired ? '00:00' : fmtPhase(phaseRemainMs)}
                </p>
              ) : (
                <p className="text-sm text-white/50 italic shrink-0">mengalir…</p>
              )}
            </section>
          )}
          {patternCode !== 'MONOLOG' && !isFilm && (
          <section className="rounded-[28px] bg-white/5 border border-white/10 p-8 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Timer className="w-8 h-8 text-brand" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Waktu tersisa</p>
                <SessionTimer timer={timer} size="lg" tone="dark" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Sudah mengisi</p>
              <p className="font-display text-4xl font-black tabular-nums">
                {progress.submitted}
                <span className="text-white/40 text-2xl">/{progress.total}</span>
              </p>
            </div>
          </section>
          )}

          {testimony.length > 0 && <TestimonyWheel picks={testimony} />}

          {patternCode === 'MONOLOG' ? (
            isMonologStandby ? (
              <section className="rounded-[28px] bg-white/5 border border-white/10 p-12 flex-1 flex flex-col items-center justify-center text-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">
                  {phaseName ? PHASE_LABEL[phaseName] : 'Ibadah berlangsung'}
                </p>
                <p className="text-white/50 text-sm max-w-md">Ikuti dari tempat dudukmu — panduan tampil di HP.</p>
              </section>
            ) : null
          ) : rooms.length > 0 ? (
          <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">Alokasi pos</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <div key={room.code} className="rounded-2xl bg-white/5 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand">{room.floorLabel}</p>
                  <p className="font-display text-xl font-black mt-1">{room.label}</p>
                  <p className="text-xs text-white/50 mt-2 tabular-nums">
                    {room.count}{room.capacity > 0 ? `/${room.capacity}` : ''} peserta diarahkan ke sini
                  </p>
                  {room.isFull && (
                    <p className="mt-2 inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">
                      Penuh
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {(() => {
            const rounds = data.rounds;
            const cur = rounds?.rounds?.[rounds?.current || 0];
            if (patternCode === 'DEBAT' && cur) {
              const stepIdx = Math.max(0, Number(rounds?.step) || 0);
              const secTotal = Number(rounds?.stepSeconds) || ROUND_STEP_SECONDS[stepIdx] || 60;
              const showStep = rounds?.stepShowOnScreen !== false;
              const remainMs = rounds?.stepStartedAt
                ? Math.max(0, new Date(rounds.stepStartedAt).getTime() + secTotal * 1000 - tick)
                : secTotal * 1000;
              const teamsCfg = rounds?.teams;
              const trapOn = String(rounds?.phase || '') === 'selesai' || session.status === 'WRAPUP' || session.status === 'CLOSED';
              const fmt = (ms: number) =>
                `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
              return (
                <>
                  <section className="rounded-[28px] bg-white/5 border border-white/10 p-8 flex items-center justify-between gap-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Langkah {stepIdx + 1}/11</p>
                      <p className="font-display text-2xl font-black mt-1">{roundStepLabel(stepIdx)}</p>
                    </div>
                    {showStep ? (
                      <p className="font-display text-5xl font-black tabular-nums">{fmt(remainMs)}</p>
                    ) : (
                      <p className="text-sm text-white/50 italic shrink-0">mengalir…</p>
                    )}
                  </section>

                  <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                      Ronde {(rounds?.current || 0) + 1}/{rounds?.rounds?.length} · {rounds?.phase}
                    </p>
                    <p className="font-display text-2xl font-black">{cur.mosi || 'Mosi menyusul'}</p>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-emerald-400/10 border border-emerald-300/20 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">PRO</p>
                        <p className="font-display text-lg font-black mt-1">{teamsCfg?.pro?.name || 'Tim PRO'}</p>
                        <p className="text-xs text-white/50 mt-1">
                          {[teamsCfg?.pro?.mentor && `Mentor: ${teamsCfg.pro.mentor}`, (teamsCfg?.pro?.members || []).join(', ')].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-rose-400/10 border border-rose-300/20 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300">KONTRA</p>
                        <p className="font-display text-lg font-black mt-1">{teamsCfg?.kontra?.name || 'Tim KONTRA'}</p>
                        <p className="text-xs text-white/50 mt-1">
                          {[teamsCfg?.kontra?.mentor && `Mentor: ${teamsCfg.kontra.mentor}`, (teamsCfg?.kontra?.members || []).join(', ')].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                    <p className="font-display text-4xl font-black mt-4 tabular-nums">
                      <span className="text-emerald-300">{cur.proScore}</span>
                      <span className="text-white/40 text-2xl"> : </span>
                      <span className="text-rose-300">{cur.kontraScore}</span>
                    </p>
                    <p className="text-[11px] text-white/40 mt-1">Skor juri — biblika 40 · logika 30 · teamwork 20 · etika 10</p>
                  </section>

                  {trapOn && (rounds?.trapReveal || '').trim() && (
                    <section className="rounded-[28px] bg-gradient-to-r from-brand/20 to-brand-end/20 border border-brand/30 p-10">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Trap Reveal — dikotomi palsu dibongkar</p>
                      <p className="font-display text-2xl sm:text-3xl font-black mt-3 whitespace-pre-line">{rounds?.trapReveal}</p>
                    </section>
                  )}
                </>
              );
            }
            if (patternCode === 'BEDAH_FILM') {
              // M3 (gate AKHIR dibuka) → panduan Likert Akhir + delta pre→post;
              // sebelum itu kartu tayang; bagian film sendiri tanpa countdown.
              const postOpen = String(data.likertRounds?.post || 'closed').toLowerCase() === 'open';
              if (postOpen) {
                return (
                  <>
                    <section className="rounded-[28px] bg-gradient-to-r from-brand/20 to-brand-end/20 border border-brand/30 p-10 flex flex-col items-center justify-center text-center gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Likert Akhir dibuka</p>
                      <p className="font-display text-2xl sm:text-3xl font-black">Isi 5 pernyataan + Lesson Learned di HP</p>
                      <p className="text-sm text-white/50 max-w-md">Perubahan awal → akhir tampil di sini saat jawaban masuk.</p>
                    </section>
                    {filmDeltaCard}
                  </>
                );
              }
              const screening = data.screening;
              if (screening) {
                const onAir = Boolean(screening.startedAt);
                // Layar tunggu: pre-roll ala bioskop (slide berganti tiap 7 s).
                // Film tayang (onAir): rotasi berhenti — tampilan tenang + nada bioskop.
                if (!onAir) {
                  return (
                    <FilmPreRoll title={screening.title} durationMin={screening.durationMin} customLines={screening.preShow} />
                  );
                }
                return (
                  <section className="rounded-[28px] bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-10 sm:p-14 flex-1 flex flex-col items-center justify-center text-center gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">● Sedang diputar</p>
                    <p className="font-display text-2xl sm:text-3xl font-black mt-1">{screening.title}</p>
                    <p className="font-display text-xl sm:text-2xl font-black text-white/90">
                      Harap tenang, fokus mendengar
                    </p>
                    <p className="text-sm text-white/50 max-w-md">
                      HP tetap boleh dipegang untuk menjawab 3 catatan — jawab jujur, tiap jawaban ada afirmasi firman untukmu.
                    </p>
                    <CinemaToneButton />
                  </section>
                );
              }
              return (
                <section className="rounded-[28px] bg-white/5 border border-white/10 p-10 flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Movie Breakdown</p>
                  <p className="font-display text-2xl sm:text-3xl font-black">Ikuti tayangan film</p>
                  <p className="text-sm text-white/50 max-w-md">
                    HP tetap boleh dipegang untuk menulis 3 catatan — jawab jujur, tiap jawaban ada afirmasi firman untukmu.
                  </p>
                </section>
              );
            }
            if (patternCode === 'MONOLOG') {
              if (phaseName !== 'F2') return null;
              const qs = [...(data.guide || []).filter(Boolean), ...((data.deepGuide || []).filter(Boolean))];
              const words = (data.oneWord || []).slice(0, 12);
              const qi = qs.length ? qIndex % qs.length : 0;
              return (
                <>
                  <section className="rounded-[28px] bg-gradient-to-r from-brand/20 to-brand-end/20 border border-brand/30 p-8 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Diskusi kelompok</p>
                      <p className="text-sm text-white/70 mt-1">Bagikan catatanmu — semua mencatat di HP.</p>
                    </div>
                    {phaseVisible ? (
                      <p className="font-display text-5xl font-black tabular-nums">
                        {phaseRemainMs === null ? '––:––' : phaseExpired ? '00:00' : fmtPhase(phaseRemainMs)}
                      </p>
                    ) : (
                      <p className="text-sm text-white/50 italic shrink-0">mengalir…</p>
                    )}
                  </section>
                  {phaseExpired && (
                    <p className="text-center text-sm font-bold text-amber-300">Waktu habis — menunggu operator membuka fase berikut.</p>
                  )}
                  {qs.length > 0 && (
                    <section className="rounded-[28px] bg-white/5 border border-white/10 p-10 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
                        Pertanyaan {qi + 1}/{qs.length}
                      </p>
                      <p key={qi} className="font-display text-2xl sm:text-3xl font-black leading-snug">{qs[qi]}</p>
                      <div className="flex justify-center gap-1.5 mt-5">
                        {qs.map((_, i) => (
                          <span key={i} className={`h-1.5 rounded-full ${i === qi ? 'w-6 bg-brand' : 'w-1.5 bg-white/20'}`} />
                        ))}
                      </div>
                    </section>
                  )}
                  {words.length > 0 && (
                    <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">Satu Kata jemaat</p>
                      <div className="flex flex-wrap gap-2">
                        {words.map((w, i) => (
                          <span key={i} className="rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-sm font-bold">
                            {w.text} <span className="text-brand tabular-nums">×{w.count}</span>
                          </span>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              );
            }
            const teams = data.teams?.teams || [];
            if (patternCode === 'CREATIVE_LAB' && data.activity) {
              const act = data.activity;
              const jar = data.jarCards || [];
              const brief = data.activityBrief;
              const phase = act.phase;
              const card = jar[act.cardIndex];
              const labTeams = data.lab?.teams || [];
              const order = labPresentationOrder(act, teams.length);
              const keyDirections = data.lab?.keyDirections || brief?.briefing?.projectorDirective || brief?.briefing?.audienceDirective || '';
              const slideTitles = presentSlidePlan(brief).map((s) => s.label);
              const slideMax = Math.max(0, slideTitles.length - 1);
              const presentTeamIndex = order[act.presentIndex] ?? act.presentIndex;
              const presentSlide = Math.min(slideMax, Math.max(0, Math.floor(Number(act.presentSlide) || 0)));
              const presenting = teams[presentTeamIndex];
              const presentingLab = labTeams.find((t) => t.index === presentTeamIndex) || null;
              const stations = labStationCopy(brief);
              const a1Title = brief?.a1.title || 'Sesi 1';
              const a1Sub = brief?.a1.subtitle ? ` · ${brief.a1.subtitle}` : '';
              const a2Title = brief?.a2.title || 'Sesi 2';
              const firmanOnly = briefingFirmanOnly(phase, act.startedAt, tick);
              const totalSec = phase === 'PRESENT' ? act.presentSeconds : act.durationSec;
              const startedAt = phase === 'PRESENT' ? act.presentStartedAt : act.startedAt;
              const remainMs = startedAt
                ? Math.max(0, new Date(startedAt).getTime() + totalSec * 1000 - tick)
                : totalSec * 1000;
              const phaseTitle =
                phase === 'A1' ? `Sesi 1 · ${a1Title}${a1Sub}`
                  : phase === 'A2' ? `Sesi 2 · ${a2Title}`
                    : phase === 'PRESENT' ? 'Presentasi Kelompok'
                      : phase === 'DONE' ? 'Konklusi'
                        : 'Firman & Briefing';
              const phaseSub =
                phase === 'A1' ? `Semua menulis 6 kartu di kertas · pilih 2 untuk web (paralel) · ${brief?.a1.minutes || 15} menit`
                  : phase === 'A2' ? `Stasiun A (${stations.mediaA}) ∥ Stasiun B (${stations.mediaB}) (paralel) · perwakilan melapor ke Admin · ${brief?.a2.minutes || 25} menit`
                    : phase === 'PRESENT' ? `${act.presentSeconds} detik per kelompok · ${slideTitles[presentSlide]}`
                      : phase === 'DONE' ? 'Pilih chip Satu Kata + tulis komitmenmu di HP.'
                        : brief?.briefing.audienceDirective || 'Ikuti layar; undian urutan sudah ditampilkan.';
              return (
                <>
                  <section className="rounded-[28px] bg-white/5 border border-white/10 p-8 flex items-center justify-between gap-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{phaseTitle}</p>
                      <p className="text-sm text-white/60 mt-1">{phaseSub}</p>
                    </div>
                    {act.showOnScreen && phase !== 'DONE' ? (
                      <p className="font-display text-5xl font-black tabular-nums">{fmtPhase(remainMs)}</p>
                    ) : (
                      <p className="text-sm text-white/50 italic shrink-0">{phase === 'DONE' ? 'selesai' : 'mengalir…'}</p>
                    )}
                  </section>

                  {phase === 'DRAW' && order.length > 0 && (
                    <section className="rounded-[28px] bg-white/5 border border-white/10 p-6 sm:p-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Undian urutan presentasi</p>
                      <p className="text-sm text-white/60 mt-1">Nomor grup — nama kelompok tampil di Sesi 2.</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        {order.map((teamIndex, pos) => (
                          <div key={`draw-${teamIndex}-${pos}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Urutan {pos + 1}</p>
                            <p className="font-display text-3xl font-black mt-1">Grup {teamIndex + 1}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {phase === 'IDLE' && brief && (
                    <section className="rounded-[28px] bg-white/5 border border-white/10 p-6 sm:p-8">
                      {firmanOnly ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Firman</p>
                          <p className="font-display text-3xl sm:text-4xl font-black mt-2 leading-tight">{brief.firmanTitle || data.session.title}</p>
                          {brief.firmanPoints && <p className="text-sm text-white/70 mt-3 whitespace-pre-line">{brief.firmanPoints}</p>}
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Perwakilan kelompok</p>
                          <p className="font-display text-2xl sm:text-3xl font-black mt-2 leading-tight">{brief.briefing.scribe}</p>
                        </>
                      )}
                    </section>
                  )}

                  {phase === 'PRESENT' && presenting && (
                    <section className="rounded-[28px] bg-gradient-to-r from-brand/20 to-brand-end/20 border border-brand/30 p-8 sm:p-10">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Sedang presentasi</p>
                        <p className="font-display text-4xl sm:text-5xl font-black mt-2">{presenting.name}</p>
                      </div>
                      <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 mt-4">
                        {presentSlide + 1}/3 · {slideTitles[presentSlide]}
                      </p>
                      {presentingLab ? (
                        <div className="mt-4">
                          {presentSlide === 0 && (
                            <LabSlideArt
                              label={`Stasiun A · ${stations.mediaA}`}
                              meaning={presentingLab.pot.meaning || `Makna ${stations.mediaA} belum diisi.`}
                              photos={presentingLab.pot.photos}
                              tone="emerald"
                            />
                          )}
                          {presentSlide === 1 && (
                            <LabSlideArt
                              label={`Stasiun B · ${stations.mediaB}`}
                              meaning={presentingLab.bag.meaning || `Makna ${stations.mediaB} belum diisi.`}
                              photos={presentingLab.bag.photos}
                              tone="brand"
                            />
                          )}
                          {presentSlide === 2 && (
                            <div className="space-y-4">
                              <div className="h-[68vh] rounded-2xl bg-black/40 border border-white/10 grid place-items-center overflow-hidden">
                                {presentingLab.groupPhoto?.photoUrl ? (
                                  <img src={presentingLab.groupPhoto.photoUrl} alt="Foto bersama" className="max-h-full max-w-full object-contain" />
                                ) : (
                                  <p className="text-sm text-white/50">Foto bersama belum diunggah.</p>
                                )}
                              </div>
                              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Komitmen kelompok</p>
                                <p className="font-display text-2xl sm:text-4xl font-black mt-1.5">{presentingLab.commitment || 'Belum diisi.'}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-white/60 mt-4">Menunggu update karya kelompok…</p>
                      )}
                    </section>
                  )}

                  {act.showOnScreen && (phase === 'A1' || phase === 'A2' || phase === 'IDLE') && (
                    <section className="rounded-[28px] bg-white/5 border border-white/10 p-6 sm:p-8">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                          {phase === 'A1' ? `${a1Title}${a1Sub} — 6 pertanyaan` : 'Kartu jar kelompok'}
                        </p>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand">Tulis 6 di kertas · pilih 2 di web</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {jar.map((c, i) => (
                          <div key={c.code || i} className={`rounded-2xl border p-5 sm:p-6 min-h-[150px] flex flex-col justify-center ${i === act.cardIndex ? 'bg-brand/20 border-brand/40' : 'bg-white/5 border-white/10'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand">Kartu {i + 1}</p>
                            <p className="font-display text-2xl sm:text-3xl font-black mt-1.5 leading-tight">{c.title}</p>
                            {c.direction && <p className="text-sm text-white/60 mt-2 leading-relaxed">{c.direction}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {phase === 'A2' && brief && (
                    <div className="space-y-4">
                      <section className="rounded-[28px] bg-white/5 border border-white/10 p-6 sm:p-8">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Pencatat</p>
                        <p className="font-display text-2xl sm:text-3xl font-black mt-2 leading-tight">{brief.briefing.scribe || 'Umumkan perwakilan pencatat tiap kelompok.'}</p>
                      </section>
                      <section className="rounded-[28px] bg-[#111] border border-brand/40 p-6 sm:p-8 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Instruksi melapor</p>
                        <p className="font-display text-2xl sm:text-3xl font-black mt-2">{brief.a2.report || 'Perwakilan setiap kelompok maju melapor kepada Admin.'}</p>
                        <p className="text-sm text-white/60 mt-2">Bawa hasil karya kedua stasiun, lalu unggah foto bersama seluruh anggota + karya di HP perwakilan.</p>
                      </section>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <section className="rounded-[28px] bg-emerald-400/10 border border-emerald-300/20 p-7 sm:p-8">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Stasiun A · {stations.mediaA} — {stations.themeA}</p>
                          <p className="text-base sm:text-lg text-white/80 mt-2 leading-relaxed">{brief.a2.potMeaning}</p>
                          <p className="text-sm text-emerald-200/80 mt-3"><b>Refleksi:</b> {brief.a2.pot}</p>
                        </section>
                        <section className="rounded-[28px] bg-brand/10 border border-brand/30 p-7 sm:p-8">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Stasiun B · {stations.mediaB} — {stations.themeB}</p>
                          <p className="text-base sm:text-lg text-white/80 mt-2 leading-relaxed">{brief.a2.bagMeaning}</p>
                          <p className="text-sm text-brand/80 mt-3"><b>Refleksi:</b> {brief.a2.bag}</p>
                        </section>
                      </div>
                      <section className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Komitmen kelompok</p>
                        <p className="text-sm text-white/70 mt-1">{brief.a2.commit}</p>
                      </section>
                      {labTeams.length > 0 && (
                        <section className="rounded-[28px] bg-white/5 border border-white/10 p-6 sm:p-8">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Progres Sesi 2 · per kelompok</p>
                            {keyDirections && <p className="text-[10px] text-brand font-bold max-w-md text-right">{keyDirections}</p>}
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {labTeams.map((lt) => (
                              <div key={lt.index} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                                <p className="font-bold truncate">{lt.name}</p>
                                <p className="text-[10px] text-white/50 mt-0.5 tabular-nums">
                                  Progress {lt.progressPct ?? '–'}% · vote-back {lt.voteBackStatus || 'belum'} · rekap {lt.recapStatus || 'belum'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}

                  {(phase === 'A2' || phase === 'PRESENT' || phase === 'DONE') && order.length > 0 && (
                    <section className="rounded-[28px] bg-white/5 border border-white/10 p-6 sm:p-8">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Urutan presentasi hasil undian</p>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand">{order.length} kelompok</span>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {order.map((teamIndex, pos) => (
                          <div key={`${teamIndex}-${pos}`} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${phase === 'PRESENT' && pos === act.presentIndex ? 'bg-brand/20 border-brand/40' : 'bg-white/5 border-white/10'}`}>
                            <span className="w-8 h-8 rounded-full bg-white/10 grid place-items-center font-display text-lg font-black shrink-0">{pos + 1}</span>
                            <span className="font-bold truncate">{phase === 'DRAW' || phase === 'IDLE' ? `Grup ${teamIndex + 1}` : (teams[teamIndex]?.name || `Kelompok ${teamIndex + 1}`)}</span>
                            {phase === 'PRESENT' && pos === act.presentIndex && <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-brand">tampil</span>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {phase === 'DONE' && brief?.closing.script && (
                    <section className="rounded-[28px] bg-gradient-to-r from-brand/20 to-brand-end/20 border border-brand/30 p-10 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand">Konklusi</p>
                      <p className="font-display text-xl sm:text-2xl font-black mt-3 whitespace-pre-line">{brief.closing.script}</p>
                    </section>
                  )}

                  {teams.length > 0 && (
                    <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">
                        Papan kelompok {phase === 'PRESENT' ? '· giliran presentasi' : ''}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teams.map((t, i) => {
                          const lt = labTeams.find((x) => x.index === i);
                          return (
                            <div key={i} className={`rounded-2xl p-5 border ${phase === 'PRESENT' && i === presentTeamIndex ? 'bg-brand/20 border-brand/40' : 'bg-white/5 border-white/10'}`}>
                              <div className="flex items-start gap-2">
                                <p className="font-display text-lg font-black">{t.name} {t.done && '✓'}</p>
                                <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${lt?.done ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>{lt?.done ? 'selesai' : 'proses'}</span>
                              </div>
                              {labDisplayShowsRepNames(phase) && t.repName && <p className="text-[11px] text-white/50 mt-0.5">Perwakilan: {t.repName}</p>}
                              {t.station && <p className="text-[11px] text-white/40 mt-0.5">{t.station}</p>}
                              <p className="text-xs text-white/50 mt-2 tabular-nums">{t.members.length} orang</p>
                              {lt && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-[11px] text-emerald-300/80">{stations.mediaA} {lt.pot.progress ?? 0}% · {stations.mediaB} {lt.bag.progress ?? 0}%</p>
                                  <div className="flex gap-1.5">
                                    {lt.pot.photos[0] && <img src={lt.pot.photos[0].thumbUrl || lt.pot.photos[0].photoUrl || ''} alt={stations.mediaA} className="h-12 w-12 rounded-lg object-cover border border-white/10" />}
                                    {lt.bag.photos[0] && <img src={lt.bag.photos[0].thumbUrl || lt.bag.photos[0].photoUrl || ''} alt={stations.mediaB} className="h-12 w-12 rounded-lg object-cover border border-white/10" />}
                                    {lt.groupPhoto && <img src={lt.groupPhoto.thumbUrl || lt.groupPhoto.photoUrl || ''} alt="Bersama" className="h-12 w-12 rounded-lg object-cover border border-emerald-300/40" />}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              );
            }
            if (patternCode === 'THREE_SEQUENCES' && teams.length > 0) {
              return (
                <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">Papan tim misi</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {teams.map((t, i) => (
                      <div key={i} className="rounded-2xl bg-white/5 p-5">
                        <p className="font-display text-xl font-black">{t.name} {t.done && '✓'}</p>
                        {t.pair?.length ? <p className="text-[11px] text-white/40 mt-1">{t.pair.join(' & ')}</p> : null}
                        {t.task && <p className="text-xs text-white/50 mt-1">{t.task}</p>}
                        {t.roles && <p className="text-[11px] text-white/40 mt-1">{t.roles}</p>}
                        <p className="text-xs text-white/50 mt-2 tabular-nums">{t.members.length} orang</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }
            return null;
          })()}

          <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
            <div className="flex items-center justify-between text-xs text-white/50 mb-3">
              <span>Menunggu peserta mengisi…</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand to-brand-end transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </section>
        </>
      )}

      {showWordCloud && patternCode !== 'MONOLOG' && !filmFinale && (
        isFilm ? (
          <div className="flex flex-col gap-8 flex-1">
            {filmStepInfo && phaseRemainMs !== null && (
              <section className="rounded-[28px] bg-gradient-to-r from-brand/20 to-brand-end/20 border border-brand/30 p-8 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{filmStepInfo.label}</p>
                  <p className="text-sm text-white/70 mt-1">{filmStepInfo.sub}</p>
                </div>
                {phaseVisible ? (
                  <p className="font-display text-5xl font-black tabular-nums">
                    {phaseExpired ? '00:00' : fmtPhase(phaseRemainMs)}
                  </p>
                ) : (
                  <p className="text-sm text-white/50 italic shrink-0">mengalir…</p>
                )}
              </section>
            )}
            {filmDeltaCard}
            <section className="rounded-[28px] bg-white/5 border border-white/10 p-10 flex-1 flex items-center justify-center">
              <WordCloud items={wordcloud} className="text-center" />
            </section>
          </div>
        ) : (
          <section className="rounded-[28px] bg-white/5 border border-white/10 p-10 flex-1 flex items-center justify-center">
            <WordCloud items={wordcloud} className="text-center" />
          </section>
        )
      )}

      {filmFinale && (
        <div className="flex flex-col gap-8 flex-1">
          {filmDeltaCard}
          <section className="rounded-[28px] bg-white/5 border border-white/10 p-10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand mb-4">Lesson Learned jemaat</p>
              <WordCloud items={wordcloud} className="text-center" />
            </div>
          </section>
          {testimony.length > 0 && <TestimonyWheel picks={testimony} />}
        </div>
      )}

      {showWordCloud && patternCode === 'MONOLOG' && (
        <div className="flex flex-col gap-8 flex-1">
          {phaseRemainMs !== null && (phaseName === 'F3' || phaseName === 'CLOSING') && (
            <section className="rounded-[28px] bg-gradient-to-r from-brand/20 to-brand-end/20 border border-brand/30 p-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{PHASE_LABEL[phaseName || ''] || 'Kesaksian'}</p>
                {phaseName === 'CLOSING' && <p className="text-sm text-white/70 mt-1">Terima kasih — sampai jumpa minggu depan.</p>}
              </div>
              {phaseVisible ? (
                <p className="font-display text-5xl font-black tabular-nums">
                  {phaseExpired ? '00:00' : fmtPhase(phaseRemainMs)}
                </p>
              ) : (
                <p className="text-sm text-white/50 italic shrink-0">mengalir…</p>
              )}
            </section>
          )}
          <section className="rounded-[28px] bg-white/5 border border-white/10 p-10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand mb-4">Lesson Learned jemaat</p>
              <WordCloud items={wordcloud} className="text-center" />
            </div>
          </section>
          {testimony.length > 0 && <TestimonyWheel picks={testimony} />}
        </div>
      )}
    </div>
  );
};

export default MentoringScreen;
