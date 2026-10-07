import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, Send } from 'lucide-react';
import { buildInviteCaption } from '../../lib/event-invite-caption';
import { copyText, whatsappShareUrl } from '../../lib/rhb-caption';

export type InviteEvent = {
  id: string;
  name: string;
  eventDate?: string | null;
  venueName?: string | null;
  slug?: string | null;
};

/**
 * Kartu ajakan Koinonia: pilih event → pratinjau caption (bisa disunting)
 * → Salin / Kirim WA. Link bekerja tanpa login.
 */
export const EventInviteCard: React.FC = () => {
  const [events, setEvents] = useState<InviteEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/events', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => { if (!cancelled) setEvents((d.events || []) as InviteEvent[]); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, []);
  const upcoming = useMemo(() => {
    const now = Date.now() - 12 * 3600 * 1000;
    return [...events]
      .filter((e) => e.eventDate && !Number.isNaN(new Date(e.eventDate).getTime()))
      .filter((e) => new Date(e.eventDate as string).getTime() >= now)
      .sort((a, b) => new Date(a.eventDate as string).getTime() - new Date(b.eventDate as string).getTime())
      .slice(0, 12);
  }, [events]);
  const [selectedId, setSelectedId] = useState('');
  const selected = upcoming.find((e) => e.id === selectedId) || upcoming[0] || null;
  // D3: titik jemput carpool dibaca dari Diakonia Logistik (fallback: tanpa baris carpool).
  const [transport, setTransport] = useState<string[]>([]);
  useEffect(() => {
    if (!selected?.id) { setTransport([]); return; }
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(selected.id)}/diakonia/transport`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (!cancelled) setTransport(((d.items || []) as Array<{ pickupPoint: string }>).map((t) => t.pickupPoint)); })
      .catch(() => { if (!cancelled) setTransport([]); });
    return () => { cancelled = true; };
  }, [selected?.id]);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const auto = selected
    ? buildInviteCaption({ eventName: selected.name, eventDate: selected.eventDate, venueName: selected.venueName, slug: selected.slug || selected.id, origin, transport })
    : '';
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? auto;
  const [copied, setCopied] = useState(false);

  if (!upcoming.length) {
    return <p className="text-[11px] text-[#8C8880] italic">Belum ada event mendatang untuk diajak.</p>;
  }

  const onCopy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-[#8C8880]">Event yang diajakkan</span>
        <select
          value={selected?.id || ''}
          onChange={(e) => { setSelectedId(e.target.value); setDraft(null); }}
          className="w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-xs font-bold text-[#1B1B1B]"
        >
          {upcoming.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </label>
      <textarea
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        rows={14}
        className="w-full rounded-2xl border border-[#D9D7D0] bg-[#FAF9F5] p-3 text-xs leading-relaxed text-[#1B1B1B] focus:outline-none focus:border-brand whitespace-pre-wrap"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 text-xs font-black text-white"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Tersalin' : 'Salin'}
        </button>
        <a
          href={whatsappShareUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
        >
          <Send className="w-3.5 h-3.5" /> Kirim WA
        </a>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#8C8880] ml-1">
          <MessageCircle className="w-3.5 h-3.5" /> Link bekerja tanpa login.
        </span>
      </div>
    </div>
  );
};
