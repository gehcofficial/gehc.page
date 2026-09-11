import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Calendar, FileText, BookOpen, Users, Loader2, ExternalLink } from 'lucide-react';
import { EVENT_KINDS, normalizeEventKind } from '../../lib/event-kinds';
import { KegiatanCalendar } from './KegiatanCalendar';
import { useActiveAccess } from '../../hooks/useActiveAccess';

type ServiceEvent = { id: string; slug?: string; name: string; eventDate: string | null; serviceType?: string | null; venueName?: string | null; kind?: string | null; metadata?: unknown };

type DriveFile = { id: string; name: string; webViewLink?: string; mimeType?: string };

function currentPortalNs(fallback: string): string {
  try {
    const h = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    const segs = h.split('/').filter(Boolean);
    if (segs[0] === 'portal' && segs[1] && segs[1] !== 'account') return segs[1];
  } catch { /* abaikan */ }
  return fallback;
}

function nsFromRoles(authUser: unknown): string {
  const r = ((authUser as unknown as { roles?: Array<{ role: string }> })?.roles?.[0]?.role) || 'MENTEE';
  const map: Record<string, string> = { SUPERADMIN: 'superadmin', BPMJ: 'bpmj', KOMISI: 'komisi', COMMITTEE: 'committee', MENTOR: 'mentor', CO_MENTOR: 'co-mentor', MENTEE: 'mentee', ALUMNI: 'alumni' };
  return map[r] || 'mentee';
}

export const IbadahMingguanPanel: React.FC = () => {
  const { authUser } = useApp();
  const portalNs = currentPortalNs(nsFromRoles(authUser));
  const { isPriv, canView01, canView03, canViewInternal, canViewBonding } = useActiveAccess();

  const [allEvents, setAllEvents] = useState<ServiceEvent[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>('UMUM');
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [files01, setFiles01] = useState<DriveFile[]>([]);
  const [files02, setFiles02] = useState<DriveFile[]>([]);
  const [files03, setFiles03] = useState<DriveFile[]>([]);
  const [forbidden01, setForbidden01] = useState(false);
  const [forbidden03, setForbidden03] = useState(false);
  const [subLoading, setSubLoading] = useState(false);

  // Visible kind tabs per role — Internal only for staf
  const visibleKinds = EVENT_KINDS.filter((k) => {
    if (k.id === 'INTERNAL' && !canViewInternal) return false;
    return true;
  });

  useEffect(() => {
    // default kind: UMUM for all, staf can later pick others
    if (!visibleKinds.find((k) => k.id === selectedKind)) setSelectedKind('UMUM');
  }, [canViewInternal]);

  // Load all events, filter by selectedKind
  useEffect(() => {
    setLoading(true);
    fetch('/api/events', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const evs = (d.events || []) as ServiceEvent[];
        // map legacy RECURRING -> REKREASIONAL via normalize
        const mapped = evs.map((e) => ({ ...e, kind: normalizeEventKind(e.kind) }));
        setAllEvents(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const events = allEvents.filter((e) => normalizeEventKind(e.kind) === selectedKind).sort((a, b) => String(a.eventDate || '').localeCompare(String(b.eventDate || ''))).slice(-16);

  useEffect(() => {
    if (!events.length) { setSelectedId(''); return; }
    if (!events.find((e) => e.id === selectedId)) {
      const upcoming = events.find((e) => e.eventDate && new Date(e.eventDate).getTime() >= Date.now() - 24 * 3600 * 1000) || events[events.length - 1];
      setSelectedId(upcoming.id);
    }
  }, [events, selectedId, selectedKind]);

  const fetchSub = useCallback(async (eventId: string, sub: string) => {
    try {
      const r = await fetch(`/api/events/${eventId}/divisions/DIDASKALIA/drive?subfolder=${encodeURIComponent(sub)}&fresh=1`, { credentials: 'include' });
      if (r.status === 403) return { files: [] as DriveFile[], forbidden: true };
      if (!r.ok) return { files: [] as DriveFile[], forbidden: false };
      const d = await r.json();
      return { files: (d.files || []) as DriveFile[], forbidden: false };
    } catch {
      return { files: [] as DriveFile[], forbidden: false };
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (selectedKind !== 'UMUM') return; // only UMUM has 01/02/03
    setSubLoading(true);
    setForbidden01(false); setForbidden03(false);
    Promise.all([
      canView01 ? fetchSub(selectedId, '01 Pembekalan Mentor - Co mentor') : Promise.resolve({ files: [] as DriveFile[], forbidden: !canView01 }),
      fetchSub(selectedId, '02 Ringkasan Khotbah'),
      canView03 ? fetchSub(selectedId, '03 RHB 7 Hari') : Promise.resolve({ files: [] as DriveFile[], forbidden: !canView03 }),
    ]).then(([r01, r02, r03]) => {
      setFiles01(r01.files); setForbidden01(r01.forbidden);
      setFiles02(r02.files);
      setFiles03(r03.files); setForbidden03(r03.forbidden);
    }).finally(() => setSubLoading(false));
  }, [selectedId, selectedKind, canView01, canView03, fetchSub]);

  const selected = allEvents.find((e) => e.id === selectedId) || null;
  const dateLabel = selected?.eventDate ? new Date(selected.eventDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) + ' WIB' : '';

  if (loading) return <div className="py-16 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat kegiatan…</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
          <BookOpen className="w-3.5 h-3.5 text-[#FF416C]" />
          <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">Kegiatan — by event</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">Kegiatan</h2>
        <p className="text-xs sm:text-sm text-[#8C8880] mt-1 leading-relaxed">
          Pilih tanggal di kalender — detail event terpilih tampil di bawah.
        </p>
      </div>

      {/* Kalender + linimasa — semua jenis (warna legenda), Internal hanya staf, bonding grup sendiri */}
      <KegiatanCalendar
        events={allEvents}
        selectedId={selectedId}
        onSelect={(id) => {
          const ev = allEvents.find((e) => e.id === id);
          if (ev) setSelectedKind(normalizeEventKind(ev.kind));
          setSelectedId(id);
        }}
        portalNs={portalNs}
        canViewInternal={canViewInternal}
        canViewBonding={canViewBonding}
      />

      {/* Detail event terpilih — dikendalikan kalender/linimasa di atas (filter + agenda hari) */}

      {/* Selected event header — nama + tanggal + file */}
      {selected && selectedKind === 'UMUM' && (
        <div className="bg-white rounded-[32px] p-6 border border-[#D9D7D0]/50 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-black border ${selected.serviceType === 'MENTORING_DAY' ? 'bg-sky-100 text-sky-700 border-sky-200' : selected.serviceType === 'SERVING_DAY' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {selected.serviceType === 'MENTORING_DAY' ? 'MENTORING' : selected.serviceType === 'SERVING_DAY' ? 'SERVING' : 'Event'} — {selected.name}
              </span>
              {dateLabel && <p className="text-xs font-bold text-[#1B1B1B] mt-2 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{dateLabel}</p>}
              {selected.venueName && <p className="text-xs text-[#8C8880]">{selected.venueName}</p>}
            </div>
            <span className="text-[10px] text-[#8C8880]">Parent: {selected.name}</span>
          </div>

          {subLoading ? (
            <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat file by event…</p>
          ) : (
            (() => {
              // Kartu yang tampil mengikuti topeng aktif — 01 tidak dirender sama sekali untuk mentee.
              // Nomor dinamis 1..n sesuai kartu yang terlihat (kode folder Drive tetap di caption).
              const show01 = canView01 && !forbidden01;
              const show03 = canView03 && !forbidden03;
              const cards = [
                ...(show01 ? [{
                  folder: '01 Pembekalan Mentor - Co mentor',
                  title: 'Pembekalan Mentor - Co mentor',
                  desc: 'Hanya Mentor/Co-mentor',
                  empty: `Belum ada file untuk ${selected.name} — upload di Panel Divisi → Didaskalia → Ibadah → 01.`,
                  files: files01,
                  box: 'rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2',
                  titleCls: 'text-xs font-black text-amber-800',
                  descCls: 'text-[11px] text-amber-700',
                  emptyCls: 'text-[11px] text-amber-600 italic',
                }] : []),
                {
                  folder: '02 Ringkasan Khotbah',
                  title: 'Ringkasan Khotbah',
                  desc: 'Semua pemuda',
                  empty: `Belum ada ringkasan untuk ${selected.name}.`,
                  files: files02,
                  box: 'rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-2',
                  titleCls: 'text-xs font-black text-sky-800',
                  descCls: 'text-[11px] text-sky-700',
                  emptyCls: 'text-[11px] text-sky-600 italic',
                },
                ...(show03 ? [{
                  folder: '03 RHB 7 Hari',
                  title: 'RHB 7 Hari',
                  desc: 'Beyonders — Senin–Sabtu',
                  empty: `Belum ada RHB untuk ${selected.name} — akan muncul 7 PDF.`,
                  files: files03,
                  box: 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2',
                  titleCls: 'text-xs font-black text-emerald-800',
                  descCls: 'text-[11px] text-emerald-700',
                  emptyCls: 'text-[11px] text-emerald-600 italic',
                }] : []),
              ];
              const gridCls = cards.length <= 1 ? 'grid gap-4 md:grid-cols-1' : cards.length === 2 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4 md:grid-cols-3';
              return (
                <div className={gridCls}>
                  {cards.map((c, i) => (
                    <div key={c.folder} className={c.box}>
                      <p className={c.titleCls}>{i + 1}. {c.title}</p>
                      <p className={c.descCls}>{c.desc} — by event <span className="font-bold">{selected.name}</span></p>
                      {c.files.length ? (
                        <ul className="space-y-1">
                          {c.files.map((f) => (
                            <li key={f.id}><a href={f.webViewLink || '#'} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-700 hover:underline flex items-center gap-1"><FileText className="w-3 h-3" /> {f.name}</a></li>
                          ))}
                        </ul>
                      ) : (
                        <p className={c.emptyCls}>{c.empty}</p>
                      )}
                      <p className="text-[10px] text-[#8C8880]/70">Folder: {c.folder}</p>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
          <div className="pt-3 border-t border-[#D9D7D0]/50 flex flex-wrap gap-2 text-[11px]">
            <a href={`#/portal/${portalNs}/groups-monitoring?event=${encodeURIComponent(selected.slug || selected.id)}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] font-bold hover:bg-white"><Users className="w-3 h-3" /> Isi Monitoring Kelompok</a>
            <a href={`#/portal/${portalNs}/event-info?event=${encodeURIComponent(selected.slug || selected.id)}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 font-bold text-sky-700 hover:bg-sky-100"><ExternalLink className="w-3 h-3" /> Info Event — {selected.name.slice(0, 24)}</a>
          </div>
        </div>
      )}
      {selected && selectedKind !== 'UMUM' && (
        <div className="bg-white rounded-[32px] p-6 border border-[#D9D7D0]/50 shadow-sm space-y-3">
          <p className="text-xs font-black text-[#1B1B1B]">{selected.name} — {visibleKinds.find((k)=>k.id===selectedKind)?.label}</p>
          {dateLabel && <p className="text-[11px] text-[#8C8880]">{dateLabel} {selected.venueName ? `· ${selected.venueName}` : ''}</p>}
          <p className="text-xs text-[#8C8880] leading-relaxed">{visibleKinds.find((k)=>k.id===selectedKind)?.tooltip}</p>
          <p className="text-[11px] text-[#8C8880] italic">File untuk jenis ini dikelola di Panel Divisi / Program & Event — akan muncul di sini setelah upload by event.</p>
          <div className="pt-2 flex flex-wrap gap-2">
            <a href={`#/portal/${portalNs}/event-info?event=${encodeURIComponent(selected.slug || selected.id)}`} className="text-[11px] font-bold text-sky-700 hover:underline">Info Event — {selected.name.slice(0, 22)} →</a>
            <a href={`#/portal/${portalNs}/events`} className="text-[11px] font-bold text-[#8C8880] hover:underline">Program & Event →</a>
          </div>
        </div>
      )}
    </div>
  );
};
