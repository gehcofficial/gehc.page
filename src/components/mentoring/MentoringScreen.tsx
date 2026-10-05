import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Timer } from 'lucide-react';
import {
  STATUS_LABELS,
  mentoringCodeKey,
  parseMentoringHash,
  type MentoringLivePayload,
} from '../../lib/mentoring';
import SessionTimer from './SessionTimer';
import { TestimonyWheel } from './TestimonyWheel';
import WordCloud from './WordCloud';

const MentoringScreen: React.FC = () => {
  const route = parseMentoringHash(typeof window !== 'undefined' ? window.location.hash : '');
  const slug = route?.slug || '';

  const [code, setCode] = useState(() => {
    if (typeof window === 'undefined' || !slug) return '';
    try {
      return window.localStorage.getItem(mentoringCodeKey(slug)) || '';
    } catch {
      return '';
    }
  });
  const [codeInput, setCodeInput] = useState('');
  const [data, setData] = useState<MentoringLivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug || !code) return;
    try {
      const r = await fetch(`/api/worship/live/${encodeURIComponent(slug)}?code=${encodeURIComponent(code)}`, {
        cache: 'no-store',
      });
      if (r.status === 401) {
        setError('Kode sesi salah atau sudah dirotasi.');
        setData(null);
        return;
      }
      const d = await r.json();
      if (!r.ok) {
        setError(d?.error || `Gagal memuat (server ${r.status}).`);
        return;
      }
      setError(null);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat layar.');
    }
  }, [slug, code]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
  }, [load]);

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
  const showWordCloud = session.status === 'WRAPUP' || wordcloud.length > 0;
  const patternCode = String(session.pattern?.code || '').toUpperCase();
  const testimony = data.testimony || [];
  const guide = data.guide || [];

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

          {testimony.length > 0 && <TestimonyWheel picks={testimony} />}

          {patternCode === 'MONOLOG' ? (
            <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">Panduan FGD</p>
              <ol className="space-y-2">
                {guide.filter(Boolean).map((g, i) => (
                  <li key={i} className="text-lg font-bold">
                    <span className="text-brand mr-2">Q{i + 1}.</span>
                    {g}
                  </li>
                ))}
              </ol>
            </section>
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
              return (
                <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                    Ronde {(rounds?.current || 0) + 1}/{rounds?.rounds?.length} · {rounds?.phase}
                  </p>
                  <p className="font-display text-2xl font-black">{cur.mosi}</p>
                  <p className="text-sm text-white/60 mt-2">
                    PRO: {cur.pro || '-'} · KONTRA: {cur.kontra || '-'}
                  </p>
                  <p className="font-display text-4xl font-black mt-3 tabular-nums">
                    {cur.proScore} <span className="text-white/40 text-2xl">:</span> {cur.kontraScore}
                  </p>
                </section>
              );
            }
            const screening = data.screening;
            if (patternCode === 'BEDAH_FILM' && screening) {
              const remain = screening.startedAt
                ? Math.max(0, new Date(screening.startedAt).getTime() + screening.durationMin * 60000 - Date.now())
                : null;
              const mm = remain === null ? '--' : String(Math.floor(remain / 60000)).padStart(2, '0');
              const ss = remain === null ? '--' : String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');
              return (
                <section className="rounded-[28px] bg-white/5 border border-white/10 p-8 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Sedang diputar</p>
                    <p className="font-display text-2xl font-black mt-1">{screening.title}</p>
                  </div>
                  <p className="font-display text-5xl font-black tabular-nums">{mm}:{ss}</p>
                </section>
              );
            }
            const teams = data.teams?.teams || [];
            if (patternCode === 'THREE_SEQUENCES' && teams.length > 0) {
              return (
                <section className="rounded-[28px] bg-white/5 border border-white/10 p-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">Papan tim misi</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {teams.map((t, i) => (
                      <div key={i} className="rounded-2xl bg-white/5 p-5">
                        <p className="font-display text-xl font-black">{t.name} {t.done && '✓'}</p>
                        {t.task && <p className="text-xs text-white/50 mt-1">{t.task}</p>}
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

      {showWordCloud && (
        <section className="rounded-[28px] bg-white/5 border border-white/10 p-10 flex-1 flex items-center justify-center">
          <WordCloud items={wordcloud} className="text-center" />
        </section>
      )}
    </div>
  );
};

export default MentoringScreen;
