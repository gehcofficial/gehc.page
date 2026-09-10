import React, { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

type Props = {
  code: string;
  compact?: boolean;
  label?: string;
};

export const CopyCodeField: React.FC<Props> = ({ code, compact = false, label = 'Kode daftar ulang' }) => {
  const [copied, setCopied] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // fallback iOS lama
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // haptic ringan bila tersedia
      try { (navigator as unknown as { vibrate?: (n: number) => void }).vibrate?.(30); } catch {}
    } catch {
      // diam
    }
  };

  const shareWA = () => {
    const text = `${label}: ${code}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setShareFailed(true);
      setTimeout(() => setShareFailed(false), 2000);
    }
  };

  return (
    <div className={`rounded-xl border border-emerald-200 bg-emerald-50/40 ${compact ? 'p-2' : 'p-3'} space-y-2`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{label}</p>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[10px] font-mono text-[#1B1B1B] break-all bg-white rounded-lg border border-emerald-100 px-2 py-2 leading-relaxed select-all">
          {code}
        </p>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void copy()}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-colors ${
              copied ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
            aria-label="Salin kode"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin' : 'Salin'}
          </button>
          <button
            type="button"
            onClick={shareWA}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
            aria-label="Kirim via WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            WA
          </button>
        </div>
      </div>
      {shareFailed && <p className="text-[10px] text-red-600">Gagal membuka WhatsApp.</p>}
      <p className="text-[10px] text-[#8C8880] leading-relaxed">Jika kamera panitia bermasalah, salin kode ini dan kirim ke panitia untuk input manual di kolom “Tempel kode”.</p>
    </div>
  );
};
