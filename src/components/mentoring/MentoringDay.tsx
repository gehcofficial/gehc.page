import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Download,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  NotebookPen,
  Send,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  SCALE_LABELS,
  STATUS_LABELS,
  canOpenSegment,
  orderedRoute,
  parseMentoringHash,
  segmentFor,
  type MentoringSessionPayload,
  type SegmentId,
} from '../../lib/mentoring';
import { buildMentoringRecapPdf, downloadBlob } from '../../lib/mentoringPdf';
import SessionTimer from './SessionTimer';
import SegmentStepper from './SegmentStepper';
import { PatternDay } from './PatternDay';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const TEXTAREA =
  'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-brand';

const MentoringDay: React.FC = () => {
  const route = useMemo(
    () => parseMentoringHash(typeof window !== 'undefined' ? window.location.hash : ''),
    [],
  );
  const slug = route?.slug || '';

  const [data, setData] = useState<MentoringSessionPayload | null>(null);
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error' | 'auth'; message?: string }>({
    status: 'loading',
  });
  const [segment, setSegment] = useState<SegmentId>('likert');
  const [visited, setVisited] = useState<SegmentId[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [chipDone, setChipDone] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const noteTimer = useRef<number | null>(null);
  const pendingNotes = useRef<Record<string, string>>({});
  const autoJumped = useRef<SegmentId | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      setState({ status: 'error', message: 'Slug sesi tidak ada di tautan.' });
      return;
    }
    try {
      const r = await fetch(`/api/worship/session/${encodeURIComponent(slug)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (r.status === 401) {
        window.location.hash = `#/login?next=${encodeURIComponent(`#/mentoring/${slug}`)}`;
        setState({ status: 'auth' });
        return;
      }
      const d: MentoringSessionPayload = await r.json();
      if (!r.ok) {
        setState({ status: 'error', message: (d as unknown as { error?: string })?.error || 'Gagal memuat.' });
        return;
      }
      setData(d);
      setDraft((prev) => {
        const next = { ...prev };
        for (const item of d.likert?.items || []) {
          if (next[item.id] === undefined) next[item.id] = d.likert?.myValues?.[item.id] ?? 3;
        }
        return next;
      });
      setNoteDraft((prev) => ({ ...d.notes, ...prev }));
      setPicked((prev) => (prev.length ? prev : d.chips?.mine || []));
      setState({ status: 'ok' });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal memuat.' });
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(
    () => () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    },
    [],
  );

  const status = data?.session.status || 'DRAFT';
  const answered = Boolean(data?.likert.answered);

  // Ikuti transisi maju dari server sekali per tahap (tanpa menarik user mundur).
  useEffect(() => {
    const target = segmentFor(status, answered);
    if (autoJumped.current === target) return;
    const order: SegmentId[] = ['likert', 'arah', 'kunjungan', 'lesson'];
    if (order.indexOf(target) > order.indexOf(segment)) {
      autoJumped.current = target;
      setSegment(target);
      window.scrollTo({ top: 0 });
    }
  }, [status, answered, segment]);

  useEffect(() => {
    if (!visited.includes(segment)) setVisited((v) => [...v, segment]);
  }, [segment, visited]);

  const submitLikert = async () => {
    if (!data) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch('/api/worship/likert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, answers: draft }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal mengirim jawaban.');
      await load();
      setSegment('arah');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal mengirim jawaban.');
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = useCallback(
    async (entries: Record<string, string>) => {
      const payload = Object.entries(entries).map(([topicCode, content]) => ({ topicCode, content }));
      if (!payload.length) return;
      try {
        const r = await fetch('/api/worship/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ slug, notes: payload }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.error || 'Gagal menyimpan catatan.');
        }
        setSavedAt(new Date().toLocaleTimeString('id-ID'));
      } catch (e) {
        setNote(e instanceof Error ? e.message : 'Gagal menyimpan catatan.');
      }
    },
    [slug],
  );

  const onNoteChange = (topicCode: string, value: string) => {
    setNoteDraft((prev) => ({ ...prev, [topicCode]: value }));
    pendingNotes.current[topicCode] = value;
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      const batch = pendingNotes.current;
      pendingNotes.current = {};
      void saveNotes(batch);
    }, 800);
  };

  const submitChips = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch('/api/worship/chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, codes: picked }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal mengirim chip.');
      setChipDone(true);
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal mengirim chip.');
    } finally {
      setBusy(false);
    }
  };

  const toggleChip = (code: string) => {
    if (!data) return;
    const limit = data.session.chipLimit || 3;
    setPicked((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= limit) return prev;
      return [...prev, code];
    });
  };

  const downloadPdf = () => {
    if (!data) return;
    const chipLabels = data.chips.list.filter((c) => picked.includes(c.code));
    const { filename, blob } = buildMentoringRecapPdf({
      session: data.session,
      participantName: data.me?.name || 'Peserta',
      values: data.likert.myValues,
      items: data.likert.items,
      notes: noteDraft,
      chips: chipLabels,
      result: data.myResult,
      rooms: data.rooms,
    });
    downloadBlob(filename, blob);
  };

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center text-sm text-[#8C8880]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat sesi mentoring…
      </div>
    );
  }
  if (state.status === 'auth') return null;
  // Pola non-post-to-post memakai alur generik (fondasi session-engine).
  const patternCode = String(data?.session.pattern?.code || '').toUpperCase();
  if (state.status === 'ok' && data && patternCode && patternCode !== 'POST_TO_POST') {
    return (
      <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] pb-24">
        <div className="max-w-[900px] mx-auto px-4 py-4">
          <PatternDay slug={slug} code={patternCode} />
        </div>
      </div>
    );
  }
  if (state.status === 'error' || !data) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
        <div className={`${CARD} max-w-md text-sm text-red-600`}>{state.message || 'Sesi tidak ditemukan.'}</div>
      </div>
    );
  }

  const { session, likert, chips, myResult, rooms, timer, progress } = data;
  const itemsByTopic = session.topics.map((t) => ({
    topic: t,
    items: likert.items.filter((i) => i.topicCode === t.code),
  }));
  const activeRooms = orderedRoute(rooms);
  const showChips = (chips.open && segment !== 'likert') || chipDone || segment === 'lesson';
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.submitted / progress.total) * 100)) : 0;
  const doneSegments: SegmentId[] = [
    ...(answered ? (['likert'] as SegmentId[]) : []),
    ...(visited.includes('arah') && answered ? (['arah'] as SegmentId[]) : []),
    ...(visited.includes('kunjungan') && ['RUNNING', 'WRAPUP', 'CLOSED'].includes(status)
      ? (['kunjungan'] as SegmentId[])
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] pb-24">
      <header className="sticky top-0 z-30 apple-glass border-b border-[#D9D7D0]/60">
        <div className="max-w-[900px] mx-auto px-4 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Mentoring Day</p>
              <h1 className="font-display text-sm sm:text-base font-black truncate">{session.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {status === 'RUNNING' && (
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-brand" />
                  <SessionTimer timer={timer} />
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand/10 text-brand">
                {STATUS_LABELS[status]}
              </span>
            </div>
          </div>
          <SegmentStepper
            active={segment}
            done={doneSegments}
            status={status}
            answered={answered}
            onSelect={(s) => {
              if (!canOpenSegment(s, status, answered)) return;
              setSegment(s);
              window.scrollTo({ top: 0 });
            }}
          />
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-4 pt-5 space-y-4">
        {segment === 'likert' && (
          <>
            {status === 'DRAFT' && (
              <div className={`${CARD} text-center py-10`}>
                <Clock className="w-8 h-8 text-brand mx-auto" />
                <p className="font-display text-xl font-black mt-4">Menunggu panitia</p>
                <p className="text-sm text-[#8C8880] mt-2">
                  Form akan terbuka otomatis begitu panitia menekan “Buka Akses Likert”.
                </p>
              </div>
            )}
            {status === 'CLOSED' && (
              <div className={`${CARD} text-center py-10`}>
                <Sparkles className="w-8 h-8 text-brand mx-auto" />
                <p className="font-display text-xl font-black mt-4">Sesi selesai</p>
                <p className="text-sm text-[#8C8880] mt-2">Terima kasih sudah bertumbuh bersama hari ini.</p>
              </div>
            )}
            {['LIKERT_OPEN', 'RUNNING'].includes(status) && !answered && (
              <div className={`${CARD} space-y-5`}>
                <div>
                  <p className="font-display text-lg font-black">Skala Likert</p>
                  <p className="text-xs text-[#8C8880] mt-1">
                    Jawab jujur 1–5 untuk setiap pernyataan. Hasilnya menentukan topik prioritas & posmu hari ini.
                  </p>
                </div>
                {itemsByTopic.map(({ topic, items }) => (
                  <div key={topic.code} className="rounded-xl border border-[#EFEDE8] p-3 space-y-4">
                    <p className="text-xs font-black text-brand uppercase tracking-wider">{topic.label}</p>
                    {items.map((item) => (
                      <div key={item.id} className="space-y-2">
                        <p className="text-sm leading-relaxed">{item.text}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={5}
                            step={1}
                            value={draft[item.id] ?? 3}
                            onChange={(e) => setDraft((d) => ({ ...d, [item.id]: Number(e.target.value) }))}
                            className="flex-1 accent-brand"
                          />
                          <span className="w-8 text-center text-sm font-black tabular-nums text-brand">
                            {draft[item.id] ?? 3}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#BDBAB2]">{SCALE_LABELS[(draft[item.id] ?? 3) - 1]}</p>
                      </div>
                    ))}
                  </div>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitLikert()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-brand to-brand-end text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Kirim jawaban
                </button>
              </div>
            )}
          </>
        )}

        {segment === 'arah' && myResult && (
          <div className={`${CARD} space-y-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">Topik prioritas kamu</p>
            <div className="rounded-2xl bg-gradient-to-r from-brand to-brand-end text-white p-5">
              <p className="font-display text-2xl font-black">{myResult.topicLabel}</p>
              <p className="text-xs text-white/85 mt-1 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Silakan menuju {myResult.floorLabel}
              </p>
              {myResult.venue && myResult.venue.capacity > 0 && (
                <p className="text-[11px] text-white/70 mt-1">Daya tampung pos: {myResult.venue.capacity} orang</p>
              )}
            </div>

            {status === 'LIKERT_OPEN' && (
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
                <p className="text-sm font-bold">Sudah mengisi: {progress.submitted}/{progress.total}</p>
                <div className="mt-2 h-2 rounded-full bg-white overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand to-brand-end transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-[#8C8880] mt-2">
                  Menunggu aba-aba panitia untuk mulai berkunjung (sesi 20 menit dimulai oleh admin).
                </p>
              </div>
            )}

            {activeRooms.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8C8880] mb-2">Rute kunjungan (berurutan)</p>
                <div className="space-y-2">
                  {activeRooms.map((room, idx) => (
                    <div
                      key={room.code}
                      className={`rounded-xl border p-3 flex items-center gap-3 ${
                        room.code === myResult.topicCode ? 'border-brand bg-brand/5' : 'border-[#EFEDE8]'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full bg-brand/10 text-brand text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#BDBAB2]">
                          {room.floorLabel}
                        </p>
                        <p className="text-sm font-bold truncate">{room.label}</p>
                      </div>
                      <span className="ml-auto text-[11px] text-[#8C8880] tabular-nums">
                        {room.count}{room.capacity > 0 ? `/${room.capacity}` : ''} peserta
                      </span>
                      {room.isFull && (
                        <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Penuh
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#8C8880] mt-2 inline-flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Jika concern-mu sudah terjawab di lantai ini, kamu bebas lanjut ke lantai prioritas topik
                  berikutnya sesuai urutan di atas.
                </p>
              </div>
            )}

            {myResult.affirmations.length > 0 && (
              <div className="rounded-xl bg-brand/5 border border-brand/20 p-3">
                {myResult.affirmations.map((a, i) => (
                  <p key={i} className="text-sm text-[#1B1B1B]/80">
                    {a}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {segment === 'kunjungan' && (
          <div className={`${CARD} space-y-4`}>
            <div className="flex flex-wrap items-center gap-3">
              <Timer className="w-5 h-5 text-brand" />
              <SessionTimer timer={timer} size="lg" />
              <span className="text-xs text-[#8C8880] ml-auto">
                {savedAt ? `Catatan tersimpan ${savedAt}` : 'Catatan tersimpan otomatis'}
              </span>
            </div>

            {myResult && (
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-sm">
                Prioritasmu: <strong>{myResult.topicLabel}</strong> — {myResult.floorLabel}. Bebas pindah pos kapan
                saja bila pertanyaanmu sudah terjawab.
              </div>
            )}

            <div className="space-y-3">
              {activeRooms.map((room) => (
                <div key={room.code} className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-brand" />
                    <p className="text-xs font-black">
                      {room.floorLabel} — {room.label}
                    </p>
                  </div>
                  <textarea
                    className={TEXTAREA}
                    rows={3}
                    placeholder="Tulis catatan / pertanyaanmu di pos ini…"
                    value={noteDraft[room.code] || ''}
                    onChange={(e) => onNoteChange(room.code, e.target.value)}
                  />
                </div>
              ))}
              <div className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <NotebookPen className="w-3.5 h-3.5 text-brand" />
                  <p className="text-xs font-black">Kesimpulan / doa</p>
                </div>
                <textarea
                  className={TEXTAREA}
                  rows={3}
                  placeholder="Apa yang Tuhan ajarkan hari ini?"
                  value={noteDraft.KESIMPULAN || ''}
                  onChange={(e) => onNoteChange('KESIMPULAN', e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={downloadPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#D9D7D0] text-xs font-bold uppercase tracking-wider hover:bg-white"
            >
              <Download className="w-3.5 h-3.5" /> Unduh PDF rekap
            </button>
          </div>
        )}

        {segment === 'lesson' && (
          <div className={`${CARD} space-y-4`}>
            {showChips && chipDone ? (
              <div className="text-center py-6 space-y-3">
                <Sparkles className="w-8 h-8 text-brand mx-auto" />
                <p className="font-display text-xl font-black">Thank you!</p>
                <p className="text-sm text-[#8C8880]">Lihat layar utama di depan.</p>
                {(myResult?.affirmations || []).slice(0, 1).map((a, i) => (
                  <p key={i} className="text-sm text-brand font-bold max-w-md mx-auto">
                    {a}
                  </p>
                ))}
              </div>
            ) : (
              <>
                <div>
                  <p className="font-display text-lg font-black">Lesson Learned</p>
                  <p className="text-xs text-[#8C8880] mt-1">
                    Pilih maksimal {session.chipLimit} kata yang paling mewakili aha-moment kamu hari ini.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chips.list.map((chip) => {
                    const active = picked.includes(chip.code);
                    return (
                      <button
                        key={chip.code}
                        type="button"
                        onClick={() => toggleChip(chip.code)}
                        className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                          active
                            ? 'bg-gradient-to-r from-brand to-brand-end text-white border-transparent'
                            : 'bg-white text-[#8C8880] border-[#D9D7D0] hover:border-brand'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={busy || !picked.length}
                  onClick={() => void submitChips()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B1B1B] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Kirim ({picked.length}/{session.chipLimit})
                </button>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFEDE8]">
              <a
                href={`#/mentoring/${session.slug}/layar`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-brand to-brand-end text-white text-xs font-bold uppercase tracking-wider"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Lihat layar utama
              </a>
              <button
                type="button"
                onClick={downloadPdf}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#D9D7D0] text-xs font-bold uppercase tracking-wider hover:bg-white"
              >
                <Download className="w-3.5 h-3.5" /> Unduh PDF rekap
              </button>
            </div>
          </div>
        )}

        {note && <p className="text-xs text-[#8C8880] text-center">{note}</p>}
      </main>
    </div>
  );
};

export default MentoringDay;
