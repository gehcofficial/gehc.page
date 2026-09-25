import React, { useEffect, useState } from 'react';
import { QrCode, ChevronDown, ChevronUp } from 'lucide-react';
import { EventCheckInTab } from './EventCheckInTab';

/**
 * Absensi kehadiran untuk Tuan Rumah (host group) / petugas Koinonia per event.
 * Muncul hanya bila server mengizinkan (grup Tuan Rumah atau komponen Koinonia).
 */
export const EventHostCheckIn: React.FC<{ eventId: string; eventName: string }> = ({ eventId, eventName }) => {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/checkin-access`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setAllowed(Boolean(d?.allowed)); })
      .catch(() => { /* abaikan */ });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!allowed) return null;

  return (
    <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="w-4 h-4 text-[#0EA5E9]" />
        <h3 className="text-sm font-black text-[#1B1B1B]">Absensi Kehadiran — {eventName}</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-sky-700"
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {open ? 'Tutup' : 'Buka absensi'}
        </button>
      </div>
      {!open && <p className="text-xs text-[#8C8880]">Untuk Tuan Rumah/penerima tamu: pindai QR peserta atau input tamu.</p>}
      {open && <EventCheckInTab eventId={eventId} eventName={eventName} />}
    </div>
  );
};
