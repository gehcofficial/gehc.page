import React, { useEffect, useMemo, useState } from 'react';
import { Cake, CalendarDays, Copy, Eye, EyeOff, HandHeart, ListOrdered, Printer } from 'lucide-react';
import { displayAvatar } from '../../lib/avatar';
import { copyText, formatBirthdayList, formatDayShort, prayerKindLabel, printText } from '../../lib/mask';

export type CalEvent = {
  id: string;
  slug?: string | null;
  name: string;
  kind?: string | null;
  serviceType?: string | null;
  eventDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  venueName?: string | null;
};

type Bonding = {
  id: string;
  title: string;
  occurredOn: string;
  location?: string | null;
  groupId: string;
  groupName: string;
  status?: string | null;
};

export type Birthday = {
  id: string;
  name: string;
  avatar?: string | null;
  birthDate: string;
  date: string;
  day: number;
  age?: number | null;
};

/** Konteks doa yang boleh dilihat pengguna (sudah tersaring izin di server). */
export type Prayer = {
  id: string;
  kind: string;
  note?: string | null;
  occurredOn?: string | null;
  isExpired?: boolean;
  isGeneral?: boolean;
  prayedCount?: number;
  lastPrayedOn?: string | null;
  subject?: { id: string | null; name: string } | null;
  subjectName?: string | null;
};

export const KIND_COLORS: Record<string, { dot: string; text: string; chip: string }> = {
  UMUM: { dot: 'bg-sky-500', text: 'text-sky-700', chip: 'bg-sky-100 text-sky-800 border-sky-200' },
  KHUSUS: { dot: 'bg-[#FF416C]', text: 'text-[#FF416C]', chip: 'bg-rose-100 text-rose-800 border-rose-200' },
  INTERNAL: { dot: 'bg-amber-500', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-800 border-amber-200' },
  REKREASIONAL: { dot: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  BONDING: { dot: 'bg-violet-500', text: 'text-violet-700', chip: 'bg-violet-100 text-violet-800 border-violet-200' },
  BIRTHDAY: { dot: 'bg-pink-500', text: 'text-pink-700', chip: 'bg-pink-100 text-pink-800 border-pink-200' },
};

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function toDay(iso?: string | null): string | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const KegiatanCalendar: React.FC<{
  events: CalEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Klik baris event → redirect ke Info Event event tsb. */
  onOpenEvent?: (id: string) => void;
  portalNs: string;
  canViewInternal: boolean;
  canViewBonding: boolean;
}> = ({ events, selectedId, onSelect, onOpenEvent, portalNs, canViewInternal, canViewBonding }) => {
  const [month, setMonth] = useState<string>(() => todayStr().slice(0, 7));
  const [mode, setMode] = useState<'kalender' | 'linimasa'>('kalender');
  const [kindFilter, setKindFilter] = useState<string>('SEMUA');
  const [showBonding, setShowBonding] = useState(true);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [hideBirthdayDetail, setHideBirthdayDetail] = useState(false);
  const [showPrayer, setShowPrayer] = useState(true);
  const [daySel, setDaySel] = useState<string>(() => todayStr());
  const [bonding, setBonding] = useState<Bonding[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [flash, setFlash] = useState('');

  const flashMsg = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 2500);
  };

  const kinds = useMemo(() => {
    const base = ['UMUM', 'KHUSUS', 'INTERNAL', 'REKREASIONAL'];
    return base.filter((k) => k !== 'INTERNAL' || canViewInternal);
  }, [canViewInternal]);

  useEffect(() => {
    if (kindFilter !== 'SEMUA' && !kinds.includes(kindFilter)) setKindFilter('SEMUA');
  }, [kinds, kindFilter]);

  // Bonding grup sendiri (server filter own-group) per bulan tampil
  useEffect(() => {
    if (!canViewBonding || !showBonding) { setBonding([]); return; }
    fetch(`/api/groups/albums?month=${month}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { albums: [] }))
      .then((d) => setBonding((d.albums || []).filter((a: Bonding) => (a.status || 'RENCANA') !== 'BATAL')))
      .catch(() => setBonding([]));
  }, [month, showBonding, canViewBonding]);

  // Ulang tahun jemaat (semua jemaat aktif) per bulan tampil
  useEffect(() => {
    if (!showBirthdays) { setBirthdays([]); return; }
    fetch(`/api/portal/birthdays?month=${month}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { birthdays: [] }))
      .then((d) => setBirthdays(d.birthdays || []))
      .catch(() => setBirthdays([]));
  }, [month, showBirthdays]);

  // Konteks doa yang boleh dilihat pengguna (server menyaring sesuai izin).
  useEffect(() => {
    if (!showPrayer) { setPrayers([]); return; }
    fetch(`/api/pastoral-care?status=OPEN&expired=include&month=${month}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((d) => setPrayers(d.notes || []))
      .catch(() => setPrayers([]));
  }, [month, showPrayer]);

  const dated = useMemo(() => {
    return events
      .filter((e) => {
        const k = String(e.kind || 'KHUSUS').toUpperCase();
        if (k === 'INTERNAL' && !canViewInternal) return false;
        if (kindFilter !== 'SEMUA' && k !== kindFilter) return false;
        return toDay(e.eventDate);
      })
      .map((e) => ({ e, day: toDay(e.eventDate) as string }));
  }, [events, kindFilter, canViewInternal]);

  const planning = useMemo(() => {
    return events.filter((e) => {
      const k = String(e.kind || 'KHUSUS').toUpperCase();
      if (k === 'INTERNAL' && !canViewInternal) return false;
      if (kindFilter !== 'SEMUA' && k !== kindFilter) return false;
      return !toDay(e.eventDate);
    });
  }, [events, kindFilter, canViewInternal]);

  const byDay = useMemo(() => {
    const m = new Map<string, typeof dated>();
    for (const d of dated) {
      const arr = m.get(d.day) || [];
      arr.push(d);
      m.set(d.day, arr);
    }
    return m;
  }, [dated]);

  const bondingByDay = useMemo(() => {
    const m = new Map<string, Bonding[]>();
    for (const b of bonding) {
      const day = toDay(b.occurredOn);
      if (!day) continue;
      const arr = m.get(day) || [];
      arr.push(b);
      m.set(day, arr);
    }
    return m;
  }, [bonding]);

  const birthdayByDay = useMemo(() => {
    const m = new Map<string, Birthday[]>();
    for (const bd of birthdays) {
      const day = toDay(bd.date);
      if (!day) continue;
      const arr = m.get(day) || [];
      arr.push(bd);
      m.set(day, arr);
    }
    return m;
  }, [birthdays]);

  const prayerByDay = useMemo(() => {
    const m = new Map<string, Prayer[]>();
    for (const p of prayers) {
      const day = toDay(p.occurredOn);
      if (!day) continue;
      const arr = m.get(day) || [];
      arr.push(p);
      m.set(day, arr);
    }
    return m;
  }, [prayers]);

  const [y, mo] = month.split('-').map(Number);
  const firstOffset = (new Date(y, mo - 1, 1).getDay() + 6) % 7; // Senin=0
  const daysInMonth = new Date(y, mo, 0).getDate();
  const cells: Array<string | null> = [...Array(firstOffset).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMonth = (delta: number) => {
    const d = new Date(y, mo - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Klik tanggal → pilih event hari itu agar detail di bawah ikut berganti (utamakan UMUM).
  const selectDay = (day: string) => {
    setDaySel(day);
    const evs = byDay.get(day) || [];
    if (!evs.length) return;
    const pick = evs.find(({ e }) => String(e.kind || 'KHUSUS').toUpperCase() === 'UMUM') || evs[0];
    onSelect(pick.e.id);
  };

  const dayItems = [
    ...(byDay.get(daySel) || []),
    ...(bondingByDay.get(daySel) || []).map((b) => ({ b })),
    ...(birthdayByDay.get(daySel) || []).map((bd) => ({ bd })),
    ...(prayerByDay.get(daySel) || []).map((p) => ({ p })),
  ];

  const monthBirthdayText = useMemo(() => formatBirthdayList(
    birthdays.map((b) => ({ name: b.name, day: b.day, age: b.age })),
    {
      title: 'ULANG TAHUN JEMAAT',
      monthLabel: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      hideDetail: hideBirthdayDetail,
    },
  ), [birthdays, month, hideBirthdayDetail]);

  const onCopyBirthdays = async () => {
    const ok = await copyText(monthBirthdayText);
    flashMsg(ok ? 'Teks ulang tahun disalin' : 'Clipboard diblokir');
  };

  // Linimasa (Gantt-lite): window 90 hari dari awal bulan tampil
  const winStart = new Date(`${month}-01T00:00:00.000Z`).getTime();
  const winLen = 90 * 24 * 3600 * 1000;
  const spanRows = useMemo(() => {
    return events
      .filter((e) => {
        const k = String(e.kind || 'KHUSUS').toUpperCase();
        if (k === 'INTERNAL' && !canViewInternal) return false;
        if (kindFilter !== 'SEMUA' && k !== kindFilter) return false;
        return (e.startDate && e.endDate) || e.eventDate;
      })
      .map((e) => {
        const k = String(e.kind || 'KHUSUS').toUpperCase();
        const s = e.startDate && e.endDate ? new Date(e.startDate).getTime() : new Date(e.eventDate as string).getTime();
        const en = e.startDate && e.endDate ? new Date(e.endDate).getTime() : s + 24 * 3600 * 1000;
        const left = Math.max(0, Math.min(100, ((s - winStart) / winLen) * 100));
        const right = Math.max(0, Math.min(100, ((en - winStart) / winLen) * 100));
        return { e, k, left, width: Math.max(1.5, right - left), visible: right > 0 && left < 100 };
      })
      .filter((r) => r.visible)
      .slice(0, 40);
  }, [events, kindFilter, canViewInternal, month]);

  return (
    <div className="bg-white rounded-[32px] p-4 sm:p-6 border border-[#D9D7D0]/50 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMode('kalender')} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border ${mode === 'kalender' ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}>
            <CalendarDays className="w-3.5 h-3.5" /> Kalender
          </button>
          <button type="button" onClick={() => setMode('linimasa')} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border ${mode === 'linimasa' ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}>
            <ListOrdered className="w-3.5 h-3.5" /> Linimasa
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} className="px-2.5 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold">‹</button>
          <span className="text-xs font-black min-w-[7rem] text-center">{new Date(`${month}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          <button type="button" onClick={() => shiftMonth(1)} className="px-2.5 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold">›</button>
        </div>
      </div>

      {/* Legenda + filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setKindFilter('SEMUA')}
          title="Tampilkan semua jenis kegiatan"
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${kindFilter === 'SEMUA' ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
        >
          Semua
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(kindFilter === k ? 'SEMUA' : k)}
            title={k === 'UMUM' ? 'Ibadah rutin mingguan' : k === 'KHUSUS' ? 'Kegiatan tematik musiman' : k === 'INTERNAL' ? 'Hanya staf' : 'Komunitas minat berulang'}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${kindFilter === k ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#1B1B1B] border-[#D9D7D0]'}`}
          >
            <span className={`w-2 h-2 rounded-full ${KIND_COLORS[k].dot}`} />
            {k === 'REKREASIONAL' ? 'Rekreasional' : k.charAt(0) + k.slice(1).toLowerCase()}
          </button>
        ))}
        {canViewBonding && (
          <button
            type="button"
            onClick={() => setShowBonding((v) => !v)}
            title="Bonding kelompok sendiri (usul mentee → approve mentor → otomatis selesai saat berfoto)"
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${showBonding ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            Bonding Kelompok
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowPrayer((v) => !v)}
          title="Konteks doa yang boleh Anda lihat (Portal Doa)"
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${showPrayer ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
        >
          <HandHeart className="w-3.5 h-3.5" />
          Doa
        </button>
        <button
          type="button"
          onClick={() => setShowBirthdays((v) => !v)}
          title="Ulang tahun jemaat (semua jemaat aktif)"
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${showBirthdays ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-[#8C8880] border-[#D9D7D0]'}`}
        >
          <Cake className="w-3.5 h-3.5" />
          Ulang Tahun
        </button>
      </div>

      {flash && (
        <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">{flash}</p>
      )}

      {mode === 'kalender' ? (
        <>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAY_NAMES.map((d) => (
              <p key={d} className="text-[10px] font-black uppercase text-[#8C8880] py-1">{d}</p>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const evs = byDay.get(day) || [];
              const bds = bondingByDay.get(day) || [];
              const cakes = birthdayByDay.get(day) || [];
              const doas = prayerByDay.get(day) || [];
              const total = evs.length + bds.length + cakes.length + doas.length;
              const isToday = day === todayStr();
              const isSel = day === daySel;
              const inMonth = day.startsWith(month);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`min-h-[3.2rem] rounded-xl border p-1 text-left transition-all ${isSel ? 'border-[#181818] ring-2 ring-[#181818]/20 bg-white' : 'border-[#D9D7D0]/60 bg-[#FAF9F5] hover:bg-white'} ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <span className="flex items-center justify-between">
                    <span className={`text-[11px] font-black inline-flex items-center justify-center w-5 h-5 rounded-full ${isToday ? 'bg-[#FF416C] text-white' : 'text-[#1B1B1B]'}`}>{Number(day.slice(8))}</span>
                    <span className="flex items-center gap-0.5">
                      {doas.length > 0 && <HandHeart title="Ada konteks doa" className="w-3 h-3 text-indigo-500" />}
                      {cakes.length > 0 && <Cake title="Ada ulang tahun" className="w-3 h-3 text-pink-500" />}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-0.5 mt-1">
                    {evs.slice(0, 3).map(({ e }) => (
                      <span key={e.id} title={e.name} className={`w-2 h-2 rounded-full ${KIND_COLORS[String(e.kind || 'KHUSUS').toUpperCase()]?.dot || 'bg-gray-400'}`} />
                    ))}
                    {bds.slice(0, 3).map((b) => (
                      <span key={b.id} title={`${b.title} · ${b.groupName}`} className="w-2 h-2 rounded-full bg-violet-500" />
                    ))}
                    {doas.slice(0, 3).map((c) => (
                      <span key={c.id} title={`Doa: ${c.isGeneral ? 'Umum' : (c.subject?.name || c.subjectName)}`} className="w-2 h-2 rounded-full bg-indigo-500" />
                    ))}
                    {cakes.slice(0, 3).map((c) => (
                      <span key={c.id} title={`🎂 ${c.name}${typeof c.age === 'number' ? ` · ${c.age} th` : ''}`} className="w-2 h-2 rounded-full bg-pink-500" />
                    ))}
                    {total > 3 && <span className="text-[9px] font-bold text-[#8C8880]">+{total - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Agenda hari terpilih */}
          <div className="rounded-2xl border border-[#D9D7D0]/60 bg-[#FAF9F5] p-3 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#8C8880]">
              Agenda {new Date(`${daySel}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            {dayItems.length === 0 && <p className="text-xs text-[#8C8880] italic">Tidak ada kegiatan hari ini.</p>}
            {dayItems.map((it: { e?: CalEvent; b?: Bonding; bd?: Birthday; p?: Prayer }, idx: number) => {
              if (it.p) {
                const p = it.p;
                return (
                  <div key={`p${p.id}`} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-indigo-200">
                    <HandHeart className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1B1B1B] truncate">
                        {p.isGeneral ? 'Doa umum' : (p.subject?.name || p.subjectName || '—')}
                        <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-indigo-700">{prayerKindLabel(p.kind)}</span>
                      </p>
                      <p className="text-[10px] text-[#8C8880] truncate">
                        {p.note}
                        {p.prayedCount ? ` · terakhir didoakan ${formatDayShort(p.lastPrayedOn)}` : ' · belum pernah didoakan'}
                      </p>
                    </div>
                  </div>
                );
              }
              if (it.bd) {
                const bd = it.bd;
                return (
                  <div key={`bd${bd.id}`} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-pink-200">
                    <span className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {bd.avatar
                        ? <img src={displayAvatar(bd.name, bd.avatar)} alt="" className="w-full h-full object-cover" />
                        : <Cake className="w-3.5 h-3.5 text-pink-600" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1B1B1B] truncate">🎂 {bd.name}</p>
                      <p className="text-[10px] text-[#8C8880]">Ulang tahun{typeof bd.age === 'number' ? ` · ${bd.age} th` : ''}</p>
                    </div>
                  </div>
                );
              }
              if (it.b) {
                const b = it.b;
                const st = b.status || 'RENCANA';
                return (
                  <div key={`b${b.id}`} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-violet-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1B1B1B] truncate">{b.title}</p>
                      <p className="text-[10px] text-[#8C8880]">{b.groupName}{b.location ? ` · ${b.location}` : ''} · {st === 'USULAN' ? 'Usulan — menunggu mentor' : st === 'SELESAI' ? 'Selesai ✓' : 'Rencana'}</p>
                    </div>
                  </div>
                );
              }
              const e = (it as { e: CalEvent }).e;
              const k = String(e.kind || 'KHUSUS').toUpperCase();
              const active = e.id === selectedId;
              return (
                <button
                  key={e.id + idx}
                  type="button"
                  onClick={() => onSelect(e.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-xl border text-left ${active ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white border-[#D9D7D0] hover:border-[#181818]'}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${KIND_COLORS[k]?.dot || 'bg-gray-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs font-bold truncate ${active ? '' : 'text-[#1B1B1B]'}`}>{e.name}</span>
                    <span className={`block text-[10px] ${active ? 'text-white/70' : 'text-[#8C8880]'}`}>{k === 'REKREASIONAL' ? 'Rekreasional' : k.charAt(0) + k.slice(1).toLowerCase()}{e.venueName ? ` · ${e.venueName}` : ''}</span>
                  </span>
                  <a
                    href={`#/portal/${portalNs}/event-info?event=${encodeURIComponent(e.slug || e.id)}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className={`text-[10px] font-bold shrink-0 ${active ? 'text-white underline' : 'text-sky-700 hover:underline'}`}
                  >
                    Info →
                  </a>
                </button>
              );
            })}
          </div>

          {/* Ibadah Minggu pada hari terpilih → pintasan Doa Minggu */}
          {(() => {
            const umums = (byDay.get(daySel) || []).filter(({ e }) => String(e.kind || '').toUpperCase() === 'UMUM');
            if (!umums.length) return null;
            const active = prayers.filter((p) => (p.occurredOn || '') <= daySel);
            return (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-2.5 flex flex-wrap items-center gap-2">
                <HandHeart className="w-4 h-4 text-indigo-600 shrink-0" />
                <p className="text-[11px] font-bold text-indigo-800">
                  Konteks doa aktif: {active.length}
                  <span className="font-normal text-indigo-700"> · {umums[0].e.name}</span>
                </p>
                <a
                  href={`#/portal/${portalNs}/pastoral-care`}
                  className="ml-auto text-[11px] font-bold text-indigo-700 underline"
                >
                  Buka Doa Minggu →
                </a>
              </div>
            );
          })()}
        </>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-[#8C8880]">Linimasa 90 hari dari {new Date(`${month}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} — rentang program (INTERNAL/Khusus) sebagai bar, ibadah harian sebagai tonggak.</p>
          {spanRows.length === 0 && <p className="text-xs text-[#8C8880] italic">Tidak ada rentang di window ini.</p>}
          {spanRows.map(({ e, k, left, width }) => (
            <button key={e.id} type="button" onClick={() => (onOpenEvent ? onOpenEvent(e.id) : onSelect(e.id))} className="w-full text-left">
              <span className="block text-[11px] font-bold text-[#1B1B1B] truncate">{e.name}</span>
              <span className="block h-4 rounded-full bg-[#F3F1EC] relative overflow-hidden">
                <span
                  title={`${e.name} — ${k}`}
                  className={`absolute top-1 bottom-1 rounded-full ${KIND_COLORS[k]?.dot || 'bg-gray-400'}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Ulang tahun bulan ini — semua jemaat aktif */}
      {showBirthdays && birthdays.length > 0 && (
        <div className="rounded-2xl border border-pink-200 bg-pink-50/50 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-pink-700 flex items-center gap-1.5">
              <Cake className="w-3.5 h-3.5" /> Ulang tahun bulan ini ({birthdays.length})
            </p>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHideBirthdayDetail((v) => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-pink-200 text-[10px] font-bold text-pink-700"
              >
                {hideBirthdayDetail ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {hideBirthdayDetail ? 'Detail disembunyikan' : 'Sembunyikan detail'}
              </button>
              <button
                type="button"
                onClick={onCopyBirthdays}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-pink-200 text-[10px] font-bold text-pink-700"
              >
                <Copy className="w-3 h-3" /> Salin
              </button>
              <button
                type="button"
                onClick={() => printText(`Ulang Tahun ${month}`, monthBirthdayText)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-pink-200 text-[10px] font-bold text-pink-700"
              >
                <Printer className="w-3 h-3" /> Cetak
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {birthdays.map((bd) => (
              <button
                key={bd.id}
                type="button"
                onClick={() => setDaySel(bd.date)}
                title={`${bd.name}${typeof bd.age === 'number' ? ` · ${bd.age} th` : ''}`}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-white border border-pink-100 text-left hover:border-pink-300"
              >
                {hideBirthdayDetail
                  ? <Cake className="w-7 h-7 p-1.5 rounded-full bg-pink-100 text-pink-600 shrink-0" />
                  : <img src={displayAvatar(bd.name, bd.avatar)} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />}
                <span className="text-xs font-bold text-[#1B1B1B] truncate">
                  {hideBirthdayDetail ? bd.name.trim().split(/\s+/)[0] : bd.name}
                </span>
                <span className="ml-auto text-[10px] font-bold text-pink-700 shrink-0">
                  {bd.day}{!hideBirthdayDetail && typeof bd.age === 'number' ? ` · ${bd.age} th` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Konteks doa bulan ini — sudah tersaring izin oleh server */}
      {showPrayer && prayers.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
            <HandHeart className="w-3.5 h-3.5" /> Konteks doa bulan ini ({prayers.length})
          </p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {prayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => p.occurredOn && setDaySel(p.occurredOn)}
                title={p.note || ''}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-white border border-indigo-100 text-left hover:border-indigo-300"
              >
                <HandHeart className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-[#1B1B1B] truncate">
                    {p.isGeneral ? 'Doa umum' : (p.subject?.name || p.subjectName || '—')}
                  </span>
                  <span className="block text-[10px] text-[#8C8880] truncate">
                    {prayerKindLabel(p.kind)}
                    {p.isExpired ? ' · kedaluwarsa' : ''}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-indigo-700 shrink-0">{formatDayShort(p.occurredOn)}</span>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* PLANNING tanpa tanggal — disabled + note (keputusan) */}
      {planning.length > 0 && (
        <div className="rounded-2xl border border-dashed border-[#D9D7D0] p-3 space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#8C8880]">Jadwal menyusul ({planning.length})</p>
          {planning.slice(0, 8).map((e) => (
            <p key={e.id} title="Jadwal & lokasi menyusul — panitia melengkapi di Program & Event." className="text-xs text-[#8C8880]">
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${KIND_COLORS[String(e.kind || 'KHUSUS').toUpperCase()]?.dot || 'bg-gray-400'}`} />
              {e.name} — <span className="italic">jadwal menyusul</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
