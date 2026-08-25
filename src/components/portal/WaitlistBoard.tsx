import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Copy, Loader2, UserPlus } from 'lucide-react';

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

const STATUS_LABEL: Record<string, string> = {
  WAITLISTED: 'Waitlist',
  PROFILED: 'Profil Lengkap',
  ASSIGNED: 'Sudah Dirumahkan',
};

interface WEntry {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  origin?: string | null;
  address?: string | null;
  giftsTop5?: { label?: string; key?: string }[] | string[] | null;
  talents?: string[] | null;
  status: string;
  assignedGroupId?: string | null;
  promoteToken: string;
}

interface GroupDto { id: string; name: string; memberCount?: number }

export const WaitlistBoard: React.FC = () => {
  const [entries, setEntries] = useState<WEntry[] | null>(null);
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<WEntry | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [w, g] = await Promise.all([
          fetch('/api/waitlist', { credentials: 'include' }).then((r) => r.json()),
          fetch('/api/db/groups').then((r) => r.json()),
        ]);
        setEntries(w.entries || []);
        setGroups(g.groups || []);
      } catch {
        setEntries([]);
      }
    })();
  }, []);

  const columns = useMemo(
    () => ['WAITLISTED', 'PROFILED', 'ASSIGNED'].map((s) => ({
      status: s,
      items: (entries || []).filter((e) => e.status === s),
    })),
    [entries]
  );

  const assign = async (entry: WEntry, groupId: string) => {
    setBusy(entry.id);
    try {
      const res = await fetch(`/api/waitlist/${entry.id}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEntries((prev) =>
        (prev || []).map((e) => (e.id === entry.id ? { ...e, status: 'ASSIGNED', assignedGroupId: groupId } : e))
      );
    } finally {
      setBusy(null);
      setAssignFor(null);
    }
  };

  if (entries === null) {
    return (
      <div className="py-20 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat waitlist…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
          <ClipboardList className="w-3.5 h-3.5 text-[#FF416C]" />
          <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
            Waitlist Newcomer
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Papan Waitlist — BAKU TAU 4.0
        </h2>
        <p className="text-xs sm:text-sm text-[#8C8880] mt-1 max-w-2xl leading-relaxed">
          Pendaftar tahap cepat masuk kolom Waitlist. Kirim link profil untuk melengkapi
          karunia & bakat, lalu rumahkan ke kelompok mentoring.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 items-start">
        {columns.map((col) => (
          <div key={col.status} className="rounded-[28px] bg-[#F3F1EC]/60 border border-[#D9D7D0]/40 p-4 space-y-3 min-h-[200px]">
            <p className="text-xs font-black uppercase tracking-widest text-[#1B1B1B] flex items-center justify-between px-1">
              {STATUS_LABEL[col.status]}
              <span className="text-[10px] font-bold bg-white rounded-full px-2 py-0.5">{col.items.length}</span>
            </p>

            {col.items.length === 0 && (
              <p className="text-[11px] text-[#8C8880] italic px-1">Kosong.</p>
            )}

            {col.items.map((e) => (
              <div key={e.id} className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <img src={initialsAvatar(e.name)} alt={e.name} loading="lazy" decoding="async"
                    className="w-8 h-8 rounded-full object-cover border border-[#D9D7D0]" />
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{e.name}</p>
                    <p className="text-[10px] text-[#8C8880] truncate">{e.phone}{e.origin ? ` · ${e.origin}` : ''}</p>
                  </div>
                </div>

                {Array.isArray(e.giftsTop5) && e.giftsTop5.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(e.giftsTop5 as Array<{ label?: string } | string>).slice(0, 5).map((g, i) => (
                      <span key={i} className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {typeof g === 'string' ? g : g.label}
                      </span>
                    ))}
                  </div>
                )}

                {Array.isArray(e.talents) && e.talents.length > 0 && (
                  <p className="text-[10px] text-[#8C8880] truncate">Bakat: {e.talents.join(', ')}</p>
                )}

                {e.status !== 'ASSIGNED' && (
                  <>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/#/join?token=${e.promoteToken}`
                        );
                        alert('Link pelengkap profil tersalin — kirim via WhatsApp.');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-[10px] font-bold hover:border-black"
                    >
                      <Copy className="w-3 h-3" /> Salin Link Profil
                    </button>
                    {!assignFor || assignFor.id !== e.id ? (
                      <button
                        onClick={() => setAssignFor(e)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-[10px] font-black uppercase tracking-wider"
                      >
                        <UserPlus className="w-3 h-3" /> Rumahkan
                      </button>
                    ) : (
                      <select
                        autoFocus
                        defaultValue=""
                        onChange={(ev) => ev.target.value && assign(e, ev.target.value)}
                        onBlur={() => setAssignFor(null)}
                        disabled={busy === e.id}
                        className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-semibold"
                      >
                        <option value="">Pilih grup tujuan…</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                            {typeof g.memberCount === 'number' ? ` (${g.memberCount})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
