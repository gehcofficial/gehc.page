import React from 'react';

export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { padding?: 'sm' | 'md' | 'lg' }
> = ({ padding = 'md', className = '', children, ...props }) => {
  const pad = padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-8' : 'p-6';
  return (
    <div
      className={`bg-white rounded-card-lg border border-line/50 shadow-sm ${pad} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
