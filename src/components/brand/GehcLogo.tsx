import React from 'react';
import { useMediaSlots } from '../../hooks/useMediaSlots';

type GehcLogoProps = {
  size?: number;
  className?: string;
  rounded?: 'full' | 'xl';
  fallbackLabel?: string;
};

export const GehcLogo: React.FC<GehcLogoProps> = ({
  size = 36,
  className = '',
  rounded = 'full',
  fallbackLabel = 'GEHC',
}) => {
  const src = useMediaSlots().brand?.logoGehc;
  const roundCls = rounded === 'xl' ? 'rounded-xl' : 'rounded-full';

  if (src) {
    return (
      <div
        className={`${roundCls} bg-white shadow-sm flex items-center justify-center shrink-0 overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          key={src}
          src={src}
          alt="GEHC"
          className="w-[82%] h-[82%] object-contain"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </div>
    );
  }

  const textCls = size >= 56 ? 'text-lg' : size >= 40 ? 'text-sm' : 'text-xs';

  return (
    <div
      className={`${roundCls} bg-gradient-to-tr from-[#FF416C] to-[#FF4B2B] flex items-center justify-center shrink-0 ${textCls} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="text-white font-black tracking-tight leading-none">{fallbackLabel}</span>
    </div>
  );
};
