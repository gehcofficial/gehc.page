import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Clock, Loader2, QrCode, RefreshCw, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { attendanceHash, attendanceResultTitle, isAttendancePin, tokenFromHash } from '../../lib/event-attendance';
import { decodeFromImageData } from '../../lib/qr-decode';

type MyAttendance = {
  present: boolean;
  checkedInAt?: string | null;
  name?: string | null;
  open: boolean;
  reason?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  event: { id: string; slug: string; name: string };
};

type ScanOutcome = { result: string; message?: string; name?: string | null; checkedInAt?: string | null };

const CLOSED_TEXT: Record<string, string> = {
  NOT_YET: 'Absensi mandiri belum dibuka. Coba lagi mendekati hari acara.',
  CLOSED: 'Absensi mandiri sudah ditutup. Hubungi Tuan Rumah/Koinonia.',
  NO_DATE: 'Tanggal acara belum ditetapkan, jadi absensi mandiri belum aktif.',
};

function wibTime(iso?: string | null): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  return new Date(t + 7 * 3600 * 1000).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).replace(':', '.');
}

/**
 * Absensi mandiri: peserta memindai QR event di layar panitia.
 * Kehadiran dicatat atas akun sendiri (bukan dipindai panitia).
 */
export const EventSelfCheckIn: React.FC<{ slug: string }> = ({ slug }) => {
  const { authUser } = useApp();
  const [mine, setMine] = useState<MyAttendance | null>(null);
  const [booted, setBooted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);
  const cooldownRef = useRef(0);
  const autoTried = useRef(false);

  const load = useCallback(async () => {
    if (!authUser) return;
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(slug)}/my-attendance`, { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setMine(d as MyAttendance);
    } catch { /* biarkan UI memakai status terakhir */ }
    setBooted(true);
  }, [authUser, slug]);

  useEffect(() => { void load(); }, [load]);

  const submit = useCallback(async (input: { token?: string; pin?: string }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(slug)}/attendance/scan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || d.error || `HTTP ${r.status}`);
      setOutcome(d as ScanOutcome);
      setManual('');
      setCameraOn(false);
      void load();
    } catch (e) {
      setOutcome({ result: 'UNKNOWN', message: e instanceof Error ? e.message : 'Gagal mencatat kehadiran.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [load, slug]);

  // Token dari QR (dipindai kamera bawaan HP) → langsung dikirim sekali.
  useEffect(() => {
    if (!authUser || autoTried.current) return;
    const token = tokenFromHash(window.location.hash);
    if (!token) return;
    autoTried.current = true;
    void submit({ token });
  }, [authUser, submit]);

  // Kamera in-app: BarcodeDetector native, fallback jsQR (iOS Safari).
  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let detector: { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let lastScan = 0;

    const handle = (value: string) => {
      cooldownRef.current = Date.now() + 2500;
      if (isAttendancePin(value)) void submit({ pin: value });
      else void submit({ token: value });
    };

    const tick = async () => {
      if (stopped) return;
      raf = requestAnimationFrame(() => { void tick(); });
      if (Date.now() < cooldownRef.current || video.readyState < 2) return;
      if (detector) {
        try {
          const found = await detector.detect(video);
          const value = found[0]?.rawValue;
          if (value) handle(value);
        } catch { /* lewati frame */ }
        return;
      }
      if (!ctx || !canvas) return;
      if (Date.now() - lastScan < 180) return;
      lastScan = Date.now();
      try {
        if (video.videoWidth === 0) return;
        const targetW = Math.min(video.videoWidth, 640);
        const scale = targetW / video.videoWidth;
        canvas.width = targetW;
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const value = decodeFromImageData(img.data, img.width, img.height);
        if (value) handle(value);
      } catch { /* lewati frame */ }
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
        video.srcObject = stream;
        try { await video.play(); } catch { /* iOS kadang menolak autoplay */ }
        setCameraError('');
      } catch {
        setCameraError('Kamera tidak bisa dibuka. Beri izin kamera, atau pakai PIN di bawah.');
        setCameraOn(false);
        return;
      }
      const Detector = (window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> };
      }).BarcodeDetector;
      if (Detector) {
        try { detector = new Detector({ formats: ['qr_code'] }); } catch { detector = null; }
      }
      if (!detector) {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
      }
      raf = requestAnimationFrame(() => { void tick(); });
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn, submit]);

  const token = tokenFromHash(typeof window === 'undefined' ? '' : window.location.hash);
  const loginHref = `#/login?next=${encodeURIComponent(attendanceHash(slug, token))}`;

  if (!authUser) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[28px] border border-[#D9D7D0]/60 bg-white p-7 text-center space-y-4">
          <QrCode className="w-10 h-10 mx-auto text-sky-600" />
          <h1 className="text-lg font-black text-[#1B1B1B]">Absensi Kehadiran</h1>
          <p className="text-xs text-[#8C8880] leading-relaxed">
            Masuk dengan akunmu dulu supaya kehadiran tercatat atas namamu. Setelah masuk kamu otomatis kembali ke halaman ini.
          </p>
          <a
            href={loginHref}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#1B1B1B] px-4 py-3 text-xs font-bold text-white"
          >
            Masuk untuk absen
          </a>
        </div>
      </div>
    );
  }

  const present = Boolean(mine?.present || outcome?.result === 'DUPLICATE');
  const closedText = mine && !mine.open ? (CLOSED_TEXT[String(mine.reason || '')] || 'Absensi mandiri tidak tersedia saat ini.') : '';
  const success = outcome?.result === 'OK';

  return (
    <div className="min-h-[70vh] px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Absensi Mandiri</p>
          <h1 className="text-xl font-black text-[#1B1B1B]">{mine?.event.name || 'Kehadiran Event'}</h1>
          <p className="text-xs text-[#8C8880]">
            Pindai QR di layar panitia. Kehadiran tercatat atas akun <span className="font-bold text-[#1B1B1B]">{authUser.name || authUser.email}</span>.
          </p>
          {!booted && (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-[#8C8880]">
              <Loader2 className="w-3 h-3 animate-spin" /> Memeriksa status…
            </p>
          )}
          {present && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-800">
                <CheckCircle2 className="w-4 h-4" /> Sudah tercatat hadir
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700">
                {mine?.checkedInAt
                  ? `Sejak ${wibTime(mine.checkedInAt)} WIB.`
                  : 'Tidak perlu memindai ulang.'}
              </p>
            </div>
          )}
          {closedText && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Clock className="w-3.5 h-3.5" /> {closedText}
              </p>
              {mine?.validFrom && mine?.validTo && (
                <p className="mt-1 text-[10px] text-amber-700">
                  Jendela absensi: {wibTime(mine.validFrom)} – {wibTime(mine.validTo)} WIB.
                </p>
              )}
            </div>
          )}
        </div>

        {outcome && (
          <div className={`rounded-[28px] border p-5 ${
            success || outcome.result === 'DUPLICATE'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-red-200 bg-red-50'
          }`}>
            <p className="inline-flex items-center gap-2 text-sm font-black text-[#1B1B1B]">
              {success || outcome.result === 'DUPLICATE'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                : <XCircle className="w-4 h-4 text-red-600" />}
              {attendanceResultTitle(outcome.result)}
            </p>
            <p className="mt-1 text-[11px] text-[#5C5850] leading-relaxed">{outcome.message}</p>
          </div>
        )}

        {!present && mine?.open && (
          <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setCameraOn((v) => !v); setOutcome(null); }}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B1B1B] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {cameraOn ? 'Tutup kamera' : 'Buka kamera & pindai QR'}
              </button>
              {cameraOn && (
                <div className="overflow-hidden rounded-2xl border border-[#EFEDE8] bg-black">
                  <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
                </div>
              )}
              {cameraError && <p className="text-[11px] text-red-600">{cameraError}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">
                Kamera bermasalah? Masukkan PIN dari layar panitia
              </label>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6 digit"
                  className="flex-1 rounded-xl border border-[#D9D7D0] px-3 py-2.5 text-sm font-black tracking-[0.3em] outline-none focus:border-[#1B1B1B]"
                />
                <button
                  type="button"
                  onClick={() => void submit(isAttendancePin(manual) ? { pin: manual } : { token: manual.trim() })}
                  disabled={busy || manual.length !== 6}
                  className="rounded-xl border border-[#1B1B1B] px-4 py-2.5 text-xs font-bold text-[#1B1B1B] disabled:opacity-40"
                >
                  Kirim
                </button>
              </div>
              <p className="text-[10px] text-[#8C8880]">PIN berganti tiap 30 detik mengikuti QR di layar.</p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
            >
              <RefreshCw className="w-3 h-3" /> Muat ulang status
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
