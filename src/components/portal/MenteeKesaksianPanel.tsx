import React, { useEffect, useState } from 'react';
import { Loader2, MessageSquareQuote } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DriveUploadButton } from './DriveUploadButton';
import { PanelGuide } from './PanelGuide';
import { useLang } from '../../context/LangContext';

type Item = {
  id: string;
  quote: string;
  status?: string;
  isPublished?: boolean;
  groupName?: string | null;
};

function statusLabel(item: Item) {
  if (item.isPublished || item.status === 'PUBLISHED') return 'Live';
  if (item.status === 'REVIEW') return 'Review';
  return 'Draft';
}

export const MenteeKesaksianPanel: React.FC = () => {
  const { addToast, userAssignedGroupId, groups } = useApp();
  const { t } = useLang();
  const [quote, setQuote] = useState('');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ data: string; mimetype: string; filename: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const groupName = groups.find((g) => g.id === userAssignedGroupId)?.name || null;

  const load = async () => {
    const r = await fetch('/api/me/testimonials', { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    setItems(d.items || []);
  };

  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  const submit = async () => {
    if (!quote.trim()) return;
    setBusy(true);
    try {
      const url = editingId ? `/api/me/testimonials/${editingId}` : '/api/me/testimonial';
      const r = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote: quote.trim(),
          groupName,
          ...(photo || {}),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        addToast({ type: 'error', title: d.error || 'Gagal kirim kesaksian' });
        return;
      }
      setQuote('');
      setPhoto(null);
      setEditingId(null);
      addToast({ type: 'success', title: editingId ? 'Draf diperbarui' : 'Draf kesaksian terkirim ke Marturia' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-[#1B1B1B] flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-[#FF416C]" />
          {t.portal.nav.kesaksian}
        </h2>
        <p className="text-sm text-[#8C8880] mt-1">{t.portal.guides.kesaksian.purpose}</p>
      </div>

      <PanelGuide guideId="kesaksian" />

      <div className="rounded-[24px] border border-[#D9D7D0]/50 bg-white p-4 space-y-3">
        <p className="text-xs font-bold">{editingId ? 'Ubah draf' : 'Tulis kesaksian'}</p>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={5}
          placeholder="Tuliskan kesaksian singkat…"
          className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-sm"
        />
        <DriveUploadButton
          label={photo ? 'Foto draf siap' : 'Foto opsional (inbox Marturia)'}
          onFile={async (payload) => setPhoto(payload)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !quote.trim()}
            onClick={() => void submit()}
            className="px-4 py-2 rounded-full bg-[#181818] text-white text-xs font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingId ? 'Simpan draf' : 'Kirim draf'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setQuote(''); setPhoto(null); }}
              className="px-4 py-2 rounded-full border border-[#D9D7D0] text-xs font-bold"
            >
              Batal
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-[#D9D7D0] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                item.isPublished || item.status === 'PUBLISHED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : item.status === 'REVIEW'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-700'
              }`}>
                {statusLabel(item)}
              </span>
              {item.status === 'DRAFT' && !item.isPublished && (
                <button
                  type="button"
                  className="text-[11px] font-bold text-[#8C8880]"
                  onClick={() => { setEditingId(item.id); setQuote(item.quote); }}
                >
                  Ubah
                </button>
              )}
            </div>
            <p className="text-sm text-[#1B1B1B] mt-2 whitespace-pre-wrap">{item.quote}</p>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-[#8C8880]">Belum ada kesaksian. Tulis draf di atas.</li>
        )}
      </ul>
    </div>
  );
};
