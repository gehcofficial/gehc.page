import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AddressForm, addressFromUser, emptyAddress } from './AddressForm';
import {
  COMMON_MAJORS,
  LIFE_STATUS_LABEL,
  LIFE_STATUSES,
  profileSegments,
  type LifeStatus,
} from '../../lib/profile';
import type { RecreationalNode } from '../../lib/recreational';

const BIPRA_LABEL: Record<string, string> = {
  BAPAK: 'Bapak', IBU: 'Ibu', PEMUDA: 'Pemuda', REMAJA: 'Remaja', ANAK: 'Anak',
};

type SectionId = 'contact' | 'life' | 'gifts' | 'recreational' | 'emergency';

export const MyProfilePanel: React.FC = () => {
  const { addToast, authUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [institutions, setInstitutions] = useState<Array<{ id: string; name: string }>>([]);
  const [majors, setMajors] = useState<string[]>(COMMON_MAJORS);
  const [recFlat, setRecFlat] = useState<RecreationalNode[]>([]);
  const [open, setOpen] = useState<SectionId>('contact');
  const [form, setForm] = useState({
    gender: '',
    phone: '',
    address: emptyAddress(),
    lifeStatuses: [] as string[],
    schoolLevel: '',
    schoolName: '',
    institutionId: '',
    major: '',
    workplaceName: '',
    giftsTop5: '[]',
    recreationalIds: [] as string[],
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
  });
  const [due, setDue] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, instRes, recRes] = await Promise.all([
        fetch('/api/me/profile', { credentials: 'include' }),
        fetch('/api/institutions?kind=UNIVERSITY', { credentials: 'include' }),
        fetch('/api/recreational', { credentials: 'include' }),
      ]);
      const inst = instRes.ok ? await instRes.json() : {};
      const rec = recRes.ok ? await recRes.json() : {};
      setInstitutions(inst.institutions || []);
      setMajors(inst.majors || COMMON_MAJORS);
      setRecFlat(rec.recreational || []);
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
      setDue(Boolean(p.reminderDue));
      setForm({
        gender: u.gender || '',
        phone: u.phone || '',
        address: addressFromUser(u),
        lifeStatuses: Array.isArray(u.lifeStatuses) ? u.lifeStatuses : [],
        schoolLevel: u.schoolLevel || '',
        schoolName: u.schoolName || '',
        institutionId: u.institutionId || '',
        major: u.major || '',
        workplaceName: u.workplaceName || '',
        giftsTop5: JSON.stringify(u.giftsTop5 || [], null, 2),
        recreationalIds: u.recreationalIds || [],
        emergencyContactName: u.emergencyContactName || '',
        emergencyContactRelation: u.emergencyContactRelation || '',
        emergencyContactPhone: u.emergencyContactPhone || '',
      });
    } catch {
      addToast({ type: 'error', title: 'Gagal memuat', description: 'Gagal memuat profil.' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [authUser?.id]);

  const save = async (extra?: Record<string, unknown>) => {
    setSaving(true);
    try {
      let giftsTop5: string[] = [];
      try {
        giftsTop5 = JSON.parse(form.giftsTop5);
        if (!Array.isArray(giftsTop5)) giftsTop5 = [];
      } catch { giftsTop5 = []; }
      const addr = form.address;
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: form.gender || null,
          phone: form.phone || null,
          ...addr,
          lifeStatuses: form.lifeStatuses,
          schoolLevel: form.schoolLevel || null,
          schoolName: form.schoolName || null,
          institutionId: form.institutionId || null,
          major: form.major || null,
          workplaceName: form.workplaceName || null,
          giftsTop5,
          recreationalIds: form.recreationalIds,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactRelation: form.emergencyContactRelation || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
          ...extra,
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

  const segs = profileSegments({ ...user, ...form, ...form.address, recreational: form.recreationalIds });
  const sections: { id: SectionId; title: string; hint: string; done: boolean }[] = [
    { id: 'contact', title: 'Kontak & alamat', hint: 'Wajib aktif — HP, gender, alamat rumah', done: segs.contact },
    { id: 'life', title: 'Status hidup', hint: 'Sekolah / kuliah / kerja — boleh lebih dari satu', done: segs.life },
    { id: 'gifts', title: 'Karunia rohani', hint: 'Untuk Pemuda / placement', done: segs.gifts },
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
          <User className="w-3.5 h-3.5 text-[#FF416C]" />
          <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">Profil saya</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{user?.name}</h2>
        <p className="text-xs text-[#8C8880] mt-1">
          {BIPRA_LABEL[user?.bipra] || user?.bipra}
          {user?.kolom ? ` · ${user.kolom.name}` : ' · Kolom belum diisi (hubungi sekretaris)'}
          {user?.linkStatus === 'LINKED' ? ' · Akun tertaut' : ' · Belum taut Google'}
        </p>
        <p className="text-[10px] text-[#8C8880] mt-2">BIPRA dan Kolom hanya diubah admin. Salah? Hubungi sekretaris Komisi.</p>
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
            <select className={field} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Gender</option>
              <option value="LAKI-LAKI">Laki-laki</option>
              <option value="PEREMPUAN">Perempuan</option>
            </select>
            <input className={field} placeholder="Nomor HP" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                <select className={field} value={form.schoolLevel} onChange={(e) => setForm({ ...form, schoolLevel: e.target.value })}>
                  <option value="">Jenjang</option>
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA / SMK</option>
                </select>
                <input className={field} placeholder="Nama sekolah" value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} />
              </div>
            )}
            {form.lifeStatuses.includes('UNIVERSITY') && (
              <div className="grid sm:grid-cols-2 gap-2">
                <select className={field} value={form.institutionId} onChange={(e) => setForm({ ...form, institutionId: e.target.value })}>
                  <option value="">Universitas</option>
                  {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select className={field} value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })}>
                  <option value="">Jurusan</option>
                  {majors.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {form.lifeStatuses.includes('WORK') && (
              <input className={field} placeholder="Nama kantor / instansi (bisa cari di Maps pada alamat)" value={form.workplaceName} onChange={(e) => setForm({ ...form, workplaceName: e.target.value })} />
            )}
          </>
        )}

        {open === 'gifts' && (
          <textarea className={`${field} font-mono`} rows={5} value={form.giftsTop5} onChange={(e) => setForm({ ...form, giftsTop5: e.target.value })} />
        )}

        {open === 'recreational' && (
          <div className="space-y-3">
            {(['SPORTS', 'ARTS'] as const).map((kind) => {
              const cats = recFlat.filter((r) => !r.parentId && r.kind === kind);
              return (
                <div key={kind}>
                  <p className="text-[10px] font-black uppercase text-[#8C8880] mb-2">{kind === 'SPORTS' ? 'Sports' : 'Arts'}</p>
                  {cats.map((cat) => (
                    <div key={cat.id} className="mb-2">
                      <p className="text-[10px] font-bold mb-1">{cat.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recFlat.filter((r) => r.parentId === cat.id).map((leaf) => {
                          const on = form.recreationalIds.includes(leaf.id);
                          return (
                            <button
                              key={leaf.id}
                              type="button"
                              onClick={() => setForm({
                                ...form,
                                recreationalIds: on ? form.recreationalIds.filter((id) => id !== leaf.id) : [...form.recreationalIds, leaf.id],
                              })}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold ${on ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#8C8880]'}`}
                            >
                              {leaf.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {open === 'emergency' && (
          <>
            <input className={field} placeholder="Nama kontak darurat" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
            <select className={field} value={form.emergencyContactRelation} onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}>
              <option value="">Hubungan</option>
              <option value="ORANG_TUA">Orang tua</option>
              <option value="SAUDARA">Saudara</option>
              <option value="TEMAN">Teman</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
            <input className={field} placeholder="HP darurat" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
          </>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={() => save()}
          className="w-full py-2.5 rounded-2xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Simpan segmen ini
        </button>
      </div>
    </div>
  );
};
