import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  Church,
  Share2,
  CheckCircle2,
  AlertCircle,
  Images,
  Upload,
  FolderPlus,
  ExternalLink,
} from 'lucide-react';

type Schedule = { label: string; day: string; time: string };
type Socials = { instagram?: string; facebook?: string; tiktok?: string; youtube?: string };
type Profile = {
  name: string;
  tagline: string;
  description: string;
  addressText: string;
  mapShareUrl: string;
  mapEmbedQuery: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  schedules: Schedule[];
  socials: Socials;
};
type Tenant = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  tagline: string | null;
  contactEmail: string | null;
  socials: Socials | null;
  isActive: boolean;
};
type UnitDraft = { tagline: string; contactEmail: string; socials: Socials };
type GalleryPhoto = { id: string; name: string; thumbnailUrl: string; viewUrl: string };

/** Kompres gambar di klien (maks sisi terpanjang) sebelum unggah. */
async function fileToJpegDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Gagal membaca file'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Gagal memuat gambar'));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(1, Math.round((img.width || 1) * scale));
  const h = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

const SOCIAL_FIELDS: { key: keyof Socials; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
];

const EMPTY_PROFILE: Profile = {
  name: 'GMIM Eben Haezer Cikarang',
  tagline: '',
  description: '',
  addressText: '',
  mapShareUrl: '',
  mapEmbedQuery: '',
  contactEmail: '',
  contactPhone: '',
  whatsapp: '',
  schedules: [],
  socials: {},
};

const inputCls =
  'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#FF416C]';
const labelCls = 'text-[11px] font-bold uppercase tracking-wider text-[#8C8880]';

const ManageChurchInfo: React.FC = () => {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UnitDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryFolderUrl, setGalleryFolderUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadGallery = async () => {
    try {
      const d = await fetch('/api/hub/gallery').then((r) => r.json());
      setPhotos(Array.isArray(d?.files) ? d.files : []);
      setGalleryFolderUrl(d?.viewUrl || null);
    } catch {
      setPhotos([]);
    } finally {
      setGalleryLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, tRes] = await Promise.all([
          fetch('/api/church-profile').then((r) => r.json()),
          fetch('/api/tenants').then((r) => r.json()),
        ]);
        if (!alive) return;
        const p = pRes?.profile || {};
        setProfile({
          ...EMPTY_PROFILE,
          ...p,
          description: p.description || '',
          tagline: p.tagline || '',
          addressText: p.addressText || '',
          mapShareUrl: p.mapShareUrl || '',
          mapEmbedQuery: p.mapEmbedQuery || '',
          contactEmail: p.contactEmail || '',
          contactPhone: p.contactPhone || '',
          whatsapp: p.whatsapp || '',
          schedules: Array.isArray(p.schedules) ? p.schedules : [],
          socials: p.socials && typeof p.socials === 'object' ? p.socials : {},
        });
        const list: Tenant[] = Array.isArray(tRes?.tenants) ? tRes.tenants : [];
        setTenants(list);
        setDrafts(
          Object.fromEntries(
            list.map((t) => [
              t.slug,
              {
                tagline: t.tagline || '',
                contactEmail: t.contactEmail || '',
                socials: t.socials && typeof t.socials === 'object' ? { ...t.socials } : {},
              },
            ]),
          ),
        );
      } catch {
        if (alive) setMessage({ kind: 'err', text: 'Gagal memuat info gereja.' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadPhotos = async (files: FileList) => {
    if (!files.length) return;
    setGalleryBusy(true);
    setMessage(null);
    try {
      let done = 0;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const data = await fileToJpegDataUrl(file);
        const r = await fetch('/api/hub/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, filename: file.name }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d?.error || 'Gagal mengunggah.');
        }
        done += 1;
      }
      await loadGallery();
      setMessage({ kind: 'ok', text: `${done} foto diunggah.` });
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal mengunggah.' });
    } finally {
      setGalleryBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deletePhoto = async (id: string) => {
    setGalleryBusy(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/hub/gallery/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || 'Gagal menghapus.');
      }
      await loadGallery();
      setMessage({ kind: 'ok', text: 'Foto dihapus.' });
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus.' });
    } finally {
      setGalleryBusy(false);
    }
  };

  const ensureGalleryFolder = async () => {
    setGalleryBusy(true);
    setMessage(null);
    try {
      const r = await fetch('/api/hub/gallery/ensure-folder', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal membuat folder.');
      setGalleryFolderUrl(d?.viewUrl || null);
      await loadGallery();
      setMessage({ kind: 'ok', text: 'Folder galeri siap.' });
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal membuat folder.' });
    } finally {
      setGalleryBusy(false);
    }
  };

  const setField = (key: keyof Profile, value: string) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const setSocial = (key: keyof Socials, value: string) =>
    setProfile((p) => ({ ...p, socials: { ...p.socials, [key]: value } }));

  const setSchedule = (idx: number, key: keyof Schedule, value: string) =>
    setProfile((p) => ({
      ...p,
      schedules: p.schedules.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
    }));

  const addSchedule = () =>
    setProfile((p) => ({ ...p, schedules: [...p.schedules, { label: '', day: '', time: '' }] }));

  const removeSchedule = (idx: number) =>
    setProfile((p) => ({ ...p, schedules: p.schedules.filter((_, i) => i !== idx) }));

  const saveChurch = async () => {
    setSaving('church');
    setMessage(null);
    try {
      const r = await fetch('/api/church-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan.');
      setMessage({ kind: 'ok', text: 'Info gereja tersimpan.' });
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan.' });
    } finally {
      setSaving(null);
    }
  };

  const setUnitField = (slug: string, key: 'tagline' | 'contactEmail', value: string) =>
    setDrafts((d) => ({ ...d, [slug]: { ...d[slug], [key]: value } }));

  const setUnitSocial = (slug: string, key: keyof Socials, value: string) =>
    setDrafts((d) => ({ ...d, [slug]: { ...d[slug], socials: { ...d[slug].socials, [key]: value } } }));

  const saveUnit = async (slug: string) => {
    setSaving(slug);
    setMessage(null);
    try {
      const r = await fetch(`/api/tenants/${slug}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drafts[slug]),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan.');
      setMessage({ kind: 'ok', text: `Unit ${slug} tersimpan.` });
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan.' });
    } finally {
      setSaving(null);
    }
  };

  const activeTenants = useMemo(() => tenants, [tenants]);

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-sm text-[#8C8880]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat info gereja…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF416C] to-[#FF4B2B] flex items-center justify-center">
          <Church className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#1B1B1B]">Info Gereja</h2>
          <p className="text-xs text-[#8C8880]">
            Profil, kontak, jadwal, dan sosial media gereja serta tiap unit pelayanan.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            message.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Church-wide */}
      <section className="rounded-[24px] border border-[#D9D7D0] bg-white p-5 space-y-4">
        <h3 className="font-bold text-sm text-[#1B1B1B]">Profil Gereja</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 sm:col-span-2">
            <span className={labelCls}>Nama gereja</span>
            <input className={inputCls} value={profile.name} onChange={(e) => setField('name', e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className={labelCls}>Tagline</span>
            <input className={inputCls} value={profile.tagline} onChange={(e) => setField('tagline', e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className={labelCls}>Deskripsi singkat</span>
            <textarea
              className={`${inputCls} min-h-[80px]`}
              value={profile.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className={labelCls}>Alamat</span>
            <textarea
              className={`${inputCls} min-h-[60px]`}
              value={profile.addressText}
              onChange={(e) => setField('addressText', e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>Link Google Maps (share)</span>
            <input className={inputCls} value={profile.mapShareUrl} onChange={(e) => setField('mapShareUrl', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>Query label peta (embed)</span>
            <input className={inputCls} value={profile.mapEmbedQuery} onChange={(e) => setField('mapEmbedQuery', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>Email kontak</span>
            <input className={inputCls} value={profile.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>Telepon / WA</span>
            <input className={inputCls} value={profile.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={labelCls}>WhatsApp</span>
            <input className={inputCls} value={profile.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} />
          </label>
        </div>

        {/* Socials */}
        <div className="pt-2">
          <p className={`${labelCls} mb-2`}>Sosial media gereja</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SOCIAL_FIELDS.map(({ key, label }) => (
              <label key={key} className="space-y-1">
                <span className="text-[11px] text-[#8C8880]">{label}</span>
                <input
                  className={inputCls}
                  placeholder={`https://…`}
                  value={profile.socials[key] || ''}
                  onChange={(e) => setSocial(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Schedules */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <p className={labelCls}>Jadwal ibadah</p>
            <button
              type="button"
              onClick={addSchedule}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF416C]"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </div>
          <div className="space-y-2">
            {profile.schedules.length === 0 && (
              <p className="text-xs text-[#8C8880]">Belum ada jadwal.</p>
            )}
            {profile.schedules.map((s, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <input className={inputCls} placeholder="Label" value={s.label} onChange={(e) => setSchedule(idx, 'label', e.target.value)} />
                <input className={inputCls} placeholder="Hari" value={s.day} onChange={(e) => setSchedule(idx, 'day', e.target.value)} />
                <input className={inputCls} placeholder="Jam" value={s.time} onChange={(e) => setSchedule(idx, 'time', e.target.value)} />
                <button
                  type="button"
                  onClick={() => removeSchedule(idx)}
                  className="p-2 rounded-lg text-[#8C8880] hover:bg-red-50 hover:text-red-600"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={saveChurch}
            disabled={saving === 'church'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60"
          >
            {saving === 'church' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Info Gereja
          </button>
        </div>
      </section>

      {/* Units */}
      <section className="rounded-[24px] border border-[#D9D7D0] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-[#FF416C]" />
          <h3 className="font-bold text-sm text-[#1B1B1B]">Kontak & Sosial per Unit</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {activeTenants.map((t) => {
            const draft = drafts[t.slug] || { tagline: '', contactEmail: '', socials: {} };
            return (
              <div key={t.id} className="rounded-2xl border border-[#E9E8E4] bg-[#FAF9F5] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#1B1B1B]">{t.name}</p>
                    <p className="text-[11px] text-[#8C8880]">{t.domain || t.slug}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      t.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-[#F3F1EC] text-[#8C8880]'
                    }`}
                  >
                    {t.isActive ? 'Aktif' : 'Segera'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#8C8880]">Tagline</span>
                    <input className={inputCls} value={draft.tagline} onChange={(e) => setUnitField(t.slug, 'tagline', e.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#8C8880]">Email</span>
                    <input className={inputCls} value={draft.contactEmail} onChange={(e) => setUnitField(t.slug, 'contactEmail', e.target.value)} />
                  </label>
                  {SOCIAL_FIELDS.map(({ key, label }) => (
                    <label key={key} className="space-y-1">
                      <span className="text-[11px] text-[#8C8880]">{label}</span>
                      <input
                        className={inputCls}
                        value={draft.socials[key] || ''}
                        onChange={(e) => setUnitSocial(t.slug, key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => saveUnit(t.slug)}
                  disabled={saving === t.slug}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1B1B1B] text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-60"
                >
                  {saving === t.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Simpan {t.slug}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Galeri hub */}
      <section className="rounded-[24px] border border-[#D9D7D0] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-[#FF416C]" />
            <h3 className="font-bold text-sm text-[#1B1B1B]">Galeri Hub (gehc.page)</h3>
          </div>
          <div className="flex items-center gap-2">
            {galleryFolderUrl && (
              <a
                href={galleryFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
              >
                Buka di Drive <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={ensureGalleryFolder}
              disabled={galleryBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#D9D7D0] text-[11px] font-bold uppercase tracking-wider hover:bg-[#FAF9F5] disabled:opacity-60"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Buat folder
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={galleryBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-60"
            >
              {galleryBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Unggah foto
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadPhotos(e.target.files);
              }}
            />
          </div>
        </div>
        <p className="text-xs text-[#8C8880]">
          Foto publik untuk carousel di hub <strong>gehc.page</strong>. Muncul bila ada ≥4 foto.
        </p>

        {galleryLoading ? (
          <div className="py-8 flex items-center justify-center text-sm text-[#8C8880]">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat galeri…
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D9D7D0] bg-[#FAF9F5] p-8 text-center">
            <p className="text-xs text-[#8C8880]">
              Belum ada foto. Klik <strong>Buat folder</strong> lalu <strong>Unggah foto</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div key={p.id} className="relative group rounded-2xl overflow-hidden bg-[#F3F1EC] aspect-[4/5]">
                <img
                  src={p.thumbnailUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <button
                  type="button"
                  onClick={() => deletePhoto(p.id)}
                  disabled={galleryBusy}
                  title="Hapus"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ManageChurchInfo;
