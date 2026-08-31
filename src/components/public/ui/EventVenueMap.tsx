import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

type Props = {
  venueName: string;
  locationDetail?: string;
  mapUrl?: string | null;
  embedQuery?: string;
  compact?: boolean;
  inverted?: boolean;
};

export const EventVenueMap: React.FC<Props> = ({
  venueName,
  locationDetail,
  mapUrl,
  embedQuery,
  compact = false,
  inverted = false,
}) => {
  const query = embedQuery || venueName;
  const embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=id&z=16&output=embed`;
  const titleCls = inverted ? 'text-white' : 'text-[#1B1B1B]';
  const subCls = inverted ? 'text-white/60' : 'text-[#8C8880]';
  const chipCls = inverted ? 'bg-white/10 hover:bg-white/20 text-white/90' : 'bg-[#F3F1EC] hover:bg-[#E8E5DC] text-[#5C5850]';

  return (
    <div className={`space-y-3 ${compact ? '' : 'mt-1'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs font-bold flex items-center gap-1.5 ${titleCls}`}>
            <MapPin className="w-3.5 h-3.5 text-[#FF416C] shrink-0" />
            {venueName}
          </p>
          {locationDetail && (
            <p className={`text-[10px] mt-0.5 leading-relaxed ${subCls}`}>{locationDetail}</p>
          )}
        </div>
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 transition-colors ${chipCls}`}
          >
            Buka Maps
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className={`overflow-hidden rounded-2xl border border-[#D9D7D0]/60 bg-[#F3F1EC] ${compact ? 'h-36' : 'h-44 sm:h-52'}`}>
        <iframe
          title={`Peta ${venueName}`}
          src={embedSrc}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
};
