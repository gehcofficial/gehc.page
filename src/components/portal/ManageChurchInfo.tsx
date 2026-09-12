import React, { useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Plus, Trash2, Church, Share2, CheckCircle2, AlertCircle } from 'lucide-react';

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
    </div>
  );
};

export default ManageChurchInfo;
