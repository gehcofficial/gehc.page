import React from 'react';
import { ROLE_CHIP_COLORS } from '../../lib/status-colors';

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: keyof typeof ROLE_CHIP_COLORS | 'neutral';
  className?: string;
}> = ({ children, tone = 'neutral', className = '' }) => {
  const colors =
    tone === 'neutral'
      ? 'bg-gray-100 text-gray-700'
      : ROLE_CHIP_COLORS[tone] || ROLE_CHIP_COLORS.neutral;
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${colors} ${className}`}>
      {children}
    </span>
  );
};
