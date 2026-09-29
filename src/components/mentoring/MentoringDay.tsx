import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, MapPin, Send, Sparkles, Timer } from 'lucide-react';
import {
  SCALE_LABELS,
  STATUS_LABELS,
  parseMentoringHash,
  type MentoringSessionPayload,
} from '../../lib/mentoring';
import SessionTimer from './SessionTimer';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';

type LikertDraft = Record<string, number>;

const MentoringDay: React.FC = () => {
  const route = useMemo(() => parseMentoringHash(typeof window !== 'undefined' ? window.location.hash : ''), []);
  const slug = route?.slug || '';

  const [data, setData] = useState<MentoringSessionPayload | null>(null);
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error' | 'auth'; message?: string }>({
    status: 'loading',
  });
  const [draft, setDraft] = useState<LikertDraft>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [chipDone, setChipDone] = useState(false);

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
      const d = await r.json();
      if (!r.ok) {
        setState({ status: 'error', message: d?.error || `Gagal memuat (server ${r.status}).` });
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
      setNote('Jawaban tersimpan. Arahkan ke pos sesuai topik prioritasmu.');
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal mengirim jawaban.');
    } finally {
      setBusy(false);
    }
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

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center text-sm text-[#8C8880]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat sesi mentoring…
      </div>
    );
  }
  if (state.status === 'auth') return null;
  if (state.status === 'error' || !data) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
        <div className={`${CARD} max-w-md text-sm text-red-600`}>{state.message || 'Sesi tidak ditemukan.'}</div>
      </div>
    );
  }

  const { session, likert, chips, myResult, rooms, timer } = data;
  const itemsByTopic = session.topics.map((t) => ({
    topic: t,
    items: likert.items.filter((i) => i.topicCode === t.code),
  }));
  const showChips = chips.open || chipDone;
  const activeRooms = rooms.filter((r) => r.count > 0 || r.total > 0);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B] pb-24">
      <header className="sticky top-0 z-30 apple-glass border-b border-[#D9D7D0]/60">
        <div className="max-w-[900px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Mentoring Day</p>
            <h1 className="font-display text-sm sm:text-base font-black truncate">{session.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand/10 text-brand">
              {STATUS_LABELS[session.status]}
            </span>
            {session.status === 'RUNNING' && (
              <span className="inline-flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-brand" />
                <SessionTimer timer={timer} />
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-4 pt-6 space-y-4">
        {session.status === 'DRAFT' && (
          <div className={`${CARD} text-center py-12`}>
            <Clock className="w-8 h-8 text-brand mx-auto" />
            <p className="font-display text-xl font-black mt-4">Menunggu panitia</p>
            <p className="text-sm text-[#8C8880] mt-2">
              Form akan terbuka otomatis begitu panitia menekan “Buka Akses Likert”. Layar ini menyegarkan sendiri.
            </p>
          </div>
        )}

        {session.status === 'CLOSED' && (
          <div className={`${CARD} text-center py-12`}>
            <Sparkles className="w-8 h-8 text-brand mx-auto" />
            <p className="font-display text-xl font-black mt-4">Sesi selesai</p>
            <p className="text-sm text-[#8C8880] mt-2">Terima kasih sudah bertumbuh bersama hari ini.</p>
          </div>
        )}

        {(session.status === 'LIKERT_OPEN' || session.status === 'RUNNING') && !likert.answered && (
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

        {myResult && !showChips && (
          <div className={`${CARD} space-y-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">Topik prioritas kamu</p>
            <div className="rounded-2xl bg-gradient-to-r from-brand to-brand-end text-white p-5">
              <p className="font-display text-2xl font-black">{myResult.topicLabel}</p>
              <p className="text-xs text-white/80 mt-1 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Silakan menuju {myResult.floorLabel}
              </p>
            </div>
            {activeRooms.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-[#8C8880] mb-2">Peta ruangan hari ini</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {rooms.map((room) => (
                    <div key={room.code} className="rounded-xl border border-[#EFEDE8] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#BDBAB2]">{room.floorLabel}</p>
                      <p className="text-sm font-bold mt-1">{room.label}</p>
                    </div>
                  ))}
                </div>
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

        {(session.status === 'RUNNING' || session.status === 'WRAPUP') && likert.answered && (
          <div className={`${CARD} space-y-3`}>
            <p className="font-display text-lg font-black">Catatan pribadimu</p>
            <p className="text-xs text-[#8C8880]">
              Bebas berpindah pos kapan saja jika pertanyaanmu sudah terjawab. Gunakan catatan ini saat berkonsultasi
              dengan PIC.
            </p>
            <ul className="space-y-2">
              {likert.items.map((item) => (
                <li key={item.id} className="rounded-xl border border-[#EFEDE8] p-3">
                  <p className="text-xs text-[#8C8880]">{item.text}</p>
                  <p className="text-sm font-bold mt-1">
                    Jawabanmu: {likert.myValues[item.id] ?? '—'}/5
                  </p>
                  {item.gospelNote && <p className="text-[11px] text-brand mt-1">Koneksi Injil: {item.gospelNote}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showChips && (
          <div className={`${CARD} space-y-4`}>
            {chipDone ? (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-brand mx-auto" />
                <p className="font-display text-xl font-black mt-4">Thank you!</p>
                <p className="text-sm text-[#8C8880] mt-2">Lihat layar utama di depan.</p>
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
          </div>
        )}

        {note && <p className="text-xs text-[#8C8880] text-center">{note}</p>}
      </main>
    </div>
  );
};

export default MentoringDay;
