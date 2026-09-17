import React, { useEffect, useState } from 'react';
import { PartyPopper, MessageCircle, Users, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { fmt } from '../../lib/portal-i18n';
import { readStoredString, writeStored } from '../../lib/safe-storage';
import { shouldShowWelcome, welcomeDismissKey } from '../../lib/welcome';

/**
 * Kartu selamat datang untuk anggota baru (MENTEE/CO_MENTOR/MENTOR) yang sudah
 * punya kelompok — mengarahkan mereka gabung grup WhatsApp kelompok.
 * Dismiss per user+grup (localStorage), jadi pindah grup baru → muncul lagi.
 */
export const MenteeWelcomeCard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { authUser, currentUser, currentRole, userAssignedGroupId, groups, groupBatches } = useApp();
  const { t } = useLang();
  const w = t.portal.welcome;

  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const groupId = userAssignedGroupId || '';
  const group = groups.find((g) => g.id === groupId);

  useEffect(() => {
    if (!authUser?.id || !groupId) return;
    setDismissed(readStoredString(welcomeDismissKey(authUser.id, groupId)) === '1');
  }, [authUser?.id, groupId]);

  useEffect(() => {
    if (!groupId) { setWaUrl(null); return; }
    fetch('/api/channel-links/scoped', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const link = (d?.links || []).find((l: { kind: string; refId: string }) => l.kind === 'GROUP' && l.refId === groupId);
        setWaUrl(link?.url || null);
      })
      .catch(() => setWaUrl(null));
  }, [groupId]);

  const batch = groupBatches
    .filter((b) => b.group_id === groupId)
    .sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const mentor = batch?.mentor || '';

  if (!shouldShowWelcome({ role: currentRole, groupId, dismissed })) return null;

  const dismiss = () => {
    if (authUser?.id && groupId) writeStored(welcomeDismissKey(authUser.id, groupId), '1');
    setDismissed(true);
  };

  return (
    <div className="rounded-[28px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-2">
            <PartyPopper className="w-3 h-3" /> {w.tag}
          </span>
          <h2 className="text-xl font-black text-[#1B1B1B]">
            {fmt(w.title, { name: currentUser.name })}
          </h2>
          <p className="text-sm text-[#5C5850] mt-1 leading-relaxed">
            {fmt(w.subtitle, { group: group?.name || '—' })}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-semibold text-[#5C5850]">
            {mentor && <span>{fmt(w.mentorTpl, { mentor })}</span>}
            {batch?.comentor && <span>{fmt(w.comentorTpl, { comentor: batch.comentor })}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-[#8C8880] hover:bg-white shrink-0"
          title={w.dismiss}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow"
          >
            <MessageCircle className="w-4 h-4" /> {fmt(w.joinWa, { group: group?.name || '' })}
          </a>
        ) : (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {fmt(w.noWa, { mentor: mentor || 'mentor' })}
          </p>
        )}
        <button
          type="button"
          onClick={() => onNavigate('groups-monitoring')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#D9D7D0] bg-white text-xs font-bold text-[#5C5850] hover:border-[#1B1B1B]"
        >
          <Users className="w-4 h-4" /> {w.viewGroup}
        </button>
      </div>
    </div>
  );
};
