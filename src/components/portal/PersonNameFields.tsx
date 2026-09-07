import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ACADEMIC_TITLES,
  CHURCH_TITLES,
  composeOfficialName,
  normalizeAcademicAbbr,
  searchAcademicTitles,
  titleCaseName,
  type AcademicTitle,
  type PersonNameParts,
} from '../../lib/person-name';

type ChurchOpt = { value: string; abbr: string; label: string };

export const PersonNameFields: React.FC<{
  value: PersonNameParts;
  onChange: (next: PersonNameParts) => void;
  required?: boolean;
  theme?: 'light' | 'dark';
}> = ({ value, onChange, required = true, theme = 'light' }) => {
  const [churchOpts, setChurchOpts] = useState<ChurchOpt[]>(
    CHURCH_TITLES.map((t) => ({ value: t.value, abbr: t.abbr, label: t.label })),
  );
  const [academicList, setAcademicList] = useState<AcademicTitle[]>(ACADEMIC_TITLES);
  const preview = composeOfficialName(value, {
    church: churchOpts,
    academic: academicList,
  });
  const set = (patch: Partial<PersonNameParts>) => onChange({ ...value, ...patch });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/titles', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { church: [], academic: [] }))
      .then((d: { church?: Array<{ code: string; abbr: string; nameId: string; active?: boolean }>; academic?: Array<{ abbr: string; nameId: string; nameEn: string; position: string; active?: boolean }> }) => {
        if (cancelled) return;
        const church = (d.church || []).filter((t) => t.active !== false);
        if (church.length) {
          setChurchOpts(church.map((t) => ({
            value: t.code,
            abbr: t.abbr,
            label: `${t.nameId} (${t.abbr})`,
          })));
        }
        const academic = (d.academic || []).filter((t) => t.active !== false);
        if (academic.length) {
          setAcademicList(academic.map((t) => ({
            abbr: t.abbr,
            nameId: t.nameId,
            nameEn: t.nameEn,
            locale: 'BOTH' as const,
            position: t.position === 'prefix' ? 'prefix' : 'suffix',
          })));
        }
      })
      .catch(() => { /* fallback seed */ });
    return () => { cancelled = true; };
  }, []);
  const dark = theme === 'dark';
  const fieldClass = dark
    ? 'w-full px-3.5 py-2.5 rounded-xl bg-[#181818] border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-[#FF416C]'
    : 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black';
  const labelClass = dark
    ? 'text-[10px] font-bold uppercase text-white/60 block mb-1'
    : 'text-[10px] font-bold uppercase text-[#8C8880] block mb-1';
  const hintClass = dark ? 'text-[10px] text-white/40' : 'text-[10px] text-[#8C8880]';

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
          {churchOpts.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <NameBox fieldClass={fieldClass} labelClass={labelClass} label="Nama depan" required={required} value={value.givenName} placeholder="cth. Meyke" onChange={(givenName) => set({ givenName })} />
        <NameBox fieldClass={fieldClass} labelClass={labelClass} label="Nama tengah" value={value.middleName} placeholder="Opsional" onChange={(middleName) => set({ middleName })} />
        <NameBox fieldClass={fieldClass} labelClass={labelClass} label="Nama belakang" required={required} value={value.familyName} placeholder="cth. Poluan" onChange={(familyName) => set({ familyName })} />
      </div>
      <p className={hintClass}>Huruf kapital otomatis di awal tiap kata.</p>
      <AcademicTitlesField
        theme={theme}
        fieldClass={fieldClass}
        labelClass={labelClass}
        hintClass={hintClass}
        catalog={academicList}
        value={value.academicTitles}
        onChange={(academicTitles) => set({ academicTitles })}
      />
      {preview ? (
        <div className={dark
          ? 'rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2'
          : 'rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] px-3 py-2'}
        >
          <p className={dark
            ? 'text-[9px] font-bold uppercase tracking-wider text-white/50'
            : 'text-[9px] font-bold uppercase tracking-wider text-[#8C8880]'}
          >
            Nama tercetak
          </p>
          <p className={dark ? 'text-xs font-bold text-white mt-0.5' : 'text-xs font-bold text-[#1B1B1B] mt-0.5'}>{preview}</p>
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
  catalog: AcademicTitle[];
  fieldClass: string;
  labelClass: string;
  hintClass: string;
  theme: 'light' | 'dark';
  onChange: (next: string[]) => void;
}> = ({ value, catalog, fieldClass, labelClass, hintClass, theme, onChange }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const list = catalog.length ? catalog : ACADEMIC_TITLES;
  const hits = useMemo(() => searchAcademicTitles(q, list).filter((t) => !value.includes(t.abbr)).slice(0, 12), [q, value, list]);
  const custom = normalizeAcademicAbbr(q);
  const customCompact = custom.replace(/\./g, '').toLowerCase();
  const customKnown = list.some((t) => {
    const abbr = t.abbr.toLowerCase();
    return abbr === custom.toLowerCase() || abbr.replace(/\./g, '') === customCompact;
  });
  const showCustom = Boolean(custom) && !customKnown && !value.some((v) => v.toLowerCase() === custom.toLowerCase());
  const dark = theme === 'dark';

  const add = (abbr: string, fromCatalog = true) => {
    const n = normalizeAcademicAbbr(abbr);
    if (!n || value.some((v) => v.toLowerCase() === n.toLowerCase())) return;
    onChange([...value, n]);
    setQ('');
    setOpen(false);
    if (!fromCatalog) {
      fetch('/api/titles/suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'ACADEMIC', abbr: n }),
      }).catch(() => { /* antrian katalog opsional */ });
    }
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const menuClass = dark
    ? 'absolute z-20 mt-1 w-full rounded-2xl border border-white/15 bg-[#1a1a1a] shadow-lg max-h-56 overflow-y-auto'
    : 'absolute z-20 mt-1 w-full rounded-2xl border border-[#D9D7D0] bg-white shadow-lg max-h-56 overflow-y-auto';
  const itemClass = dark
    ? 'w-full text-left px-3 py-2.5 text-xs border-b border-white/10 last:border-0 hover:bg-white/5 text-white'
    : 'w-full text-left px-3 py-2.5 text-xs border-b border-[#D9D7D0]/40 last:border-0 hover:bg-[#FAF9F5]';
  const subClass = dark ? 'block text-[10px] text-white/45 truncate' : 'block text-[10px] text-[#8C8880] truncate';
  const chipClass = dark
    ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 text-white text-[10px] font-bold border border-white/15'
    : 'inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#181818] text-white text-[10px] font-bold';

  return (
    <div>
      <label className={labelClass}>Gelar akademis</label>
      <p className={`${hintClass} mb-2 leading-relaxed`}>
        Cari gelar Indonesia atau Inggris. Tidak ketemu? ketik singkatan lalu pakai gelar manual.
      </p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((abbr) => (
            <span key={abbr} className={chipClass}>
              {abbr}
              <button type="button" aria-label={`Hapus ${abbr}`} onClick={() => onChange(value.filter((x) => x !== abbr))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative" ref={wrapRef}>
        <input
          className={fieldClass}
          value={q}
          placeholder="Cari S.Th., M.Pd., Ph.D.…"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (hits[0]) add(hits[0].abbr, true);
            else if (showCustom) add(custom, false);
          }}
        />
        {open && (hits.length > 0 || showCustom) && (
          <div className={menuClass} role="listbox">
            {hits.map((t) => (
              <button
                key={t.abbr}
                type="button"
                className={itemClass}
                onClick={() => add(t.abbr, true)}
              >
                <span className="font-bold">{t.abbr}</span>
                <span className={subClass}>{t.nameId} · {t.nameEn}</span>
              </button>
            ))}
            {showCustom && (
              <button
                type="button"
                className={`${itemClass} flex items-center gap-2`}
                onClick={() => add(custom, false)}
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
