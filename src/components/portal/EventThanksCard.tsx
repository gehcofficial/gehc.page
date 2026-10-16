import React, { useEffect, useState } from 'react';
import { Check, Copy, HeartHandshake, Send } from 'lucide-react';
import { buildThanksCaption } from '../../lib/arsip-caption';
import { copyText, whatsappShareUrl } from '../../lib/rhb-caption';
import { fmtArsipDate, type ArsipEvent } from '../public/ArsipIbadah';

/**
 * Kartu caption terima kasih Koinonia (tab Syukur): pilih event arsip →
 * pratinjau caption (bisa disunting) → Salin / Kirim WA.
 * Cermin EventInviteCard (pra-event) untuk pasca-event.
 */
export const EventThanksCard: React.FC = () => {
  const [events, setEvents] = useState<ArsipEvent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [caption, setCaption] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/events/public-archive')
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => { if (!cancelled) setEvents((d.events || []) as ArsipEvent[]); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, []);

  const selected = events.find((e) => e.id === selectedId) || events[0] || null;

  useEffect(() => {
    if (!selected) { setCaption(null); return; }
    let cancelled = false;
    setLoading(true);
    setCaption(null);
    (async () => {
      try {
        const day = String(selected.date || '').slice(0, 10);
        const [sched, ring] = await Promise.all([
          day
            ? fetch(`/api/db/service-schedule?from=${day}&to=${day}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
            : null,
          selected.ringkasan
            ? fetch(`/api/ibadah/ringkasan/${selected.ringkasan.ym}/${selected.ringkasan.week}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
            : null,
        ]);
        if (cancelled) return;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setCaption(
          buildThanksCaption({
            eventName: selected.name,
            eventDateLabel: fmtArsipDate(selected.date),
            eventId: selected.id,
            host: sched?.serving?.[day]?.host || null,
            responsible: sched?.serving?.[day]?.responsible || null,
            verseRef: ring?.teksUtama?.ref || null,
            bigIdea: ring?.bigIdea || null,
            origin,
          }),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected?.id]);

  if (!events.length) {
    return <p className="text-[11px] text-[#8C8880] italic">Belum ada arsip ibadah untuk dibuatkan caption.</p>;
  }

  const onCopy = async () => {
    if (!caption) return;
    const ok = await copyText(caption);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-[#8C8880]">Event arsip</span>
        <select
          value={selected?.id || ''}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-xs font-bold text-[#1B1B1B]"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </label>
      {loading ? (
        <p className="text-[11px] text-[#8C8880]">Menyusun caption…</p>
      ) : caption !== null ? (
        <>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-xs leading-relaxed focus:outline-none focus:border-brand"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onCopy()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Tersalin' : 'Salin'}
            </button>
            <a
              href={whatsappShareUrl(caption)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              <Send className="w-3.5 h-3.5" /> Bagikan WA
            </a>
          </div>
        </>
      ) : null}
      <p className="text-[10px] text-[#8C8880] flex items-center gap-1">
        <HeartHandshake className="w-3 h-3" /> Caption otomatis dari tuan rumah, penanggung jawab & ringkasan — sunting dulu bila perlu.
      </p>
    </div>
  );
};
