import React from 'react';

/** Skeleton kartu generik agar loading tidak terlihat kosong/hilang. */
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-[32px] border border-[#D9D7D0]/40 bg-white overflow-hidden ${className}`}>
    <div className="h-56 w-full bg-[#F0EFEB]" />
    <div className="p-6 space-y-3">
      <div className="h-5 w-3/4 rounded-full bg-[#F0EFEB]" />
      <div className="h-3 w-1/2 rounded-full bg-[#F0EFEB]" />
      <div className="h-3 w-full rounded-full bg-[#FAF9F5] border border-[#D9D7D0]/50" />
    </div>
  </div>
);

export const WartaGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-busy="true" aria-live="polite">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

export const DutyCardsSkeleton: React.FC = () => (
  <section className="mb-12" aria-busy="true" aria-live="polite">
    <div className="mb-6 space-y-2">
      <div className="h-3 w-28 rounded-full bg-[#E8E6E0] animate-pulse" />
      <div className="h-6 w-72 max-w-full rounded-full bg-[#F0EFEB] animate-pulse" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5 animate-pulse">
          <div className="h-3 w-40 rounded-full bg-[#F0EFEB] mb-4" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-[#F0EFEB]" />
            <div className="h-3 w-2/3 rounded-full bg-[#F0EFEB]" />
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const EventsLandingSkeleton: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-live="polite">
    <div className="rounded-[32px] border border-[#D9D7D0]/40 bg-white overflow-hidden animate-pulse">
      <div className="h-64 sm:h-80 w-full bg-[#F0EFEB]" />
      <div className="p-6 space-y-3">
        <div className="h-6 w-2/3 rounded-full bg-[#F0EFEB]" />
        <div className="h-3 w-1/3 rounded-full bg-[#F0EFEB]" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {[0, 1, 2].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  </div>
);
