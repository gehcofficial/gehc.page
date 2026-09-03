import React, { useEffect, useState } from 'react';
import { Field } from '../public/ui/joinParts';
import { DOMICILE_OPTIONS, domicileDetailConfig, type DomicileKind } from '../../lib/domicile';
import {
  ORIGIN_REGION_OPTIONS,
  SULUT_PLACES,
  TITLE_CASE_HINT,
  buildOriginString,
  emptyOriginForm,
  parseOriginString,
  titleCaseWords,
  validateOriginForm,
  type OriginFormState,
  type OriginRegion,
} from '../../lib/origin';

type ProfileSlice = {
  gender?: string | null;
  origin?: string | null;
  domicileKind?: string | null;
  domicileDetail?: string | null;
};

export function eventProfileGaps(u: ProfileSlice | null | undefined) {
  return {
    gender: !u?.gender,
    origin: !u?.origin,
    domicile: !u?.domicileKind,
  };
}

export function eventProfileIncomplete(u: ProfileSlice | null | undefined) {
  const g = eventProfileGaps(u);
  return g.gender || g.origin || g.domicile;
}

export const EventProfileCompleteCard: React.FC<{
  initial?: ProfileSlice | null;
  onSaved?: (next: ProfileSlice) => void;
}> = ({ initial, onSaved }) => {
  const [originForm, setOriginForm] = useState<OriginFormState>(emptyOriginForm());
  const [gender, setGender] = useState('');
  const [domicileKind, setDomicileKind] = useState('');
  const [domicileDetail, setDomicileDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setGender(initial?.gender || '');
    setOriginForm(parseOriginString(initial?.origin));
    setDomicileKind(initial?.domicileKind || '');
    setDomicileDetail(initial?.domicileDetail || '');
  }, [initial?.gender, initial?.origin, initial?.domicileKind, initial?.domicileDetail]);

  const domicileDetailCfg = domicileDetailConfig(domicileKind as DomicileKind | '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const originErr = validateOriginForm(originForm);
    if (originErr) { setError(originErr); setBusy(false); return; }
    const origin = buildOriginString(originForm);
    if (!origin) { setError('Lengkapi asal daerah.'); setBusy(false); return; }
    if (!gender) { setError('Pilih jenis kelamin.'); setBusy(false); return; }
    if (!domicileKind) { setError('Pilih domisili.'); setBusy(false); return; }
    if (domicileDetailCfg?.required && !domicileDetail.trim()) {
      setError('Lengkapi perincian domisili.');
      setBusy(false);
      return;
    }
    const next = {
      gender,
      origin,
      domicileKind,
      domicileDetail: domicileDetail.trim() ? titleCaseWords(domicileDetail) : undefined,
    };
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan profil.');
      setDone(true);
      onSaved?.(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-5">
        <p className="text-sm font-bold text-[#1B1B1B]">Profil asal & domisili tersimpan.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C]">Lengkapi profil</p>
        <p className="text-xs text-[#8C8880] mt-1 leading-relaxed">
          Gender, asal daerah (termasuk Sulut / luar Sulut), dan domisili. Dipakai ulang untuk acara berikutnya.
        </p>
      </div>
      <Field
        label="Jenis kelamin *"
        type="select"
        value={gender}
        onChange={setGender}
        options={[{ value: '', label: 'Pilih...' }, { value: 'LAKI-LAKI', label: 'Laki-laki' }, { value: 'PEREMPUAN', label: 'Perempuan' }]}
        required
      />
      <Field
        label="Asal daerah *"
        type="select"
        value={originForm.originRegion}
        onChange={(v) => setOriginForm({
          originRegion: v as OriginRegion | '',
          originSulutPlace: '',
          originSulutOther: '',
          originNonSulut: '',
        })}
        options={[{ value: '', label: 'Pilih Sulut atau Luar Sulut...' }, ...ORIGIN_REGION_OPTIONS]}
        required
      />
      {originForm.originRegion === 'SULUT' && (
        <>
          <Field
            label="Kota / kabupaten di Sulut *"
            type="select"
            value={originForm.originSulutPlace}
            onChange={(v) => setOriginForm((f) => ({ ...f, originSulutPlace: v, originSulutOther: '' }))}
            options={[{ value: '', label: 'Pilih...' }, ...SULUT_PLACES]}
            required
          />
          {originForm.originSulutPlace === 'LAINNYA_SULUT' && (
            <Field
              label="Tulis kota/kabupaten *"
              value={originForm.originSulutOther}
              onChange={(v) => setOriginForm((f) => ({ ...f, originSulutOther: v }))}
              hint={TITLE_CASE_HINT}
              onBlur={() => setOriginForm((f) => ({ ...f, originSulutOther: titleCaseWords(f.originSulutOther) }))}
              required
            />
          )}
        </>
      )}
      {originForm.originRegion === 'NON_SULUT' && (
        <Field
          label="Kota / kabupaten asal *"
          value={originForm.originNonSulut}
          onChange={(v) => setOriginForm((f) => ({ ...f, originNonSulut: v }))}
          hint={TITLE_CASE_HINT}
          onBlur={() => setOriginForm((f) => ({ ...f, originNonSulut: titleCaseWords(f.originNonSulut) }))}
          required
        />
      )}
      <Field
        label="Domisili saat ini *"
        type="select"
        value={domicileKind}
        onChange={(v) => { setDomicileKind(v); setDomicileDetail(''); }}
        options={[{ value: '', label: 'Pilih...' }, ...DOMICILE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
        required
      />
      {domicileDetailCfg?.show && (
        <Field
          label={domicileDetailCfg.label}
          value={domicileDetail}
          onChange={setDomicileDetail}
          placeholder={domicileDetailCfg.placeholder}
          hint={TITLE_CASE_HINT}
          onBlur={() => setDomicileDetail((v) => titleCaseWords(v))}
          required={domicileDetailCfg.required}
        />
      )}
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded-full bg-[#181818] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
      >
        {busy ? 'Menyimpan…' : 'Simpan profil'}
      </button>
    </form>
  );
};
