import React, { useState } from 'react';
import { Upload, Loader2, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Drive upload panel — base64 JSON upload to division folder (requires GDRIVE_WRITE=1).
 */
export const DriveUploadPanel: React.FC<{
  eventId: string;
  division: string;
  folderLabel?: string;
}> = ({ eventId, division, folderLabel }) => {
  const { addToast, isKomisi, isSuperAdmin, isCommittee } = useApp();
  const allowed = isSuperAdmin || isKomisi || isCommittee;
  const [busy, setBusy] = useState(false);

  if (!allowed) {
    return (
      <p className="text-xs text-muted">Upload Drive hanya untuk Komisi / Tim Kerja.</p>
    );
  }

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const data = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await fetch(`/api/events/${eventId}/divisions/${division}/drive/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimetype: file.type, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Upload gagal');
      addToast({ type: 'success', title: 'Upload berhasil', description: file.name });
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Upload gagal',
        description: e instanceof Error ? e.message : 'Periksa GDRIVE_WRITE=1 di server.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-line/50 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold">
        <Upload className="w-4 h-4 text-brand" />
        Upload ke Drive {folderLabel ? `— ${folderLabel}` : ''}
      </div>
      <p className="text-[10px] text-muted flex items-start gap-1">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        Membutuhkan folder divisi sudah diprovision + env GDRIVE_WRITE=1.
      </p>
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-page border border-line cursor-pointer text-xs font-bold hover:bg-panel">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Pilih file
        <input
          type="file"
          className="hidden"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
};
