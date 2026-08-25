import React from 'react';

/** Input teks standar form publik. */
export const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  textarea?: boolean;
}> = ({ label, value, onChange, placeholder, required, type = 'text', textarea }) => (
  <div>
    <label className="text-xs font-bold uppercase tracking-wider block mb-1">
      {label} {required && '*'}
    </label>
    {textarea ? (
      <textarea
        rows={2}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 rounded-xl bg-white border border-[#D9D7D0] text-xs leading-relaxed focus:outline-none focus:border-black"
      />
    ) : (
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
      />
    )}
  </div>
);

export const Center: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="py-20 text-center text-sm text-[#8C8880]">{children}</div>
);

export const DoneCard: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="bg-white rounded-[28px] border border-emerald-200 p-8 text-center">
    {title && <h3 className="text-lg font-black">{title}</h3>}
    <p className="text-xs text-[#8C8880] mt-2 leading-relaxed">{body}</p>
  </div>
);
