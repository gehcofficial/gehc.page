import React, { useRef, useState } from 'react';
import { Camera, Loader2, FolderOpen } from 'lucide-react';

type Props = {
  label?: string;
  accept?: string;
  disabled?: boolean;
  driveUrl?: string | null;
  onFile: (payload: { data: string; mimetype: string; filename: string }) => Promise<void> | void;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Gagal membaca file.'));
    r.readAsDataURL(file);
  });
}

export const DriveUploadButton: React.FC<Props> = ({
  label = 'Ganti foto',
  accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif',
  disabled,
  driveUrl,
  onFile,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await readAsDataUrl(file);
      await onFile({ data, mimetype: file.type || 'image/jpeg', filename: file.name });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-[#1B1B1B] text-[11px] font-bold hover:bg-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
        {label}
      </button>
      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-white/80 hover:text-white"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Drive
        </a>
      )}
    </div>
  );
};
