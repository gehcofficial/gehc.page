import React from 'react';

type Props = {
  items: { code: string; label: string; count: number }[];
  className?: string;
};

/** Word cloud sederhana: ukuran font ∝ √count (tanpa dependensi). */
export const WordCloud: React.FC<Props> = ({ items, className = '' }) => {
  if (!items.length) {
    return <p className="text-sm text-[#8C8880]">Belum ada chip yang dipilih.</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-3 ${className}`}>
      {items.map((item) => {
        const ratio = Math.sqrt(item.count / max);
        const size = 16 + ratio * 44;
        return (
          <span
            key={item.code}
            className="font-display font-black bg-gradient-to-r from-brand to-brand-end bg-clip-text text-transparent transition-all duration-500"
            style={{ fontSize: `${size}px`, lineHeight: 1.1 }}
            title={`${item.count} suara`}
          >
            {item.label}
          </span>
        );
      })}
    </div>
  );
};

export default WordCloud;
