import React, { useMemo } from 'react';

type BrandCityRevealProps = {
  text: string;
  className?: string;
};

export const BrandCityReveal: React.FC<BrandCityRevealProps> = ({ text, className = '' }) => {
  const letters = useMemo(() => [...text.toUpperCase()], [text]);

  return (
    <span
      className={`inline-flex min-w-0 uppercase tracking-[0.14em] ${className}`}
      aria-label={text.toUpperCase()}
    >
      {letters.map((char, i) => (
        <span
          key={`${text}-${i}`}
          className="brand-city-letter inline-block"
          style={{ animationDelay: `${i * 72}ms` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};
