import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ClipboardList, LayoutGrid, Loader2, MessageSquare, MonitorPlay, Users } from 'lucide-react';
import { parseHashSearch } from '../../lib/portal-routes';
import { BodPanelTab, parseBodPanelTab } from '../../lib/bod-panel-access';
import { EventPenatalayanPanel } from './EventPenatalayanPanel';
import { PenatalayanBoard } from './PenatalayanBoard';
import { PenatalayanBodLinkPanel } from './PenatalayanBodLinkPanel';
import { PolaSesiPanel } from './PolaSesiPanel';
import { ControlRoomPanel } from './ControlRoomPanel';
import { useOriginWeek } from '../../hooks/useOriginWeek';

type WorshipEvent = { id: string; name: string; date: string; serviceType?: string | null };

const TAB_META: { id: BodPanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'penatalayan', label: 'Penatalayan', icon: Users },
  { id: 'antrean', label: 'Antrean', icon: ClipboardList },
  { id: 'caption', label: 'Caption WA', icon: MessageSquare },
  { id: 'rundown', label: 'Rundown', icon: LayoutGrid },
  { id: 'sesi', label: 'Sesi Hari-H', icon: MonitorPlay },
];

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const BodYouthPanel: React.FC = () => {
  const hashTab = useMemo(() => parseBodPanelTab(parseHashSearch().get('tab')), []);
  const hashToken = useMemo(() => String(parseHashSearch().get('token') || '').trim(), []);
  const [tab, setTab] = useState<BodPanelTab>(hashTab);
  const [events, setEvents] = useState<WorshipEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventId, setEventId] = useState('');
  const [linkToken, setLinkToken] = useState(hashToken);
  const [caption, setCaption] = useState<string | null>(null);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [captionMsg, setCaptionMsg] = useState<string | null>(null);

  const selected = useMemo(() => events.find((e) => e.id === eventId) || null, [events, eventId]);
  const eventDate = selected?.date ? String(selected.date).slice(0, 10) : '';
  const { ym, weekIndex, loading: weekLoading } = useOriginWeek(eventDate || undefined);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const from = isoDaysFromNow(-14);
      const to = isoDaysFromNow(90);
      const r = await fetch(`/api/penatalayan/board?from=${from}&to=${to}`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      const list: WorshipEvent[] = (d.events || []).map((e: WorshipEvent) => ({
        id: String(e.id),
        name: String(e.name || 'Event'),
        date: String(e.date || '').slice(0, 10),
        serviceType: e.serviceType,
      }));
      setEvents(list);
      setEventId((prev) => prev || (list[0]?.id ? String(list[0].id) : ''));
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  useEffect(() => {
    if (!hashToken) return;
    setLinkToken(hashToken);
    setTab('penatalayan');
  }, [hashToken]);

  const ensureLinkToken = useCallback(async (): Promise<string | null> => {
    if (linkToken) return linkToken;
    if (!eventId) return null;
    const r = await fetch('/api/penatalayan/bod-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, refreshGroups: true }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Gagal membuat tautan.');
    const tok = String(d.link?.token || '');
    if (tok) setLinkToken(tok);
    return tok || null;
  }, [eventId, linkToken]);

  const loadCaption = useCallback(async () => {
    setCaptionBusy(true);
    setCaptionMsg(null);
    try {
      const tok = await ensureLinkToken();
      if (!tok) throw new Error('Pilih event ibadah terlebih dahulu.');
      const r = await fetch(`/api/penatalayan/bod-links/token/${encodeURIComponent(tok)}/caption`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal memuat caption.');
      setCaption(String(d.caption || ''));
      setCaptionMsg('Caption siap disalin.');
    } catch (e) {
      setCaption(null);
      setCaptionMsg(e instanceof Error ? e.message : 'Gagal memuat caption.');
    } finally {
      setCaptionBusy(false);
    }
  }, [ensureLinkToken]);

  useEffect(() => {
    if (tab === 'caption') void loadCaption();
  }, [tab, eventId]);

  const eventPicker = (
    <div className="rounded-2xl border border-[#D9D7D0]/60 bg-[#FAF9F5] p-3 space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-[#8C8880] flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" /> Event ibadah
      </label>
      {eventsLoading ? (
        <p className="text-[11px] text-[#8C8880] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat…</p>
      ) : (
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setLinkToken('');
            setCaption(null);
          }}
          className="w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-[12px] font-semibold text-[#1B1B1B]"
        >
          {events.length === 0 && <option value="">— Tidak ada event —</option>}
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.date} · {ev.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <header className="space-y-1">
        <h2 className="text-lg font-black text-[#1B1B1B]">Panel BOD</h2>
        <p className="text-[11px] text-[#8C8880]">
          Tim Kerja Youth — penatalayan, antrean divisi, rundown lengkap, dan kontrol sesi hari-H.
        </p>
      </header>

      <nav className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" aria-label="Tab Panel BOD">
        {TAB_META.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors ${
              tab === id
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-[#5C5850] border-[#D9D7D0]/80 hover:border-[#1B1B1B]/30'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {tab !== 'antrean' && eventPicker}

      {tab === 'penatalayan' && (
        <div className="space-y-4">
          {eventId && <EventPenatalayanPanel eventId={eventId} canEdit />}
          {linkToken ? (
            <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880] mb-2">Board tautan aktif</p>
              <PenatalayanBodLinkPanel tokenOverride={linkToken} />
            </div>
          ) : (
            <p className="text-[11px] text-[#8C8880]">Buat tautan di atas untuk membuka board pengisian per role.</p>
          )}
        </div>
      )}

      {tab === 'antrean' && (
        <div className="space-y-2">
          <p className="text-[11px] text-[#8C8880]">Antrean minta divisi dan jadwal lintas divisi (28 hari ke depan).</p>
          <PenatalayanBoard />
        </div>
      )}

      {tab === 'caption' && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={captionBusy || !eventId}
              onClick={() => void loadCaption()}
              className="px-3 py-1.5 rounded-xl bg-brand text-white text-[11px] font-bold disabled:opacity-40"
            >
              {captionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Muat / perbarui caption'}
            </button>
            {caption && (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(caption)}
                className="px-3 py-1.5 rounded-xl border border-[#D9D7D0] text-[11px] font-bold"
              >
                Salin ke clipboard
              </button>
            )}
          </div>
          {captionMsg && <p className="text-[11px] text-[#5C5850]">{captionMsg}</p>}
          {caption && (
            <pre className="text-[10px] whitespace-pre-wrap max-h-64 overflow-auto bg-[#FAF9F5] rounded-xl p-3 border border-[#D9D7D0]/60">{caption}</pre>
          )}
        </div>
      )}

      {tab === 'rundown' && eventDate && ym && (
        <PolaSesiPanel yearMonth={ym} weekIndex={weekIndex} eventName={selected?.name} initialSub="katalog" weekLoading={weekLoading} />
      )}
      {tab === 'rundown' && !eventDate && (
        <p className="text-[11px] text-[#8C8880]">Pilih event dengan tanggal ibadah untuk rundown lengkap.</p>
      )}

      {tab === 'sesi' && eventId && eventDate && (
        <div className="space-y-4">
          {ym ? (
            <PolaSesiPanel yearMonth={ym} weekIndex={weekIndex} eventName={selected?.name} initialSub="kontrol" weekLoading={weekLoading} />
          ) : (
            <p className="text-[11px] text-[#8C8880]">Memuat pekan liturgi…</p>
          )}
          <ControlRoomPanel eventId={eventId} eventDate={eventDate} />
        </div>
      )}
      {tab === 'sesi' && !eventId && (
        <p className="text-[11px] text-[#8C8880]">Pilih event untuk briefing, undian, dan kontrol sesi.</p>
      )}
    </div>
  );
};
