import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ACADEMIC_TITLES,
  CHURCH_TITLES,
  composeOfficialName,
  normalizeAcademicAbbr,
  searchAcademicTitles,
  titleCaseName,
  type PersonNameParts,
} from '../../lib/person-name';

export const PersonNameFields: React.FC<{
  value: PersonNameParts;
  onChange: (next: PersonNameParts) => void;
  required?: boolean;
  theme?: 'light' | 'dark';
}> = ({ value, onChange, required = true, theme = 'light' }) => {
  const preview = composeOfficialName(value);
  const set = (patch: Partial<PersonNameParts>) => onChange({ ...value, ...patch });
  const fieldClass = theme === 'dark'
    ? 'w-full px-3.5 py-2.5 rounded-xl bg-[#181818] border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-[#FF416C]'
    : 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black';
  const labelClass = theme === 'dark'
    ? 'text-[10px] font-bold uppercase text-white/60 block mb-1'
    : 'text-[10px] font-bold uppercase text-[#8C8880] block mb-1';
  const hintClass = theme === 'dark' ? 'text-[10px] text-white/40' : 'text-[10px] text-[#8C8880]';

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Gelar jabatan struktur gereja</label>
        <select
          className={fieldClass}
          value={value.churchTitle}
          onChange={(e) => set({ churchTitle: e.target.value as PersonNameParts['churchTitle'] })}
        >
          <option value="">Tidak pakai</option>
          {CHURCH_TITLES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <NameBox fieldClass={fieldClass} labelClass={labelClass} label="Nama depan" required={required} value={value.givenName} placeholder="Meyke" onChange={(givenName) => set({ givenName })} />
        <NameBox fieldClass={fieldClass} labelClass={labelClass} label="Nama tengah" value={value.middleName} placeholder="Opsional" onChange={(middleName) => set({ middleName })} />
        <NameBox fieldClass={fieldClass} labelClass={labelClass} label="Nama belakang" required={required} value={value.familyName} placeholder="Poluan" onChange={(familyName) => set({ familyName })} />
      </div>
      <p className={hintClass}>Huruf kapital otomatis di awal tiap kata.</p>
      <AcademicTitlesField fieldClass={fieldClass} labelClass={labelClass} hintClass={hintClass} value={value.academicTitles} onChange={(academicTitles) => set({ academicTitles })} />
      {preview ? (
        <div className="rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#8C8880]">Nama tercetak</p>
          <p className="text-xs font-bold text-[#1B1B1B] mt-0.5">{preview}</p>
        </div>
      ) : null}
    </div>
  );
};

const NameBox: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  fieldClass: string;
  labelClass: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, required, fieldClass, labelClass, onChange }) => (
  <div>
    <label className={labelClass}>{label}{required ? ' *' : ''}</label>
    <input
      className={fieldClass}
      value={value}
      required={required}
      placeholder={placeholder}
      autoCapitalize="words"
      onChange={(e) => onChange(titleCaseName(e.target.value))}
      onBlur={() => onChange(titleCaseName(value).trim())}
    />
  </div>
);

const AcademicTitlesField: React.FC<{
  value: string[];
  fieldClass: string;
  labelClass: string;
  hintClass: string;
  onChange: (next: string[]) => void;
}> = ({ value, fieldClass, labelClass, hintClass, onChange }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => searchAcademicTitles(q).filter((t) => !value.includes(t.abbr)).slice(0, 12), [q, value]);
  const custom = normalizeAcademicAbbr(q);
  const customKnown = ACADEMIC_TITLES.some((t) => t.abbr.toLowerCase() === custom.toLowerCase());
  const showCustom = Boolean(custom) && !customKnown && !value.some((v) => v.toLowerCase() === custom.toLowerCase());

  const add = (abbr: string) => {
    const n = normalizeAcademicAbbr(abbr);
    if (!n || value.includes(n)) return;
    onChange([...value, n]);
    setQ('');
    setOpen(false);
  };

  return (
    <div>
      <label className={labelClass}>Gelar akademis</label>
      <p className={`${hintClass} mb-2 leading-relaxed`}>
        Cari gelar Indonesia atau Inggris. Tidak ketemu? ketik singkatan lalu pakai gelar manual.
      </p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((abbr) => (
            <span key={abbr} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#181818] text-white text-[10px] font-bold">
              {abbr}
              <button type="button" aria-label={`Hapus ${abbr}`} onClick={() => onChange(value.filter((x) => x !== abbr))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          className={fieldClass}
          value={q}
          placeholder="Cari S.Th., M.Pd., Ph.D.…"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        />
        {open && (hits.length > 0 || showCustom) && (
          <div className="absolute z-20 mt-1 w-full rounded-2xl border border-[#D9D7D0] bg-white shadow-lg max-h-56 overflow-y-auto">
            {hits.map((t) => (
              <button
                key={t.abbr}
                type="button"
                className="w-full text-left px-3 py-2.5 text-xs border-b border-[#D9D7D0]/40 last:border-0 hover:bg-[#FAF9F5]"
                onClick={() => add(t.abbr)}
              >
                <span className="font-bold">{t.abbr}</span>
                <span className="block text-[10px] text-[#8C8880] truncate">{t.nameId} · {t.nameEn}</span>
              </button>
            ))}
            {showCustom && (
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#FAF9F5] flex items-center gap-2"
                onClick={() => add(custom)}
              >
                <Plus className="w-3.5 h-3.5" />
                Pakai gelar manual <span className="font-bold">{custom}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
