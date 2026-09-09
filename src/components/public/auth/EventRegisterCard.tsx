import React, { useState } from 'react';
import { Loader2, Ticket } from 'lucide-react';

export type EventRegisterResult = {
  checkInCode?: string | null;
  whatsappGroupUrl?: string | null;
  registeredAt?: string | null;
  eventDate?: string | null;
};

/** Kartu daftar untuk akun login — generik per event (register-auth). */
export const EventRegisterCard: React.FC<{
  slug: string;
  eventName: string;
  onRegistered?: (payload?: EventRegisterResult) => void;
}> = ({ slug, eventName, onRegistered }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/register-auth`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal mendaftar.');
      onRegistered?.(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Ticket className="w-4 h-4 text-[#FF416C]" />
        <p className="text-sm font-black">Daftar {eventName}</p>
      </div>
      <p className="text-[10px] text-[#8C8880] leading-relaxed">
        Konfirmasi kehadiran dengan akun ini. QR & grup WhatsApp tampil setelah terdaftar.
      </p>
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        Konfirmasi daftar
      </button>
    </form>
  );
};
