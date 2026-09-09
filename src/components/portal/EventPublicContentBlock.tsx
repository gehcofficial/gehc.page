import React, { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import type { ContentItem } from '../../types';

/**
 * Konten publik per event (by-event) — yang tampil di landing tab Kegiatan.
 * Ditulis Komisi atau divisi Marturia event ini. Hanya field yang dipakai
 * landing; tanggal & tempat ikut EventProgram (read-only di sini).
 */
export const EventPublicContentBlock: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast, upsertContentItem } = useApp();
  const slots = useMediaSlots();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [eventInfo, setEventInfo] = useState<{ name: string; status: string; eventDate?: string | null; venueName?: string | null; locationDetail?: string | null } | null>(null);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    category: '',
    bannerMode: 'slot-default',
    bannerUrl: '',
    body: '',
    isFeaturedEvent: false,
    isPublished: true,
  });

  const slotOptions = [
    { id: 'slot-default', label: 'Banner default kegiatan', url: slots.kegiatan?.bannerDefault || '' },
    { id: 'slot-bakutau', label: 'Banner BAKU TAU', url: slots.kegiatan?.bakuTau || '' },
    { id: 'custom', label: 'URL kustom…', url: '' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/content`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat konten publik.');
      setCanEdit(d.canEdit === true);
      setCategories(d.categories || []);
      setEventInfo(d.event || null);
      const item = d.item as ContentItem | null;
      setItemId(item?.id || null);
      const bannerUrl = item?.bannerUrl || '';
      const match = slotOptions.find((o) => o.id !== 'custom' && o.url && o.url === bannerUrl);
      setForm({
        title: item?.title || '',
        subtitle: item?.subtitle || '',
        category: item?.category || d.categories?.[0] || '',
        bannerMode: match ? match.id : bannerUrl ? 'custom' : 'slot-default',
        bannerUrl,
        body: item?.body || '',
        isFeaturedEvent: Boolean(item?.is_featured_event),
        isPublished: item ? Boolean(item.is_published) : true,
      });
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Gagal memuat konten publik', description: e instanceof Error ? e.message : '' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const effectiveBanner = form.bannerMode === 'custom'
    ? form.bannerUrl.trim()
    : slotOptions.find((o) => o.id === form.bannerMode)?.url || '';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      addToast({ type: 'error', title: 'Judul wajib.' });
      return;
    }
    if (form.isPublished && !effectiveBanner) {
      addToast({ type: 'error', title: 'Banner wajib untuk diterbitkan (draf boleh kosong).' });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/content`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          category: form.category,
          bannerUrl: effectiveBanner,
          body: form.body.trim(),
          isFeaturedEvent: form.isFeaturedEvent,
          isPublished: form.isPublished,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan.');
      // Sinkron ke state global agar landing + panel agenda ikut segar.
      const saved = d.item as ContentItem;
      setItemId(saved.id);
      upsertContentItem(saved);
      addToast({ type: 'success', title: 'Konten publik disimpan' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Gagal menyimpan', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat konten publik…</p>;
  }

  const eventWhen = eventInfo?.eventDate
    ? new Date(eventInfo.eventDate).toLocaleString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    })
    : '—';

  return (
    <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 space-y-3">
      <div>
        <h3 className="text-sm font-black text-[#1B1B1B]">Konten publik (landing Kegiatan)</h3>
        <p className="text-[10px] text-[#8C8880] mt-0.5 leading-relaxed">
          Ditulis Komisi atau divisi Marturia event ini. Tanggal & tempat ikut data event di atas — tidak diisi ulang di sini.
        </p>
      </div>

      <div className="rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]/60 px-3 py-2 text-[11px] text-[#8C8880]">
        {eventInfo?.name} · {eventWhen} WIB · {[eventInfo?.venueName, eventInfo?.locationDetail].filter(Boolean).join(' · ') || 'Tempat menyusul'}
      </div>

      {(!itemId || !form.isPublished) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-800">
          Belum tampil di landing — lengkapi judul + banner lalu centang Terbit di bawah.
        </div>
      )}

      {!canEdit ? (
        <p className="text-xs text-[#8C8880]">
          {itemId ? 'Konten sudah terisi (hanya-baca untuk peranmu).' : 'Belum ada konten publik. Minta Komisi / Marturia mengisinya.'}
        </p>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Judul publik *</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Contoh: BAKU TAU 4.0 — Bakudapa di Rantau"
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Tagline</span>
            <input
              value={form.subtitle}
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              placeholder="Satu kalimat ajakan"
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Kategori</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-white"
              >
                {(categories.length ? categories : [form.category]).filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Banner</span>
              <select
                value={form.bannerMode}
                onChange={(e) => setForm((f) => ({ ...f, bannerMode: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm bg-white"
              >
                {slotOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          {form.bannerMode === 'custom' && (
            <input
              value={form.bannerUrl}
              onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))}
              placeholder="https://…"
              inputMode="url"
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm font-mono"
            />
          )}
          {effectiveBanner && (
            <div className="flex items-center gap-2 rounded-xl overflow-hidden border border-[#D9D7D0]/60 bg-[#FAF9F5] p-2">
              <img src={effectiveBanner} alt="Pratinjau banner" className="w-20 h-12 object-cover rounded-lg" />
              <span className="text-[10px] text-[#8C8880] inline-flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Pratinjau banner landing
              </span>
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">Deskripsi (opsional)</span>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={3}
              placeholder="Ringkasan untuk pembaca"
              className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-1.5 text-xs text-[#1B1B1B]">
              <input
                type="checkbox"
                checked={form.isFeaturedEvent}
                onChange={(e) => setForm((f) => ({ ...f, isFeaturedEvent: e.target.checked }))}
              />
              Kartu unggulan
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-[#1B1B1B]">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              />
              Terbit di landing
            </label>
            <button
              type="submit"
              disabled={saving || !form.title.trim() || (form.isPublished && !effectiveBanner)}
              className="ml-auto px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-40"
            >
              {saving ? 'Menyimpan…' : 'Simpan konten'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
