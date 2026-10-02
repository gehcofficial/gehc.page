import React from 'react';
import { CalendarDays } from 'lucide-react';
import { ageFromBirthDate, formatLongDateId } from '../../lib/demographics';

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  inputClassName?: string;
  labelClassName?: string;
  max?: string;
};

/**
 * Input tanggal lahir + konfirmasi long-date Bahasa Indonesia.
 * <input type="date"> mengikuti locale browser (bisa mm/dd/yyyy) — baris
 * konfirmasi ("Senin, 10 Maret 2026 · usia 22 th") memastikan yang terbaca.
 */
export const BirthDateField: React.FC<Props> = ({
  label = 'Tanggal lahir',
  value,
  onChange,
  inputClassName,
  labelClassName,
  max,
}) => {
  const long = formatLongDateId(value);
  const age = value ? ageFromBirthDate(value) : null;
  return (
    <div>
      {label && (
        <label className={labelClassName || 'text-[10px] font-bold uppercase text-[#8C8880] block mb-1'}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> {label}
          </span>
        </label>
      )}
      <input
        type="date"
        aria-label={label || 'Tanggal lahir'}
        className={inputClassName || 'w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black'}
        value={value}
        max={max || new Date().toISOString().slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className={`mt-1 text-[11px] font-bold ${long ? 'text-emerald-700' : 'text-[#B8B4AC]'}`}>
        {long ? `${long}${age !== null ? ` · usia ${age} th` : ''}` : 'Belum diisi — cek kembali sebelum simpan.'}
      </p>
    </div>
  );
};
