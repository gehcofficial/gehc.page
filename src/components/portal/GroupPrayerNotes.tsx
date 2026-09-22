import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PRAYER_KIND_LABEL, formatDayShort } from '../../lib/mask';

type PrayerNote = {
  id: string;
  kind: string;
  note: string;
  status: string;
  createdAt: string;
  occurredOn?: string | null;
  prayedCount?: number;
  lastPrayedOn?: string | null;
  isExpired?: boolean;
  expiresAt?: string | null;
  subjectName?: string | null;
  subject?: { id: string | null; name: string; avatar?: string | null } | null;
  reporter?: { id: string; name: string } | null;
};

/** Catatan Portal Doa untuk satu kelompok (roster grup). */
export const GroupPrayerNotes: React.FC<{ groupId: string; compact?: boolean; onCount?: (n: number) => void }> = ({ groupId, compact = false, onCount }) => {
  const { addToast } = useApp();
  const [notes, setNotes] = useState<PrayerNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!groupId) { setNotes([]); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/pastoral-care?groupId=${encodeURIComponent(groupId)}`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        const list: PrayerNote[] = d.notes || [];
        setNotes(list);
        onCount?.(list.length);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, onCount]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: string) => {
    try {
      await fetch(`/api/pastoral-care/${id}/resolve`, { method: 'PATCH', credentials: 'include' });
      await load();
    } catch {
      addToast({ type: 'error', title: 'Gagal menutup catatan' });
    }
  };

  if (loading) return <p className="text-xs text-[#8C8880] flex items-center gap-2"><span className="w-3 h-3 border-2 border-[#FF416C] border-t-transparent rounded-full animate-spin inline-block" /> Memuat catatan doa…</p>;
  if (!notes.length) return <p className="text-xs text-[#8C8880]">Belum ada catatan doa untuk anggota kelompok ini.</p>;

  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <div key={n.id} className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {PRAYER_KIND_LABEL[n.kind] || n.kind}
                </span>
                <span className="text-xs font-bold text-[#1B1B1B] truncate">{n.subject?.name || n.subjectName || '—'}</span>
              </div>
              <p className={`text-xs text-[#5C5850] mt-1.5 leading-relaxed ${compact ? 'line-clamp-2' : ''}`}>{n.note}</p>
              <p className="text-[10px] text-[#8C8880] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {n.occurredOn && <span>Kejadian {formatDayShort(n.occurredOn)}</span>}
                {n.reporter?.name && <span>· Dilaporkan {n.reporter.name}</span>}
                <span>· {n.prayedCount ? `Terakhir didoakan ${formatDayShort(n.lastPrayedOn)} (${n.prayedCount}×)` : 'Belum pernah didoakan'}</span>
                {n.isExpired && (
                  <span className="font-bold px-1.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Kedaluwarsa</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void resolve(n.id)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100"
              title="Tandai selesai"
            >
              Selesai
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
