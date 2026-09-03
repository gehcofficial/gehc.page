import React, { useLayoutEffect, useRef } from 'react';

const HIDE_SCROLL =
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const ScrollTabBar: React.FC<{
  children: React.ReactNode;
  className?: string;
  track?: boolean;
  gapClass?: string;
  active?: string;
}> = ({ children, className = '', track = true, gapClass = 'gap-1', active }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>('[aria-selected="true"], [data-active="true"]');
    if (!el) return;
    const left = el.offsetLeft - (root.clientWidth - el.offsetWidth) / 2;
    root.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [active]);

  return (
    <div
      ref={ref}
      role="tablist"
      className={`flex flex-nowrap ${gapClass} overflow-x-auto overscroll-x-contain touch-pan-x [&>*]:shrink-0 ${HIDE_SCROLL} ${
        track ? 'p-1 bg-[#FAF9F5] rounded-xl border border-[#D9D7D0]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
