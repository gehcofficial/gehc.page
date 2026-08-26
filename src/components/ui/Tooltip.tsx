import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'right' | 'left' | 'top' | 'bottom';
  delayMs?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'right',
  delayMs = 200,
}) => {
  const posClasses: Record<string, string> = {
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  };

  if (!content) {
    return <>{children}</>;
  }

  return (
    <div className="relative group/tooltip inline-flex">
      {children}
      <div
        role="tooltip"
        className={`
          pointer-events-none absolute z-50 whitespace-nowrap
          px-2.5 py-1.5 rounded-lg text-[11px] font-bold
          bg-[#1B1B1B] text-white shadow-lg
          opacity-0 scale-95
          transition-all duration-200 ease-out
          group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100
          ${posClasses[side]}
        `}
        style={{ transitionDelay: `${delayMs}ms` }}
      >
        {content}
        {/* arrow */}
        <span
          className={`absolute w-1.5 h-1.5 bg-[#1B1B1B] rotate-45 ${
            side === 'right'
              ? 'left-[-3px] top-1/2 -translate-y-1/2'
              : side === 'left'
              ? 'right-[-3px] top-1/2 -translate-y-1/2'
              : side === 'top'
              ? 'bottom-[-3px] left-1/2 -translate-x-1/2'
              : 'top-[-3px] left-1/2 -translate-x-1/2'
          }`}
        />
      </div>
    </div>
  );
};
