import React, { useEffect, useState } from 'react';
import { Loader2, Ticket } from 'lucide-react';
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

export type BakutauRegisterResult = {
  checkInCode?: string | null;
  whatsappGroupUrl?: string | null;
  registeredAt?: string | null;
  eventDate?: string | null;
  venueName?: string | null;
  locationDetail?: string | null;
  mapUrl?: string | null;
  mapEmbedQuery?: string | null;
};

export const BakutauRegisterCard: React.FC<{ onRegistered?: (payload?: BakutauRegisterResult) => void }> = ({ onRegistered }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [originForm, setOriginForm] = useState<OriginFormState>(emptyOriginForm());
  const [domicileKind, setDomicileKind] = useState('');
  const [domicileDetail, setDomicileDetail] = useState('');

  const domicileDetailCfg = domicileDetailConfig(domicileKind as DomicileKind | '');

  useEffect(() => {
    fetch('/api/me/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const u = d.user || {};
        if (u.origin) setOriginForm(parseOriginString(u.origin));
        if (u.domicileKind) setDomicileKind(u.domicileKind);
        if (u.domicileDetail) setDomicileDetail(u.domicileDetail);
      })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const originErr = validateOriginForm(originForm);
    if (originErr) {
      setError(originErr);
      setBusy(false);
      return;
    }
    const origin = buildOriginString(originForm);
    if (!origin) {
      setError('Lengkapi asal daerah.');
      setBusy(false);
      return;
    }
    if (!domicileKind) {
      setError('Pilih domisili.');
      setBusy(false);
      return;
    }
    if (domicileDetailCfg?.required && !domicileDetail.trim()) {
      setError('Lengkapi perincian domisili.');
      setBusy(false);
      return;
    }

    try {
      const res = await fetch('/api/events/baku-tau-4-0/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          domicileKind,
          domicileDetail: domicileDetail.trim() ? titleCaseWords(domicileDetail) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal mendaftar.');
      onRegistered?.(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Ticket className="w-4 h-4 text-[#FF416C]" />
        <p className="text-sm font-black">Daftar BAKU TAU 4.0</p>
      </div>
      <p className="text-[10px] text-[#8C8880] leading-relaxed">
        Konfirmasi kehadiran — lengkapi asal dan domisili untuk statistik panitia.
      </p>
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
            options={[{ value: '', label: 'Pilih kota/kabupaten...' }, ...SULUT_PLACES]}
            required
          />
          {originForm.originSulutPlace === 'LAINNYA_SULUT' && (
            <Field
              label="Tulis kota/kabupaten di Sulut *"
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
        options={[{ value: '', label: 'Pilih tempat tinggal...' }, ...DOMICILE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
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
        className="w-full py-3 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        Konfirmasi daftar
      </button>
    </form>
  );
};
