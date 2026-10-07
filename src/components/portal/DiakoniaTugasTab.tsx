import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { summarizeReadiness } from '../../lib/diakonia';

type Check = { area: string; status: string; note?: string | null };
type Transport = { id: string; pickupPoint: string; driver?: string | null; seats?: number | null };

const AREA_LABEL: Record<string, string> = {
  LOGISTIK: 'Logistik & Fasilitas',
  KONSUMSI: 'Konsumsi & Keramahan',
  KESEHATAN: 'Kesehatan & Keselamatan',
};

/**
 * Tab Tugas Diakonia — papan readiness mingguan per event (agregator 3 area).
 * Detail tiap area dikelola di tab Logistik/Konsumsi/Kesehatan.
 */
export const DiakoniaTugasTab: React.FC<{ eventId: string; eventName?: string; onGotoArea?: (area: 'logistik' | 'konsumsi' | 'kesehatan') => void }> = ({ eventId, eventName, onGotoArea }) => {
  const [checks, setChecks] = useState<Check[]>([]);
  const [transport, setTransport] = useState<Transport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/diakonia/readiness`, { credentials: 'include' });
      const d = (await r.json().catch(() => ({}))) as { checks?: Check[]; transport?: Transport[] };
      setChecks(d.checks || []);
      setTransport(d.transport || []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat kesiapan…</p>;
  }

  const summary = summarizeReadiness(checks);
  const byArea = new Map<string, Check>(checks.map((c) => [c.area, c]));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#EA580C]" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Kesiapan operasional</h3>
          <span className="text-[11px] text-[#8C8880]">{eventName}</span>
          <span className={`ml-auto text-[11px] font-black px-2.5 py-1 rounded-full border ${summary.overall === 'SIAP' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : summary.overall === 'KENDALA' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {summary.overall} · {summary.siap}/3 siap
          </span>
        </div>
        <p className="text-[11px] text-[#8C8880] mt-1">Target H-1 semua hijau — atau kendala tercatat dengan penanggung jawab.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(['LOGISTIK', 'KONSUMSI', 'KESEHATAN'] as const).map((a) => {
          const c = byArea.get(a);
          const st = c?.status || 'BELUM';
          return (
            <button
              key={a}
              type="button"
              onClick={() => onGotoArea?.(a.toLowerCase() as 'logistik' | 'konsumsi' | 'kesehatan')}
              className="text-left rounded-xl border border-[#D9D7D0]/60 bg-white p-3 hover:shadow-sm"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">{AREA_LABEL[a]}</p>
              <p className={`mt-1 text-sm font-black ${st === 'SIAP' ? 'text-emerald-700' : st === 'KENDALA' ? 'text-red-600' : 'text-gray-500'}`}>{st}</p>
              {c?.note && <p className="mt-1 text-[11px] text-[#5C5850] line-clamp-2">{c.note}</p>}
              <p className="mt-1 text-[10px] font-bold text-sky-700">Kelola →</p>
            </button>
          );
        })}
      </div>

      {transport.length > 0 && (
        <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-2">Titik jemput carpool ({transport.length})</p>
          <div className="space-y-1.5">
            {transport.map((t) => (
              <p key={t.id} className="text-xs text-[#1B1B1B]">
                <strong>{t.pickupPoint}</strong>
                {t.driver && <span className="text-[#8C8880]"> · {t.driver}</span>}
                {t.seats ? <span className="text-[#8C8880]"> · {t.seats} kursi</span> : null}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
