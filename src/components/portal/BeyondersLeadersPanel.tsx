import React, { useCallback, useEffect, useState } from 'react';
import { Crown, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Person = { id: string; name: string; avatar?: string | null };

type HouseRow = {
  groupId: string;
  name: string;
  foundedPeriod?: string;
  batch: {
    id: string;
    period: string;
    batchLabel?: string | null;
    generation: number;
    mentorName: string;
    comentorName?: string | null;
    mentorUserId?: string | null;
    comentorUserId?: string | null;
    regenReady: boolean;
  } | null;
  liveMentor: Person | null;
  liveComentor: Person | null;
  mismatch: { mentor: boolean; comentor: boolean };
};

function PersonPicker({
  label,
  valueName,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  valueName: string;
  disabled?: boolean;
  onPick: (p: Person) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState(valueName);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    setQ(valueName);
  }, [valueName]);

  useEffect(() => {
    if (disabled || q.trim().length < 2) {
      setPeople([]);
      return;
    }
    if (q.trim() === valueName.trim()) {
      setPeople([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/beyonders/leaders/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      const d = await r.json();
      setPeople(d.people || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, disabled, valueName]);

  return (
    <div>
      <p className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider mb-1">{label}</p>
      <div className="flex gap-1">
        <input
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama…"
          className="flex-1 px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-xs disabled:opacity-60"
        />
        {!disabled && valueName && valueName !== 'TBD' && (
          <button type="button" onClick={onClear} className="text-[10px] font-bold text-[#8C8880] px-1">
            Hapus
          </button>
        )}
      </div>
      {people.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p);
                setQ(p.name);
                setPeople([]);
              }}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F3F1EC] hover:bg-[#181818] hover:text-white"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const BeyondersLeadersPanel: React.FC = () => {
  const { addToast, isKomisi, isCommittee, isSuperAdmin } = useApp();
  const canEdit = isKomisi || isSuperAdmin;
  const canReady = canEdit || isCommittee;
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextPeriod, setNextPeriod] = useState('');
  const [override, setOverride] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { period: string; mentor: Person | null; comentor: Person | null }>>({});

  const load = useCallback(async () => {
    const r = await fetch('/api/beyonders/leaders', { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal memuat pemimpin rumah' });
      setLoading(false);
      return;
    }
    const list: HouseRow[] = d.houses || [];
    setHouses(list);
    const next: Record<string, { period: string; mentor: Person | null; comentor: Person | null }> = {};
    for (const h of list) {
      next[h.groupId] = {
        period: h.batch?.period || h.foundedPeriod || '2026-06',
        mentor: h.batch?.mentorUserId
          ? { id: h.batch.mentorUserId, name: h.batch.mentorName }
          : h.batch?.mentorName && h.batch.mentorName !== 'TBD'
            ? { id: '', name: h.batch.mentorName }
            : null,
        comentor: h.batch?.comentorUserId
          ? { id: h.batch.comentorUserId, name: h.batch.comentorName || '' }
          : h.batch?.comentorName
            ? { id: '', name: h.batch.comentorName }
            : null,
      };
    }
    setDrafts(next);
    setNextPeriod((prev) => {
      if (prev) return prev;
      const first = list[0]?.batch?.period;
      if (!first) return '2027-06';
      const [y, m] = String(first).split('-').map(Number);
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      return `${ny}-${String(nm).padStart(2, '0')}`;
    });
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveHouse = async (groupId: string) => {
    const d = drafts[groupId];
    if (!d) return;
    const r = await fetch(`/api/beyonders/leaders/${groupId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: d.period,
        mentorName: d.mentor?.name || 'TBD',
        mentorUserId: d.mentor?.id || null,
        comentorName: d.comentor?.name || null,
        comentorUserId: d.comentor?.id || null,
      }),
    });
    const body = await r.json();
    if (!r.ok) {
      addToast({ type: 'error', title: body.error || 'Gagal menyimpan' });
      return;
    }
    addToast({ type: 'success', title: 'Nama landing disimpan. Muat ulang halaman Beyonders publik jika masih lama.' });
    load();
  };

  const toggleReady = async (groupId: string, ready: boolean) => {
    const r = await fetch(`/api/beyonders/leaders/${groupId}/ready`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ready }),
    });
    const body = await r.json();
    if (!r.ok) {
      addToast({ type: 'error', title: body.error || 'Gagal menandai siap' });
      return;
    }
    setHouses((prev) =>
      prev.map((h) => (h.groupId === groupId && h.batch ? { ...h, batch: { ...h.batch, regenReady: body.regenReady } } : h)),
    );
  };

  const regenerate = async () => {
    const r = await fetch('/api/beyonders/leaders/regenerate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nextPeriod, override }),
    });
    const body = await r.json();
    if (!r.ok) {
      addToast({ type: 'error', title: body.error || 'Gagal membuka generasi' });
      return;
    }
    addToast({ type: 'success', title: `Generasi ${body.generation} (${body.nextPeriod}) dibuka untuk 10 rumah.` });
    setOverride(false);
    load();
  };

  const generation = houses[0]?.batch?.generation ?? 0;
  const readyCount = houses.filter((h) => h.batch?.regenReady).length;
  const allReady = houses.length > 0 && readyCount === houses.length;

  if (loading) {
    return <p className="text-xs text-[#8C8880]">Memuat 10 rumah…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-[#C9A227]" />
          Generasi {generation} · Retreat cohort {houses[0]?.batch?.period || '2026-06'}
        </p>
        <p className="text-[11px] text-[#8C8880] mt-1 leading-relaxed">
          Nama di sini tampil di landing Beyonders. Akses portal (login mentor) tetap dari Jemaat → wizard peran.
          Cabut peran otomatis mengosongkan nama landing. Mitosis rumah penuh ada di Regenerasi Kelompok — bukan tombol ini.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {houses.map((h) => {
          const d = drafts[h.groupId];
          const mismatch = h.mismatch.mentor || h.mismatch.comentor;
          return (
            <div key={h.groupId} className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{h.name}</p>
                  <p className="text-[10px] text-[#8C8880]">
                    Generasi {h.batch?.generation ?? 0}
                    {h.liveMentor ? ` · akses: ${h.liveMentor.name}` : ' · belum ada MENTOR di portal'}
                  </p>
                </div>
                {mismatch && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    Landing ≠ akses
                  </span>
                )}
              </div>
              <label className="block">
                <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">Periode batch</span>
                <input
                  type="month"
                  disabled={!canEdit}
                  value={d?.period || ''}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [h.groupId]: { ...prev[h.groupId], period: e.target.value } }))
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-xs disabled:opacity-60"
                />
              </label>
              <PersonPicker
                label="Mentor (landing)"
                valueName={d?.mentor?.name || ''}
                disabled={!canEdit}
                onPick={(p) => setDrafts((prev) => ({ ...prev, [h.groupId]: { ...prev[h.groupId], mentor: p } }))}
                onClear={() => setDrafts((prev) => ({ ...prev, [h.groupId]: { ...prev[h.groupId], mentor: null } }))}
              />
              <PersonPicker
                label="Co-mentor (landing)"
                valueName={d?.comentor?.name || ''}
                disabled={!canEdit}
                onPick={(p) => setDrafts((prev) => ({ ...prev, [h.groupId]: { ...prev[h.groupId], comentor: p } }))}
                onClear={() => setDrafts((prev) => ({ ...prev, [h.groupId]: { ...prev[h.groupId], comentor: null } }))}
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-[11px] font-semibold">
                  <input
                    type="checkbox"
                    disabled={!canReady}
                    checked={Boolean(h.batch?.regenReady)}
                    onChange={(e) => toggleReady(h.groupId, e.target.checked)}
                  />
                  Siap regenerasi
                </label>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => saveHouse(h.groupId)}
                    className="px-3 py-1 rounded-full bg-[#181818] text-white text-[11px] font-bold"
                  >
                    Simpan
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
          <p className="text-xs font-bold">Buka generasi berikutnya (10 rumah sekaligus)</p>
          <p className="text-[11px] text-[#8C8880]">
            Siap {readyCount}/{houses.length}. Nama rumah di landing tetap; batch baru jadi yang tampil.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-semibold">
              Periode baru
              <input
                type="month"
                value={nextPeriod}
                onChange={(e) => setNextPeriod(e.target.value)}
                className="ml-2 px-2 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Override (tidak semua siap)
            </label>
            <button
              type="button"
              onClick={regenerate}
              disabled={!nextPeriod || (!allReady && !override)}
              className="px-3 py-1.5 rounded-full bg-[#C9A227] text-[#181818] text-[11px] font-bold disabled:opacity-40"
            >
              Buka generasi berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
