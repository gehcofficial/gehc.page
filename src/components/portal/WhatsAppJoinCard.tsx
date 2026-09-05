import React from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';

export const WhatsAppJoinCard: React.FC<{
  title: string;
  url?: string | null;
  emptyHint?: string;
}> = ({ title, url, emptyHint }) => {
  const href = url?.trim() || '';
  return (
    <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
          WhatsApp
        </p>
        <p className="text-sm font-bold text-[#1B1B1B] mt-1 truncate">{title}</p>
        {!href && (
          <p className="text-[11px] text-[#8C8880] mt-1">
            {emptyHint || 'Tautan belum diisi di Kanal WhatsApp.'}
          </p>
        )}
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
        >
          Buka grup
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : null}
    </div>
  );
};
