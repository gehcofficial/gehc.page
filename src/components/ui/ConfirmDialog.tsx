import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'gold';
  /** Bila diisi, pengguna harus mengetik teks ini untuk mengaktifkan tombol konfirmasi. */
  requireText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const TONE: Record<string, string> = {
  default: 'bg-[#181818] text-white',
  danger: 'bg-red-600 text-white',
  gold: 'bg-[#C9A227] text-[#181818]',
};

/** Modal konfirmasi reusable — aksi mengubah data tidak berjalan sebelum dikonfirmasi. */
export const ConfirmDialog: React.FC<Props> = ({
  open,
  title,
  description,
  confirmLabel = 'Lanjut',
  cancelLabel = 'Batal',
  tone = 'default',
  requireText,
  busy = false,
  onConfirm,
  onClose,
}) => {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const matches = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label={cancelLabel} onClick={() => { if (!busy) onClose(); }} />
      <div className="relative w-full max-w-md rounded-[24px] bg-white border border-[#D9D7D0] shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
            <AlertTriangle className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-[#1B1B1B]">{title}</h3>
            {description ? <div className="text-xs text-[#5C5850] mt-1 leading-relaxed">{description}</div> : null}
          </div>
        </div>

        {requireText ? (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
              Ketik <span className="text-[#1B1B1B]">{requireText}</span> untuk konfirmasi
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm tracking-wider uppercase"
              autoFocus
            />
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-2 rounded-xl text-xs font-bold text-[#8C8880] hover:bg-[#FAF9F5] disabled:opacity-40">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy || !matches}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40 ${TONE[tone] || TONE.default}`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
