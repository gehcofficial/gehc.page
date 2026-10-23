import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Copy, Loader2, Send, Users } from 'lucide-react';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import type { SearchableOption } from '../../lib/searchable-options';
import { parseHashSearch } from '../../lib/portal-routes';
import { Badge } from '../ui/Badge';

type Slot = {
  roleKey: string;
  serviceRoleId: string | null;
  segment: string;
  name: string;
  division: string;
  optional: boolean;
  slotStatus: string;
  slotStatusLabel: string;
  userId?: string | null;
  userName?: string | null;
};

type Session = {
  serviceDate?: string;
  patternCode?: string;
  event?: { id: string; name?: string };
  slots: Slot[];
  progress?: { percent: number; filled: number; required: number };
  canManage?: boolean;
};

const STATUS_TONE: Record<string, string> = {
  KOSONG: 'bg-gray-100 text-gray-700',
  MINTA_DIVISI: 'bg-amber-50 text-amber-800',
  DIJADWALKAN: 'bg-sky-50 text-sky-800',
  DIKONFIRMASI: 'bg-emerald-50 text-emerald-800',
  SELESAI: 'bg-[#FAF9F5] text-[#8C8880]',
};

function tokenFromHash(): string {
  try {
    return String(parseHashSearch().get('token') || '').trim();
  } catch {
    return '';
  }
}

type Props = {
  /** Token dari Panel BOD (tanpa mengubah hash). */
  tokenOverride?: string;
};

export const PenatalayanBodLinkPanel: React.FC<Props> = ({ tokenOverride }) => {
  const token = useMemo(() => String(tokenOverride || '').trim() || tokenFromHash(), [tokenOverride]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, SearchableOption[]>>({});

  const searchPeople = useCallback(async (q: string): Promise<SearchableOption[]> => {
    const r = await fetch(`/api/penatalayan/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d: unknown = await r.json().catch(() => ({}));
    const o = (typeof d === 'object' && d !== null ? d : {}) as { people?: unknown; users?: unknown };
    const list = Array.isArray(o.people) ? o.people : Array.isArray(o.users) ? o.users : [];
    return (list as Array<{ id: string; name: string }>).map((p) => ({ value: String(p.id), label: String(p.name) }));
  }, []);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError('Tautan tidak valid — minta link dari BOD Tim Kerja.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/penatalayan/bod-links/token/${encodeURIComponent(token)}`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setSession(d as Session);
    } catch (e) {
      setSession(null);
      setError(e instanceof Error ? e.message : 'Gagal memuat tautan.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of session?.slots || []) {
      const list = map.get(s.segment) || [];
      list.push(s);
      map.set(s.segment, list);
    }
    return [...map.entries()];
  }, [session?.slots]);

  const assign = async (slot: Slot) => {
    const pick = picks[slot.roleKey]?.[0];
    if (!pick?.value) {
      setMsg('Pilih nama petugas dulu.');
      return;
    }
    setBusyKey(slot.roleKey);
    setMsg(null);
    try {
      const r = await fetch(`/api/penatalayan/bod-links/token/${encodeURIComponent(token)}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ roleKey: slot.roleKey, serviceRoleId: slot.serviceRoleId, userId: pick.value }] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan.');
      setPicks((p) => ({ ...p, [slot.roleKey]: [] }));
      await load();
      setMsg(`${slot.name} dijadwalkan.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusyKey(null);
    }
  };

  const requestDivision = async (slot: Slot) => {
    setBusyKey(slot.roleKey);
    setMsg(null);
    try {
      const r = await fetch(`/api/penatalayan/bod-links/token/${encodeURIComponent(token)}/request-division`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleKey: slot.roleKey, serviceRoleId: slot.serviceRoleId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal meminta divisi.');
      await load();
      setMsg(`Permintaan ke ${slot.division} terkirim.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal meminta divisi.');
    } finally {
      setBusyKey(null);
    }
  };

  const copyCaption = async () => {
    try {
      const r = await fetch(`/api/penatalayan/bod-links/token/${encodeURIComponent(token)}/caption`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal memuat caption.');
      setCaption(String(d.caption || ''));
      await navigator.clipboard.writeText(String(d.caption || ''));
      setMsg('Caption disalin ke clipboard.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyalin caption.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted py-12 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
        Memuat penatalayan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-line bg-page p-6 flex gap-3 text-ink">
        <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">Tidak dapat membuka tautan</p>
          <p className="text-sm text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const prog = session?.progress;

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      <header className="rounded-card border border-line bg-white p-4 space-y-2">
        <h1 className="font-display text-xl text-ink">Pengisian Penatalayan</h1>
        {session?.event?.name && <p className="text-sm text-muted">{session.event.name}</p>}
        {session?.serviceDate && (
          <p className="text-sm">
            {new Date(`${session.serviceDate}T00:00:00Z`).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
        )}
        {prog && (
          <p className="text-sm text-muted">
            Progres wajib: {prog.filled}/{prog.required} ({prog.percent}%)
          </p>
        )}
        {session?.canManage && (
          <button
            type="button"
            onClick={copyCaption}
            className="inline-flex items-center gap-2 text-sm text-brand font-medium mt-2"
          >
            <Copy className="w-4 h-4" />
            Salin caption WA
          </button>
        )}
      </header>

      {msg && <p className="text-sm text-center text-muted">{msg}</p>}

      {grouped.map(([segment, slots]) => (
        <section key={segment} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted px-1">{segment}</h2>
          <ul className="space-y-2">
            {slots.map((slot) => (
              <li key={`${segment}-${slot.roleKey}`} className="rounded-card border border-line bg-white p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{slot.name}</p>
                    <p className="text-xs text-muted">{slot.division}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_TONE[slot.slotStatus] || STATUS_TONE.KOSONG}`}>
                    {slot.slotStatusLabel}
                  </span>
                </div>
                {slot.optional && <Badge tone="neutral">Opsional</Badge>}
                {slot.userName && (
                  <p className="text-sm flex items-center gap-1 text-ink">
                    <Users className="w-4 h-4 text-muted" />
                    {slot.userName}
                  </p>
                )}
                {slot.slotStatus === 'KOSONG' && (
                  <>
                    <SearchableMultiSelect
                      placeholder="Cari anggota…"
                      max={1}
                      values={(picks[slot.roleKey] || []).map((o) => o.value)}
                      selectedOptions={picks[slot.roleKey] || []}
                      onSearch={searchPeople}
                      onChange={(_v, opts) => setPicks((p) => ({ ...p, [slot.roleKey]: opts }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyKey === slot.roleKey}
                        onClick={() => assign(slot)}
                        className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1 rounded-full bg-brand text-white text-sm py-2 px-3 disabled:opacity-50"
                      >
                        {busyKey === slot.roleKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Jadwalkan
                      </button>
                      {!slot.optional && (
                        <button
                          type="button"
                          disabled={busyKey === slot.roleKey}
                          onClick={() => requestDivision(slot)}
                          className="flex-1 min-w-[120px] rounded-full border border-line text-sm py-2 px-3 disabled:opacity-50"
                        >
                          Minta ke divisi
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {caption && session?.canManage && (
        <pre className="text-xs whitespace-pre-wrap rounded-card border border-line bg-[#FAF9F5] p-3 text-ink">{caption}</pre>
      )}
    </div>
  );
};

export default PenatalayanBodLinkPanel;
