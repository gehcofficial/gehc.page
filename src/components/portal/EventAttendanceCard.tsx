import React, { useEffect, useState } from 'react';
import { CheckCircle2, QrCode } from 'lucide-react';
import { attendanceHash } from '../../lib/event-attendance';

type Mine = {
  present: boolean;
  checkedInAt?: string | null;
  open: boolean;
  reason?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
};

function wibTime(iso?: string | null): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  return new Date(t + 7 * 3600 * 1000).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).replace(':', '.');
}

/**
 * Kartu kehadiran peserta: tombol absensi mandiri (pindai QR di layar panitia).
 * Hanya tampil saat jendela absensi buka atau sudah tercatat hadir — supaya
 * Info Event tidak penuh ajakan yang belum relevan.
 */
export const EventAttendanceCard: React.FC<{ eventId: string; slug: string }> = ({ eventId, slug }) => {
  const [mine, setMine] = useState<Mine | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(slug)}/my-attendance`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setMine(d as Mine); })
      .catch(() => { /* kartu opsional — diamkan bila gagal */ });
    return () => { cancelled = true; };
  }, [slug, eventId]);

  if (!mine) return null;

  if (mine.present) {
    return (
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
        <p className="inline-flex items-center gap-2 text-sm font-black text-emerald-800">
          <CheckCircle2 className="w-4 h-4" /> Kamu sudah tercatat hadir
        </p>
        <p className="mt-1 text-[11px] text-emerald-700">
          {mine.checkedInAt ? `Tercatat ${wibTime(mine.checkedInAt)} WIB. ` : ''}
          Tidak perlu memindai ulang.
        </p>
      </div>
    );
  }

  if (!mine.open) return null;

  return (
    <div className="rounded-[28px] border border-sky-200 bg-sky-50 p-5">
      <p className="text-sm font-black text-sky-900">Absensi hari-H</p>
      <p className="mt-1 text-[11px] text-sky-800 leading-relaxed">
        Pindai QR di layar panitia untuk mencatat kehadiranmu sendiri — tanpa antre.
        {mine.validFrom && mine.validTo ? ` Jendela absensi ${wibTime(mine.validFrom)}–${wibTime(mine.validTo)} WIB.` : ''}
      </p>
      <a
        href={attendanceHash(slug)}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1B1B1B] px-4 py-2.5 text-xs font-bold text-white"
      >
        <QrCode className="w-4 h-4" /> Scan QR kehadiran
      </a>
    </div>
  );
};
