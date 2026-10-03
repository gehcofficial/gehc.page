import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';

const MAX_FILES = 5;

/**
 * Galeri Acara — peserta terdaftar berbagi foto hari-H.
 * Masuk sebagai PENDING (kurasi Marturia); tampil publik setelah disetujui.
 */
export const EventPhotoShare: React.FC<{ eventId: string; eventName: string }> = ({ eventId, eventName }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/')).slice(0, MAX_FILES - files.length);
    if (!imgs.length) return;
    setFiles((prev) => [...prev, ...imgs].slice(0, MAX_FILES));
    setPreview((prev) => [...prev, ...imgs.map((f) => URL.createObjectURL(f))].slice(0, MAX_FILES));
    setMsg('');
  };

  const remove = (i: number) => {
    setFiles((prev) => prev.filter((_, x) => x !== i));
    setPreview((prev) => {
      try { URL.revokeObjectURL(prev[i]); } catch { /* abaikan */ }
      return prev.filter((_, x) => x !== i);
    });
  };

  const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = () => reject(new Error('Gagal membaca file.'));
    r.readAsDataURL(f);
  });

  const upload = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setMsg('');
    let ok = 0;
    for (const f of files) {
      try {
        if (f.size > 8_000_000) throw new Error(`${f.name} melebihi 8MB.`);
        const data = await toBase64(f);
        const r = await fetch('/api/gallery/jemaat', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, filename: f.name, mimetype: f.type, data }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Gagal mengunggah.');
        ok += 1;
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Gagal mengunggah.');
        break;
      }
    }
    setDone((n) => n + ok);
    setFiles([]);
    setPreview([]);
    if (inputRef.current) inputRef.current.value = '';
    if (ok && !msg) setMsg(`${ok} foto terkirim — menunggu kurasi Marturia. Terima kasih!`);
    setBusy(false);
  };

  return (
    <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-brand flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5" /> Galeri Acara
      </p>
      <p className="text-xs text-[#5C5850] leading-relaxed">
        Punya foto {eventName}? Bagikan di sini — tampil di Warta setelah dikurasi Marturia.
        {done > 0 && <span className="font-bold"> ({done} terkirim)</span>}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      {preview.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {preview.map((src, i) => (
            <div key={src} className="relative aspect-square rounded-xl overflow-hidden bg-[#F3F1EC]">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs font-black"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || files.length >= MAX_FILES}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-bold hover:bg-white disabled:opacity-40"
        >
          <ImagePlus className="w-3.5 h-3.5" /> Pilih foto ({files.length}/{MAX_FILES})
        </button>
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => void upload()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1B1B1B] text-white text-xs font-black uppercase disabled:opacity-40"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Kirim
          </button>
        )}
      </div>
      {msg && <p className="text-[11px] font-bold text-[#5C5850]">{msg}</p>}
    </div>
  );
};
