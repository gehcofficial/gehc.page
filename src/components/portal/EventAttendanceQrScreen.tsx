import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Maximize2, Minimize2, QrCode, RefreshCw } from 'lucide-react';

type AttendanceQr = {
  token: string;
  pin: string;
  slot: number;
  slotMs: number;
  expiresAt: string;
  url: string;
  qr: string | null;
  open: boolean;
  reason: string;
  validFrom: string | null;
  validTo: string | null;
};

function wibTime(iso?: string | null): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  return new Date(t + 7 * 3600 * 1000).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).replace(':', '.');
}

const REASON_TEXT: Record<string, string> = {
  NOT_YET: 'Jendela absensi belum dibuka — peserta yang memindai akan ditolak.',
  CLOSED: 'Jendela absensi sudah ditutup.',
  NO_DATE: 'Tanggal event belum diisi, jadi absensi mandiri tidak aktif. Isi tanggal di Program & Event.',
};

/**
 * Layar QR kehadiran untuk panitia: satu QR dipindai banyak peserta.
 * Token + PIN berganti tiap 30 detik (screenshot cepat kedaluwarsa).
 */
export const EventAttendanceQrScreen: React.FC<{ eventId: string; eventName: string }> = ({ eventId, eventName }) => {
  const [data, setData] = useState<AttendanceQr | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/attendance-qr`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setData(d as AttendanceQr);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat QR.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  // Token berganti tiap 30 detik → segarkan sedikit lebih cepat dari slot.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      void load();
    }, 20000);
    const onVis = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!data) return 0;
    const exp = new Date(data.expiresAt).getTime();
    return Number.isFinite(exp) ? Math.max(0, Math.round((exp - now) / 1000)) : 0;
  }, [data, now]);

  if (loading) {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-[#8C8880]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyiapkan QR kehadiran…
      </p>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-xs font-bold text-red-700">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
          <RefreshCw className="w-3 h-3" /> Coba lagi
        </button>
      </div>
    );
  }

  const warn = data && !data.open ? (REASON_TEXT[data.reason] || 'Absensi mandiri tidak aktif.') : '';
  const card = (
    <div className={fullscreen ? 'fixed inset-0 z-50 overflow-auto bg-[#1B1B1B] p-6 text-white' : 'space-y-3'}>
      <div className={fullscreen ? 'mx-auto flex max-w-md flex-col items-center gap-4' : 'flex flex-col items-center gap-3'}>
        <p className={`text-[10px] font-black uppercase tracking-widest ${fullscreen ? 'text-white/60' : 'text-[#8C8880]'}`}>
          Pindai untuk absen · {eventName}
        </p>
        {data?.qr ? (
          <img
            src={data.qr}
            alt="QR kehadiran event"
            className={`rounded-2xl bg-white p-3 ${fullscreen ? 'w-72' : 'w-56'}`}
          />
        ) : (
          <div className={`flex items-center justify-center rounded-2xl bg-white ${fullscreen ? 'h-72 w-72' : 'h-56 w-56'}`}>
            <QrCode className={`h-10 w-10 ${fullscreen ? 'text-black/30' : 'text-[#D9D7D0]'}`} />
          </div>
        )}
        <div className="text-center">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${fullscreen ? 'text-white/50' : 'text-[#8C8880]'}`}>
            PIN cadangan (berlaku {secondsLeft} dtk)
          </p>
          <p className={`font-black tracking-[0.4em] ${fullscreen ? 'text-3xl text-white' : 'text-2xl text-[#1B1B1B]'}`}>
            {data?.pin || '------'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold ${
            fullscreen ? 'bg-white/10 text-white' : 'border border-[#D9D7D0] text-[#5C5850]'
          }`}
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
        </button>
      </div>
      {warn && (
        <p className={`mx-auto mt-3 max-w-md rounded-xl px-3 py-2 text-[11px] font-bold ${
          fullscreen ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}
        >
          {warn}
        </p>
      )}
      {data?.validFrom && data?.validTo && (
        <p className={`mx-auto mt-1 max-w-md text-center text-[10px] ${fullscreen ? 'text-white/40' : 'text-[#8C8880]'}`}>
          <Clock className="mr-1 inline h-3 w-3" />
          Jendela absensi {wibTime(data.validFrom)} – {wibTime(data.validTo)} WIB
        </p>
      )}
    </div>
  );

  return card;
};
