import React, { useCallback, useEffect, useState } from 'react';
import { Cake, Loader2, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';

function renderPreview(caption: string) {
  return caption.split('{nama}').join('Budi').split('{umur}').join('17');
}

/** Panel Komisi: caption + foto ucapan HUT global. Placeholder: {nama} {umur}. */
export const BirthdayWishPanel: React.FC = () => {
  const { addToast } = useApp();
  const [caption, setCaption] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/birthday/wish', { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setCaption(d.caption || '');
      setPhotoUrl(d.photoUrl || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!caption.trim()) {
      addToast({ type: 'error', title: 'Caption wajib diisi.' });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/birthday/wish', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: caption.trim(), photoUrl: photoUrl.trim() || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan.');
      addToast({ type: 'success', title: 'Ucapan HUT disimpan — berlaku mulai cron besok.' });
      await load();
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Gagal menyimpan', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>;
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">
          Teks ucapan (gunakan {'{nama}'} dan {'{umur}'})
        </p>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          placeholder="Selamat ulang tahun, {nama}! Tuhan Yesus memberkati di usia {umur} tahun. 🎉"
          className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
        />
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Foto (opsional, URL https)</p>
        <input
          value={photoUrl}
          onChange={(e) => { setPhotoUrl(e.target.value); setPhotoBroken(false); }}
          placeholder="https://…"
          inputMode="url"
          className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-mono"
        />
        {photoUrl.trim() && !photoBroken && (
          <img
            src={photoUrl.trim()}
            alt="Pratinjau foto ucapan"
            className="w-full max-h-40 object-cover rounded-xl border border-[#D9D7D0]"
            onError={() => setPhotoBroken(true)}
          />
        )}
        {photoUrl.trim() && photoBroken && (
          <p className="text-[10px] font-bold text-red-600">URL tidak bisa dimuat — periksa tautan.</p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !caption.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan ucapan'}
        </button>
      </div>
      <div className="rounded-2xl border border-pink-200 bg-pink-50/60 p-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-pink-700 flex items-center gap-1.5">
          <Cake className="w-3.5 h-3.5" /> Pratinjau penerima
        </p>
        {photoUrl.trim() && !photoBroken && (
          <img src={photoUrl.trim()} alt="" className="w-full max-h-44 object-cover rounded-xl" onError={() => setPhotoBroken(true)} />
        )}
        <p className="text-sm font-bold text-[#1B1B1B]">Selamat ulang tahun, Budi! 🎉</p>
        <p className="text-xs text-[#5C5850] leading-relaxed whitespace-pre-wrap">{renderPreview(caption) || '…'}</p>
      </div>
    </div>
  );
};
