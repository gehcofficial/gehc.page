import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Mail, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AddressForm, addressFromUser, emptyAddress } from './AddressForm';
import { ProfileGiftsSection } from './ProfileGiftsSection';
import { ProfileRecreationalSection } from './ProfileRecreationalSection';
import { ProfileChurchDataRequestPanel, type ChurchDataRequest } from './ProfileChurchDataRequestPanel';
import { LinkGoogleCard } from './LinkGoogleCard';
import { initialsAvatar } from '../../lib/avatar';
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
  const { addToast, authUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
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
      setChurchDataRequest(p.churchDataRequest || null);
      setDue(Boolean(p.reminderDue));
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
          <img
            src={user?.avatar || initialsAvatar(user?.name || '?')}
            alt={user?.name || 'Profil'}
            className="w-16 h-16 rounded-full object-cover border-2 border-[#D9D7D0] shrink-0"
          />
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
          </div>
        </div>

        <ProfileChurchDataRequestPanel
          user={user}
          pendingRequest={churchDataRequest}
          kolomList={kolomList}
          bipraOptions={bipraOptions}
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
            <LinkGoogleCard compact />
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
                <div className="grid sm:grid-cols-2 gap-2">
                  <select className={field} value={form.institutionId} onChange={(e) => setForm((f) => ({ ...f, institutionId: e.target.value }))}>
                    <option value="">Universitas</option>
                    {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <select className={field} value={form.major} onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))}>
                    <option value="">Jurusan</option>
                    {majors.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
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
