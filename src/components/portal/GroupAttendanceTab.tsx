import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, Users } from 'lucide-react';
import { nearestUpcoming } from '../../lib/event-select';

type MemberRow = {
  memberId: string;
  userId?: string | null;
  name: string;
  familyRole?: string | null;
  present: boolean;
  source?: string | null;
  canMark: boolean;
};

type GroupRow = {
  id: string;
  name: string;
  present: number;
  total: number;
  members: MemberRow[];
};

type EventOption = { id: string; name: string; status?: string | null; eventDate?: string | null; startDate?: string | null };

const SOURCE_LABEL: Record<string, string> = {
  scan: 'Scan QR',
  otomatis: 'Otomatis (petugas)',
  manual: 'Manual',
};

/**
 * Absensi Grup — mentor/co-mentor menandai kehadiran anggota grup binaannya.
 * Penandaan = check-in resmi (OK). Di luar grup sendiri ditolak server (403).
 */
export const GroupAttendanceTab: React.FC = () => {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState('');
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState('');
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/events', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => {
        const list: EventOption[] = d.events || [];
        setEvents(list);
        setEventId((prev) => (prev && list.some((e) => e.id === prev) ? prev : nearestUpcoming(list)?.id || ''));
      })
      .catch(() => setEvents([]));
  }, []);

  const load = useCallback(async () => {
    if (!eventId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/mentor/groups/attendance?eventId=${encodeURIComponent(eventId)}`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat absensi grup.');
      setGroups(d.groups || []);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat.' });
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (userId: string, name: string) => {
    if (!userId || !window.confirm(`Tandai hadir: ${name}?`)) return;
    setMarking(userId);
    setMsg(null);
    try {
      const r = await fetch('/api/mentor/groups/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId, userId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menandai.');
      setMsg({ kind: 'ok', text: d.message || 'Tercatat.' });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menandai.' });
    } finally {
      setMarking('');
    }
  };

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        members: g.members.filter((m) => !q || m.name.toLowerCase().includes(q)),
      })),
    [groups, q],
  );
  const totalPresent = groups.reduce((n, g) => n + g.present, 0);
  const totalMembers = groups.reduce((n, g) => n + g.total, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[28px] p-6 border border-[#D9D7D0]/50 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Absensi Grup</h3>
          {totalMembers > 0 && (
            <span className="ml-auto text-[11px] font-bold text-[#8C8880] tabular-nums">
              Hadir {totalPresent}/{totalMembers}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="flex-1 min-w-[200px] rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] px-3 py-2 text-xs font-bold">
            {events.length === 0 && <option value="">Belum ada event</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8880]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama…"
              className="w-full rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-black"
            />
          </div>
        </div>
        {msg && (
          <p className={`text-[11px] rounded-xl px-3 py-2 border ${msg.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>{msg.text}</p>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#D9D7D0] bg-white p-6 text-center">
          <p className="text-sm font-bold text-[#1B1B1B]">Tidak ada grup binaan</p>
          <p className="text-xs text-[#8C8880] mt-1">Panel ini hanya untuk mentor/co-mentor dengan kelompok aktif.</p>
        </div>
      ) : (
        shown.map((g) => (
          <div key={g.id} className="bg-white rounded-[28px] p-6 border border-[#D9D7D0]/50 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-[#1B1B1B]">{g.name}</h4>
              <span className="ml-auto text-[11px] font-bold text-[#8C8880] tabular-nums">Hadir {g.present}/{g.total}</span>
            </div>
            <div className="h-2 rounded-full bg-[#F0EFEB] overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${g.total ? Math.round((g.present / g.total) * 100) : 0}%` }} />
            </div>
            <div className="divide-y divide-[#F0EFEB]">
              {g.members.map((m) => (
                <div key={m.memberId} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#1B1B1B] truncate">{m.name}</p>
                    <p className="text-[10px] text-[#8C8880]">
                      {m.familyRole || 'Anggota'}
                      {m.present && m.source ? ` · ${SOURCE_LABEL[m.source] || m.source}` : ''}
                      {!m.userId ? ' · belum terhubung akun' : ''}
                    </p>
                  </div>
                  {m.present ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                      <Check className="w-3 h-3" /> Hadir
                    </span>
                  ) : m.canMark ? (
                    <button
                      type="button"
                      disabled={marking === m.userId}
                      onClick={() => void mark(m.userId || '', m.name)}
                      className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-[#181818] text-white disabled:opacity-50"
                    >
                      {marking === m.userId ? '…' : 'Tandai hadir'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#8C8880]">—</span>
                  )}
                </div>
              ))}
              {g.members.length === 0 && <p className="text-xs text-[#8C8880] italic py-2">Tidak ada anggota cocok.</p>}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
