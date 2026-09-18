import React, { useMemo } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { useMyChannels, type MyChannel } from '../../hooks/usePortalQueries';

const KIND_ICON: Record<string, string> = {
  LEADERSHIP: '🛡️',
  BIPRA: '⛪',
  KOLOM: '🗺️',
  GROUP: '👥',
  DIVISION: '🧩',
  RECREATIONAL: '⚽',
};

/**
 * Kartu "Grup WhatsApp Saya" di Dashboard.
 * Isinya sudah tersaring di server: anggota hanya klusternya, pengurus melihat ke bawah.
 */
export const MyChannelsCard: React.FC = () => {
  const { t } = useLang();
  const { data } = useMyChannels(true);
  const mc = t.portal.myChannels;

  const channels = useMemo(
    () => (data?.channels || []).filter((c) => c.url),
    [data],
  );

  if (!channels.length) return null;

  const kindLabel = (kind: string) => ({
    LEADERSHIP: mc.kindLeadership,
    BIPRA: mc.kindBipra,
    KOLOM: mc.kindKolom,
    GROUP: mc.kindGroup,
    DIVISION: mc.kindDivision,
    RECREATIONAL: mc.kindRecreational,
  } as Record<string, string>)[kind] || kind;

  return (
    <div className="rounded-[32px] border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm space-y-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4" /> {mc.title}
        </p>
        <p className="text-xs text-[#5C5850] mt-0.5">{mc.subtitle}</p>
      </div>
      <ul className="grid sm:grid-cols-2 gap-1.5">
        {channels.map((c: MyChannel) => (
          <li key={`${c.kind}-${c.refId}`}>
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300"
            >
              <span className="text-base shrink-0" aria-hidden>{KIND_ICON[c.kind] || '💬'}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-[#1B1B1B] truncate">{c.label || c.refId}</span>
                <span className="block text-[10px] text-[#8C8880]">{kindLabel(c.kind)}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 shrink-0">
                {mc.join} <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
