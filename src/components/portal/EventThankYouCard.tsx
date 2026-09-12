import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Heart, Download, CalendarDays, ArrowRight, Loader2 } from 'lucide-react';

type Props = {
  eventName: string;
  eventDate?: string | null;
  givenName?: string | null;
  attended: boolean;
  checkedInAt?: string | null;
  registered?: boolean;
  onBrowseAgenda?: () => void;
};

function dateLabel(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/**
 * Ucapan terima kasih pasca-event (personal). Ditampilkan di Info Event saat
 * status event DONE/ARCHIVED. QR daftar ulang tidak lagi ditampilkan.
 */
export const EventThankYouCard: React.FC<Props> = ({
  eventName,
  eventDate,
  givenName,
  attended,
  checkedInAt,
  registered,
  onBrowseAgenda,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const who = (givenName || '').trim() || 'Sahabat Beyonders';
  const eventDay = dateLabel(eventDate);
  const attendDay = dateLabel(checkedInAt);

  const headline = attended
    ? `Terima kasih sudah hadir, ${who}!`
    : registered
      ? `Terima kasih sudah terdaftar, ${who}`
      : 'Sampai jumpa di agenda berikutnya!';

  const body = attended
    ? `Kehadiranmu di ${eventName} sangat berarti. Terima kasih sudah menjadi bagian dari perjalanan ini.`
    : registered
      ? `Kami mencatat pendaftaranmu di ${eventName}. Semoga kita bisa bertemu di agenda pemuda berikutnya.`
      : `Mari terus berjalan bersama sebagai komunitas pemuda Beyonders di agenda-agenda berikutnya.`;

  const download = async () => {
    if (!printRef.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#FAF9F5' });
      const url = canvas.toDataURL('image/png', 1.0);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terima-kasih-${eventName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Ucapan Terima Kasih</p>
            <h2 className="text-lg font-black text-[#1B1B1B] mt-0.5">{headline}</h2>
            <p className="text-sm text-[#5C5850] mt-1.5 leading-relaxed">{body}</p>
            {(eventDay || attendDay) && (
              <p className="text-xs text-[#8C8880] mt-2 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {attended && attendDay ? `Hadir ${attendDay}` : eventDay ? `${eventName} · ${eventDay}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {onBrowseAgenda && (
            <button
              type="button"
              onClick={onBrowseAgenda}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider"
            >
              Lihat Agenda Mendatang <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#D9D7D0] bg-white text-xs font-bold text-[#5C5850] hover:border-[#1B1B1B] disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Unduh Kartu Ucapan
          </button>
        </div>
      </div>

      {/* Node tersembunyi untuk diunduh sebagai PNG */}
      <div style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <div
          ref={printRef}
          style={{
            width: 720,
            padding: 48,
            background: '#FAF9F5',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            color: '#1B1B1B',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg,#FF416C,#FF4B2B)', marginBottom: 28 }} />
          <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#059669', margin: 0 }}>GEHC Youth · Beyonders</p>
          <p style={{ fontSize: 11, color: '#8C8880', margin: '6px 0 26px' }}>{eventName}</p>
          <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.25, margin: '0 0 16px', fontFamily: "'Playfair Display', Georgia, serif" }}>
            {attended ? `Terima kasih sudah hadir, ${who}!` : `Terima kasih, ${who}`}
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#3D3A34', margin: '0 0 22px' }}>{body}</p>
          <div style={{ borderTop: '1px solid #D9D7D0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8C8880' }}>
            <span>{eventDay || ''}</span>
            <span>Mari bertemu lagi di agenda pemuda berikutnya</span>
          </div>
        </div>
      </div>
    </div>
  );
};
