import React from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'dark' | 'pill';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-brand to-[#FF4B2B] text-white hover:opacity-95',
  ghost: 'bg-white/15 hover:bg-white/25 text-white border border-white/20',
  dark: 'bg-black-block hover:bg-black text-white',
  pill: 'bg-page text-ink hover:bg-panel border border-line',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
> = ({ variant = 'primary', className = '', children, ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);
