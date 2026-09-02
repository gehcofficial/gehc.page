import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ClipboardPaste, Download, Loader2, QrCode, UserPlus, XCircle } from 'lucide-react';

type ScanResult = 'OK' | 'DUPLICATE' | 'UNKNOWN' | 'MISMATCH' | 'WALK_IN';

type ScanRow = {
  id: string;
  result: ScanResult;
  code: string;
  scannedAt: string;
  scannedById: string;
  waitingPoolId?: string | null;
  userName?: string | null;
};

type Stats = {
  registered: number;
  checkedIn: number;
  ok: number;
  duplicate: number;
  unknown: number;
  mismatch: number;
  walkIn: number;
};

const RESULT_STYLE: Record<ScanResult, string> = {
  OK: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  DUPLICATE: 'bg-amber-50 border-amber-200 text-amber-800',
  UNKNOWN: 'bg-red-50 border-red-200 text-red-800',
  MISMATCH: 'bg-red-50 border-red-200 text-red-800',
  WALK_IN: 'bg-blue-50 border-blue-200 text-blue-800',
};

export const EventCheckInTab: React.FC<{ eventId: string; eventName: string }> = ({ eventId, eventName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cooldownRef = useRef(0);
  const busyRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [walkName, setWalkName] = useState('');
  const [walkPhone, setWalkPhone] = useState('');
  const [flash, setFlash] = useState<{ result: ScanResult; message: string; name?: string } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/check-ins`, { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    setStats(d.stats);
    setScans(d.scans || []);
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    load().catch(() => null).finally(() => setLoading(false));
    const t = setInterval(() => { load().catch(() => null); }, 8000);
    return () => clearInterval(t);
  }, [load]);

  const submitCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/check-in`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const d = await r.json();
      setFlash({ result: d.result || 'UNKNOWN', message: d.message || d.error || 'Gagal', name: d.name });
      await load();
    } catch (e: any) {
      setFlash({ result: 'UNKNOWN', message: e.message || 'Gagal scan' });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setManual('');
    }
  }, [eventId, load]);

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        video.srcObject = stream;
        await video.play();
        setCameraError('');
        if (!Detector) {
          setCameraError('Browser ini tidak baca QR otomatis. Tempel kode manual di bawah.');
          return;
        }
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stopped) return;
          try {
            if (Date.now() > cooldownRef.current && video.readyState >= 2) {
              const codes = await detector.detect(video);
              const value = codes[0]?.rawValue;
              if (value) {
                cooldownRef.current = Date.now() + 2500;
                submitCode(value);
              }
            }
          } catch { /* skip frame */ }
          raf = requestAnimationFrame(() => { void tick(); });
        };
        raf = requestAnimationFrame(() => { void tick(); });
      } catch (e: any) {
        setCameraError(e?.message || 'Kamera tidak bisa dibuka.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [cameraOn, submitCode]);

  const submitWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkName.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/check-in/walk-in`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: walkName.trim(), phone: walkPhone.trim() }),
      });
      const d = await r.json();
      setFlash({ result: d.result || 'WALK_IN', message: d.message || d.error || 'Walk-in dicatat', name: d.name });
      setWalkName('');
      setWalkPhone('');
      await load();
    } catch (e: any) {
      setFlash({ result: 'UNKNOWN', message: e.message || 'Gagal walk-in' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    const header = 'waktu,hasil,nama,kode\n';
    const rows = scans.map((s) =>
      [s.scannedAt, s.result, s.userName || '', s.code.replace(/,/g, ' ')].join(','),
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `check-in-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-[#1B1B1B]">Check-in hari H</h4>
          <p className="text-xs text-[#8C8880]">{eventName} · Koinonia (Persekutuan & Integrasi)</p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-semibold text-[#5C5850]"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Terdaftar', value: stats.registered },
            { label: 'Sudah masuk', value: stats.checkedIn },
            { label: 'Scan OK', value: stats.ok },
            { label: 'Walk-in', value: stats.walkIn },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-[#D9D7D0] bg-white px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">{c.label}</p>
              <p className="text-lg font-black text-[#1B1B1B]">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {flash && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${RESULT_STYLE[flash.result]}`}>
          <p>{flash.result}{flash.name ? ` · ${flash.name}` : ''}</p>
          <p className="text-xs font-medium mt-0.5">{flash.message}</p>
        </div>
      )}

      <div className="rounded-2xl border border-[#D9D7D0] bg-[#FAF9F5] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880] flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5" /> Kamera
          </p>
          <button
            type="button"
            onClick={() => setCameraOn((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D9D7D0] text-xs font-semibold"
          >
            {cameraOn ? <><XCircle className="w-3.5 h-3.5" /> Tutup</> : <><Camera className="w-3.5 h-3.5" /> Buka kamera</>}
          </button>
        </div>
        {cameraOn && (
          <video ref={videoRef} className="w-full max-h-72 rounded-xl bg-black object-cover" playsInline muted />
        )}
        {cameraError && <p className="text-xs text-amber-700">{cameraError}</p>}

        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); submitCode(manual); }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Tempel kode GEHC-BT|… di sini"
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-mono"
          />
          <button
            type="submit"
            disabled={busy || !manual.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
            Scan
          </button>
        </form>
      </div>

      <form onSubmit={submitWalkIn} className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#8C8880] flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5" /> Walk-in (tanpa QR)
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={walkName}
            onChange={(e) => setWalkName(e.target.value)}
            placeholder="Nama"
            className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
          />
          <input
            value={walkPhone}
            onChange={(e) => setWalkPhone(e.target.value)}
            placeholder="HP (opsional, untuk cocokkan daftar)"
            className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !walkName.trim()}
          className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50"
        >
          Catat walk-in
        </button>
      </form>

      <div className="rounded-2xl border border-[#D9D7D0] overflow-hidden">
        <div className="px-4 py-2 bg-[#FAF9F5] text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
          Riwayat scan
        </div>
        {loading && <p className="p-4 text-xs text-[#8C8880]">Memuat…</p>}
        {!loading && scans.length === 0 && <p className="p-4 text-xs text-[#8C8880]">Belum ada scan.</p>}
        <ul className="divide-y divide-[#EFEDE8] max-h-80 overflow-y-auto">
          {scans.slice(0, 80).map((s) => (
            <li key={s.id} className="px-4 py-2 flex items-center justify-between gap-2 text-xs">
              <div>
                <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${RESULT_STYLE[s.result] || ''}`}>{s.result}</span>
                <span className="ml-2 text-[#1B1B1B] font-semibold">{s.userName || '—'}</span>
                <p className="font-mono text-[10px] text-[#8C8880] mt-0.5 break-all">{s.code}</p>
              </div>
              <span className="text-[10px] text-[#8C8880] shrink-0">
                {new Date(s.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
