import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Camera, Loader2, Mail, RotateCcw, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AddressForm, addressFromUser, emptyAddress } from './AddressForm';
import { ProfileGiftsSection } from './ProfileGiftsSection';
import { ProfileRecreationalSection } from './ProfileRecreationalSection';
import { ProfileChurchDataRequestPanel, type ChurchDataRequest } from './ProfileChurchDataRequestPanel';
import { LinkGoogleCard } from './LinkGoogleCard';
import { displayAvatar } from '../../lib/avatar';
import {
  COMMON_MAJORS,
  LIFE_STATUS_LABEL,
  LIFE_STATUSES,
  profileSegments,
  WORK_INDUSTRIES,
  type LifeStatus,
} from '../../lib/profile';
import { ageFromBirthDate, daysUntilBirthday, formatBirthDateInput, suggestBipra } from '../../lib/demographics';
import type { RecreationalNode } from '../../lib/recreational';

export type ProfileSectionId = 'contact' | 'life' | 'gifts' | 'recreational' | 'emergency';

type PendingSuggestion = {
  id: string;
  name: string;
  kind: string;
  parentId?: string | null;
  status: string;
};

export const MyProfilePanel: React.FC<{
  defaultOpenSection?: ProfileSectionId;
  onGiftSaved?: () => void;
}> = ({ defaultOpenSection, onGiftSaved }) => {
  const { addToast, authUser, refreshAuthUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string; city?: string | null }>>([]);
  const [instSearch, setInstSearch] = useState('');
  const [selectedInst, setSelectedInst] = useState<{ id: string; name: string } | null>(null);
  const [pendingInst, setPendingInst] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [showInstOther, setShowInstOther] = useState(false);
  const [instOther, setInstOther] = useState({ name: '', city: '', country: '' });
  const [majors, setMajors] = useState<string[]>(COMMON_MAJORS);
  const [recFlat, setRecFlat] = useState<RecreationalNode[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingSuggestion[]>([]);
  const [churchDataRequest, setChurchDataRequest] = useState<ChurchDataRequest | null>(null);
  const [kolomList, setKolomList] = useState<Array<{ id: string; number: number; name: string }>>([]);
  const [bipraOptions, setBipraOptions] = useState<string[]>(['BAPAK', 'IBU', 'PEMUDA', 'REMAJA', 'ANAK']);
  const [open, setOpen] = useState<ProfileSectionId>(defaultOpenSection || 'contact');
  const [form, setForm] = useState({
    gender: '',
    phone: '',
    birthDate: '',
    address: emptyAddress(),
    lifeStatuses: [] as string[],
    schoolLevel: '',
    schoolName: '',
    institutionId: '',
    major: '',
    majorOther: '',
    workplaceName: '',
    workIndustry: '',
    workRole: '',
    recreationalIds: [] as string[],
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    emergencyContactAddress: '',
  });
  const [due, setDue] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const fileToJpegDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 900;
        const side = Math.min(img.width, img.height, max);
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        const sx = (img.width - Math.min(img.width, img.height)) / 2;
        const sy = (img.height - Math.min(img.width, img.height)) / 2;
        const crop = Math.min(img.width, img.height);
        ctx.drawImage(img, sx, sy, crop, crop, 0, 0, side, side);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Gagal membaca foto.'));
      };
      img.src = url;
    });

  const applyAvatarUser = async (next: { avatar?: string | null; avatarSource?: string | null }) => {
    setUser((u: any) => (u ? { ...u, ...next } : u));
    await refreshAuthUser();
  };

  const onPickAvatar = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', title: 'Format tidak didukung', description: 'Pakai JPEG, PNG, atau WebP.' });
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await fileToJpegDataUrl(file);
      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimetype: 'image/jpeg', data: dataUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal unggah foto.');
      await applyAvatarUser(body.user || {});
      addToast({
        type: 'success',
        title: 'Foto profil diperbarui',
        description: 'Portal memakai foto baru sekarang. Website publik menyusul setelah publish (~1–3 menit).',
      });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal ganti foto', description: e.message || 'Coba lagi.' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const restoreGoogleAvatar = async () => {
    setAvatarBusy(true);
    try {
      const res = await fetch('/api/me/avatar', { method: 'DELETE', credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Gagal mengembalikan foto Google.');
      await applyAvatarUser(body.user || {});
      addToast({ type: 'success', title: 'Foto Google dikembalikan' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Gagal', description: e.message || 'Coba lagi.' });
    } finally {
      setAvatarBusy(false);
    }
  };

  useEffect(() => {
    if (defaultOpenSection) setOpen(defaultOpenSection);
  }, [defaultOpenSection]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, instRes, recRes, kolomRes] = await Promise.all([
        fetch('/api/me/profile', { credentials: 'include' }),
        fetch('/api/institutions?kind=UNIVERSITY', { credentials: 'include' }),
        fetch('/api/recreational', { credentials: 'include' }),
        fetch('/api/kolom', { credentials: 'include' }),
      ]);
      const inst = instRes.ok ? await instRes.json() : {};
      const rec = recRes.ok ? await recRes.json() : {};
      const kolomData = kolomRes.ok ? await kolomRes.json() : {};
      setInstitutions(inst.institutions || []);
      setMajors(inst.majors || COMMON_MAJORS);
      setRecFlat(rec.recreational || []);
      setKolomList(kolomData.kolom || []);
      if (Array.isArray(kolomData.bipra) && kolomData.bipra.length) setBipraOptions(kolomData.bipra);
      if (!pRes.ok) {
        const err = await pRes.json().catch(() => ({}));
        addToast({ type: 'error', title: 'Gagal memuat', description: err.error || 'Gagal memuat profil.' });
        return;
      }
      const p = await pRes.json();
      const u = p.user;
      if (!u) {
        addToast({ type: 'error', title: 'Gagal memuat', description: 'Profil tidak ditemukan.' });
        return;
      }
      setUser(u);
      setPendingSuggestions(p.recreationalSuggestions || []);
      setPendingInst(p.institutionSuggestions || []);
      setChurchDataRequest(p.churchDataRequest || null);
      setDue(Boolean(p.reminderDue));
      const inst = u.institution;
      setSelectedInst(inst?.id ? { id: inst.id, name: inst.name } : null);
      setForm({
        gender: u.gender || '',
        phone: u.phone || '',
        birthDate: formatBirthDateInput(u.birthDate),
        address: addressFromUser(u),
        lifeStatuses: Array.isArray(u.lifeStatuses) ? u.lifeStatuses : [],
        schoolLevel: u.schoolLevel || '',
        schoolName: u.schoolName || '',
        institutionId: u.institutionId || '',
        major: u.major || '',
        majorOther: u.majorOther || '',
        workplaceName: u.workplaceName || '',
        workIndustry: u.workIndustry || '',
        workRole: u.workRole || '',
        recreationalIds: u.recreationalIds || [],
        emergencyContactName: u.emergencyContactName || '',
        emergencyContactRelation: u.emergencyContactRelation || '',
        emergencyContactPhone: u.emergencyContactPhone || '',
        emergencyContactAddress: u.emergencyContactAddress || '',
      });
    } catch {
      addToast({ type: 'error', title: 'Gagal memuat', description: 'Gagal memuat profil.' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [authUser?.id]);

  useEffect(() => {
    const q = instSearch.trim();
    if (q.length < 2) {
      setInstitutions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/institutions?kind=UNIVERSITY&q=${encodeURIComponent(q)}`, { credentials: 'include' });
      const d = res.ok ? await res.json() : {};
      setInstitutions(d.institutions || []);
      if (Array.isArray(d.majors) && d.majors.length) setMajors(d.majors);
    }, 250);
    return () => clearTimeout(t);
  }, [instSearch]);

  const save = async () => {
    setSaving(true);
    try {
      const addr = form.address;
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: form.gender || null,
          phone: form.phone || null,
          birthDate: form.birthDate || null,
          ...addr,
          lifeStatuses: form.lifeStatuses,
          schoolLevel: form.schoolLevel || null,
          schoolName: form.schoolName || null,
          institutionId: form.institutionId || null,
          major: form.major || null,
          majorOther: form.major === 'Lainnya' ? (form.majorOther || null) : null,
          workplaceName: form.workplaceName || null,
          workIndustry: form.workIndustry || null,
          workRole: form.workRole || null,
          recreationalIds: form.recreationalIds,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactRelation: form.emergencyContactRelation || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
          emergencyContactAddress: form.emergencyContactAddress || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan');
      addToast({ type: 'success', title: 'Tersimpan', description: 'Profil diperbarui.' });
      setDue(false);
      setUser(d.user);
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal menyimpan' });
    } finally {
      setSaving(false);
    }
  };

  const suggestRecreational = async (payload: { name: string; kind: string; parentId?: string }) => {
    setSuggestBusy(true);
    try {
      const res = await fetch('/api/recreational/suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal mengirim saran');
      addToast({
        type: 'success',
        title: 'Saran terkirim',
        description: 'Admin akan meninjau minat baru ini.',
      });
      setPendingSuggestions((prev) => [d.suggestion, ...prev]);
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Gagal',
        description: e instanceof Error ? e.message : 'Gagal mengirim saran',
      });
    } finally {
      setSuggestBusy(false);
    }
  };

  const suggestInstitution = async () => {
    const name = instOther.name.trim();
    if (!name) return;
    setSuggestBusy(true);
    try {
      const res = await fetch('/api/institutions/suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          city: instOther.city.trim() || null,
          country: instOther.country.trim() || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal mengirim saran kampus');
      addToast({ type: 'success', title: 'Saran terkirim', description: 'Admin akan meninjau kampus ini.' });
      setPendingInst((prev) => [d.suggestion, ...prev]);
      setShowInstOther(false);
      setInstOther({ name: '', city: '', country: '' });
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: e instanceof Error ? e.message : 'Gagal mengirim saran' });
    } finally {
      setSuggestBusy(false);
    }
  };

  const confirmStillSame = async () => {
    await fetch('/api/me/profile/confirm', { method: 'POST', credentials: 'include' });
    setDue(false);
    addToast({ type: 'success', title: 'Terima kasih', description: 'Data ditandai masih berlaku.' });
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat profil…
      </div>
    );
  }

  const segs = profileSegments({ ...user, ...form, birthDate: form.birthDate || user?.birthDate, ...form.address, recreational: form.recreationalIds });
  const age = ageFromBirthDate(form.birthDate || user?.birthDate);
  const daysToBday = daysUntilBirthday(form.birthDate || user?.birthDate);
  const bipraHint = suggestBipra(form.birthDate || user?.birthDate, form.gender || user?.gender);
  const bipraMismatch = user?.bipra && bipraHint.suggested && user.bipra !== bipraHint.suggested;
  const sections: { id: ProfileSectionId; title: string; hint: string; done: boolean }[] = [
    { id: 'contact', title: 'Kontak & alamat', hint: 'Wajib — HP, gender, tanggal lahir, alamat', done: segs.contact },
    { id: 'life', title: 'Status hidup', hint: 'Sekolah / kuliah / kerja — boleh lebih dari satu', done: segs.life },
    { id: 'gifts', title: 'Karunia rohani', hint: 'Tes karunia untuk placement', done: segs.gifts },
    { id: 'recreational', title: 'Minat (Sports & Arts)', hint: 'Boleh dilewati dulu', done: segs.recreational },
    { id: 'emergency', title: 'Kontak darurat', hint: 'Nanti — orang tua / saudara', done: segs.emergency },
  ];

  const toggleStatus = (s: LifeStatus) => {
    setForm((f) => ({
      ...f,
      lifeStatuses: f.lifeStatuses.includes(s) ? f.lifeStatuses.filter((x) => x !== s) : [...f.lifeStatuses, s],
    }));
  };

  const field = 'w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black';

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <img
              src={displayAvatar(user?.name, user?.avatar)}
              alt={user?.name || 'Profil'}
              className="w-16 h-16 rounded-full object-cover border-2 border-[#D9D7D0]"
            />
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#181818] text-white flex items-center justify-center cursor-pointer shadow-md hover:bg-[#FF416C] transition-colors">
              {avatarBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={avatarBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void onPickAvatar(f);
                }}
              />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
              <User className="w-3.5 h-3.5 text-[#FF416C]" />
              <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">Profil saya</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight truncate">{user?.name}</h2>
            {user?.email && (
              <p className="text-xs text-[#8C8880] mt-1 flex items-center gap-1.5 truncate">
                <Mail className="w-3 h-3 shrink-0" />
                {user.email}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F3F1EC] text-[#8C8880]">
                {user?.avatarSource === 'CUSTOM' ? 'Foto sendiri' : 'Foto Google'}
              </span>
              {user?.avatarSource === 'CUSTOM' && (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => void restoreGoogleAvatar()}
                  className="text-[10px] font-bold text-[#FF416C] inline-flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  Kembalikan foto Google
                </button>
              )}
            </div>
          </div>
        </div>

        <ProfileChurchDataRequestPanel
          user={user}
          pendingRequest={churchDataRequest}
          kolomList={kolomList}
          bipraOptions={bipraOptions}
          onboardingMode={authUser?.onboardingStatus === 'WAITING_POOL'}
          onSubmitted={load}
          addToast={addToast}
        />

        {bipraMismatch && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-bold">Usulan kategorial: {bipraHint.suggested}</p>
            <p className="mt-1 text-[10px]">{bipraHint.reason}. Saat ini: {user?.bipra}. Ajukan perubahan lewat formulir data gereja di atas.</p>
          </div>
        )}

        {age !== null && (
          <p className="mt-3 text-[10px] text-[#8C8880]">
            Umur {age} tahun
            {daysToBday !== null && daysToBday <= 60 && (
              <span className="ml-2 text-[#FF416C] font-bold">
                · HUT {daysToBday === 0 ? 'hari ini!' : `${daysToBday} hari lagi`}
              </span>
            )}
          </p>
        )}
      </div>

      {due && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-xs text-amber-900 flex-1">
            Sudah {user?.profileReminderDays || 60} hari sejak data terakhir. Alamat, kampus, atau kantor masih sama?
          </p>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={confirmStillSame} className="px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-[10px] font-bold">Masih sama</button>
            <button type="button" onClick={() => setOpen('contact')} className="px-3 py-1.5 rounded-xl bg-[#181818] text-white text-[10px] font-bold">Ubah</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setOpen(s.id)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left ${open === s.id ? 'border-[#181818] bg-white' : 'border-[#D9D7D0]/50 bg-white/70'}`}
          >
            {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <Circle className="w-5 h-5 text-[#D9D7D0] shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-bold">{s.title}</p>
              <p className="text-[10px] text-[#8C8880]">{s.hint}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[28px] border border-[#D9D7D0]/50 p-6 space-y-4">
        {open === 'contact' && (
          <>
            {!authUser || authUser.onboardingStatus !== 'WAITING_POOL' ? <LinkGoogleCard compact /> : null}
            <select className={field} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">Gender</option>
              <option value="LAKI-LAKI">Laki-laki</option>
              <option value="PEREMPUAN">Perempuan</option>
            </select>
            <div>
              <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">Tanggal lahir</label>
              <input
                type="date"
                className={field}
                value={form.birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
            </div>
            <input className={field} placeholder="Nomor HP" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <AddressForm value={form.address} onChange={(address) => setForm((f) => ({ ...f, address }))} />
          </>
        )}

        {open === 'life' && (
          <>
            <p className="text-[10px] font-bold uppercase text-[#8C8880]">Pilih yang berlaku sekarang (boleh lebih dari satu)</p>
            <div className="flex flex-wrap gap-1.5">
              {LIFE_STATUSES.map((s) => {
                const on = form.lifeStatuses.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleStatus(s)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${on ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#8C8880]'}`}>
                    {LIFE_STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
            {form.lifeStatuses.includes('SCHOOL') && (
              <div className="grid sm:grid-cols-2 gap-2">
                <select className={field} value={form.schoolLevel} onChange={(e) => setForm((f) => ({ ...f, schoolLevel: e.target.value }))}>
                  <option value="">Jenjang</option>
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA / SMK</option>
                </select>
                <input className={field} placeholder="Nama sekolah" value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} />
              </div>
            )}
            {form.lifeStatuses.includes('UNIVERSITY') && (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    className={field}
                    placeholder="Cari universitas (min. 2 huruf)…"
                    value={instSearch}
                    onChange={(e) => setInstSearch(e.target.value)}
                  />
                  {selectedInst && (
                    <p className="text-[10px] text-[#8C8880] mt-1">Terpilih: <span className="font-bold text-[#1B1B1B]">{selectedInst.name}</span></p>
                  )}
                  {instSearch.trim().length >= 2 && institutions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-[#D9D7D0] bg-white shadow-lg">
                      {institutions.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#FAF9F5]"
                          onClick={() => {
                            setSelectedInst({ id: i.id, name: i.name });
                            setForm((f) => ({ ...f, institutionId: i.id }));
                            setInstSearch('');
                            setInstitutions([]);
                          }}
                        >
                          {i.name}{i.city ? ` · ${i.city}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setShowInstOther((v) => !v)} className="text-[10px] font-bold text-[#FF416C]">
                  Lainnya… (kampus tidak ada di daftar)
                </button>
                {showInstOther && (
                  <div className="space-y-2 rounded-xl border border-[#D9D7D0] p-3 bg-[#FAF9F5]">
                    <input className={field} placeholder="Nama kampus" value={instOther.name} onChange={(e) => setInstOther((f) => ({ ...f, name: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={field} placeholder="Kota" value={instOther.city} onChange={(e) => setInstOther((f) => ({ ...f, city: e.target.value }))} />
                      <input className={field} placeholder="Negara (kosong = Indonesia)" value={instOther.country} onChange={(e) => setInstOther((f) => ({ ...f, country: e.target.value }))} />
                    </div>
                    <button type="button" disabled={suggestBusy || !instOther.name.trim()} onClick={() => void suggestInstitution()} className="px-3 py-1.5 rounded-xl bg-[#181818] text-white text-[10px] font-bold disabled:opacity-50">
                      {suggestBusy ? '…' : 'Kirim ke admin'}
                    </button>
                  </div>
                )}
                {pendingInst.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                    <p className="text-[10px] font-bold text-amber-800">Kampus menunggu persetujuan</p>
                    {pendingInst.map((s) => <p key={s.id} className="text-[10px] text-amber-900">• {s.name}</p>)}
                  </div>
                )}
                <select className={field} value={form.major} onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))}>
                  <option value="">Jurusan</option>
                  {majors.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {form.major === 'Lainnya' && (
                  <input
                    className={field}
                    placeholder="Tulis jurusan kamu"
                    value={form.majorOther}
                    onChange={(e) => setForm((f) => ({ ...f, majorOther: e.target.value }))}
                  />
                )}
              </div>
            )}
            {form.lifeStatuses.includes('WORK') && (
              <div className="space-y-2">
                <input
                  className={field}
                  placeholder="Nama kantor / instansi (contoh: PT ABC, Kawasan MM210)"
                  value={form.workplaceName}
                  onChange={(e) => setForm((f) => ({ ...f, workplaceName: e.target.value }))}
                />
                <select className={field} value={form.workIndustry} onChange={(e) => setForm((f) => ({ ...f, workIndustry: e.target.value }))}>
                  <option value="">Industri / sektor</option>
                  {WORK_INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                </select>
                <input
                  className={field}
                  placeholder="Jabatan / role (opsional)"
                  value={form.workRole}
                  onChange={(e) => setForm((f) => ({ ...f, workRole: e.target.value }))}
                />
              </div>
            )}
          </>
        )}

        {open === 'gifts' && (
          <ProfileGiftsSection
            giftsTop5={user?.giftsTop5}
            addToast={addToast}
            onSaved={() => {
              load();
              onGiftSaved?.();
            }}
          />
        )}

        {open === 'recreational' && (
          <ProfileRecreationalSection
            recFlat={recFlat}
            selectedIds={form.recreationalIds}
            pendingSuggestions={pendingSuggestions}
            onChange={(recreationalIds) => setForm((f) => ({ ...f, recreationalIds }))}
            onSuggest={suggestRecreational}
            suggestBusy={suggestBusy}
          />
        )}

        {open === 'emergency' && (
          <>
            <input className={field} placeholder="Nama kontak darurat" value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} />
            <select className={field} value={form.emergencyContactRelation} onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))}>
              <option value="">Hubungan</option>
              <option value="ORANG_TUA">Orang tua</option>
              <option value="SAUDARA">Saudara</option>
              <option value="TEMAN">Teman</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
            <input className={field} placeholder="HP darurat" value={form.emergencyContactPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} />
            <input className={field} placeholder="Alamat kontak darurat (opsional)" value={form.emergencyContactAddress} onChange={(e) => setForm((f) => ({ ...f, emergencyContactAddress: e.target.value }))} />
          </>
        )}

        {open !== 'gifts' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save()}
            className="w-full py-2.5 rounded-2xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Simpan segmen ini
          </button>
        )}
      </div>
    </div>
  );
};
