import React from 'react';

/** Input teks / select standar form publik. */
export const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  textarea?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  onBlur?: () => void;
  theme?: 'light' | 'dark';
}> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  textarea,
  options,
  hint,
  onBlur,
  theme = 'light',
}) => {
  const labelClass = theme === 'dark' ? 'text-white/60' : 'text-[#1B1B1B]';
  const inputClass =
    theme === 'dark'
      ? 'bg-[#181818] border-white/15 text-white placeholder:text-white/30 focus:border-[#FF416C]'
      : 'bg-white border-[#D9D7D0] text-[#1B1B1B] focus:border-black';
  const hintClass = theme === 'dark' ? 'text-white/40' : 'text-[#8C8880]';

  return (
  <div>
    <label className={`text-xs font-bold uppercase tracking-wider block mb-1 ${labelClass}`}>
      {label} {required && '*'}
    </label>
    {type === 'select' && options ? (
      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium focus:outline-none ${inputClass}`}
      >
        {options.map((o) => (
          <option key={o.value || '__empty'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ) : textarea ? (
      <textarea
        rows={2}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full p-3 rounded-xl border text-xs leading-relaxed focus:outline-none ${inputClass}`}
      />
    ) : (
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium focus:outline-none ${inputClass}`}
      />
    )}
    {hint && <p className={`text-[10px] mt-1 leading-relaxed ${hintClass}`}>{hint}</p>}
  </div>
  );
};

export const Center: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="py-20 text-center text-sm text-[#8C8880]">{children}</div>
);

export const DoneCard: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="bg-white rounded-[28px] border border-emerald-200 p-8 text-center">
    {title && <h3 className="text-lg font-black">{title}</h3>}
    <p className="text-xs text-[#8C8880] mt-2 leading-relaxed">{body}</p>
  </div>
);
