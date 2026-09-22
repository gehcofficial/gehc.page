import React, { useEffect, useState } from 'react';
import { Sparkles, KeyRound, AtSign, UserCheck, PartyPopper, MessageCircle, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { fmt } from '../../lib/portal-i18n';
import { buildPortalPath, roleToNamespace } from '../../lib/portal-routes';
import { readStoredString, writeStored } from '../../lib/safe-storage';
import { shouldShowWelcome, welcomeDismissKey } from '../../lib/welcome';

const invitedKey = (userId: string) => `gehc_invited_welcome_${userId}`;

/**
 * Satu modal selamat datang kontekstual (P2-3):
 * - onboardingPath INVITED → kredensial login (username/Google).
 * - role Beyonders dengan kelompok → arahan gabung grup WhatsApp.
 * Menggantikan `InvitedWelcomeModal` + kartu `MenteeWelcomeCard` (dashboard).
 */
export const PortalWelcomeModal: React.FC = () => {
  const { authUser, currentUser, currentRole, userAssignedGroupId, groups, groupBatches } = useApp();
  const { t } = useLang();
  const w = t.portal.welcome;

  const [invited, setInvited] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [waUrl, setWaUrl] = useState<string | null>(null);

  const groupId = userAssignedGroupId || '';
  const group = groups.find((g) => g.id === groupId);

  useEffect(() => {
    if (!authUser?.id) { setInvited(false); return; }
    if (authUser.onboardingPath !== 'INVITED' || authUser.mustChangePassword) { setInvited(false); return; }
    setInvited(!readStoredString(invitedKey(authUser.id)));
  }, [authUser?.id, authUser?.onboardingPath, authUser?.mustChangePassword]);

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

  const menteeWelcome = shouldShowWelcome({ role: currentRole, groupId, dismissed });
  const batch = groupBatches
    .filter((b) => b.group_id === groupId)
    .sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  const mentor = batch?.mentor || '';

  if (!authUser || (!invited && !menteeWelcome)) return null;

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-[75] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#D9D7D0] shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );

  if (invited) {
    const dismissInvited = () => {
      writeStored(invitedKey(authUser.id), '1');
      setInvited(false);
    };
    const goSecurity = () => {
      dismissInvited();
      window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'security' }).slice(1);
    };
    return shell(
      <>
        <div className="bg-gradient-to-br from-[#FF416C] to-[#E94057] px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <p className="text-sm font-black">Selamat datang di portal GEHC</p>
          </div>
          <p className="text-[11px] text-white/90 mt-1">
            Anda diundang langsung — akses penuh sudah aktif. Lengkapi profil kapan saja.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-[#8C8880]">
            Halo <strong className="text-[#1B1B1B]">{authUser.name}</strong>, berikut cara login Anda:
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2.5">
              <AtSign className="w-4 h-4 text-[#FF416C] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#1B1B1B]">Username</p>
                <p className="text-[11px] font-mono text-[#FF416C]">{authUser.loginUsername || '—'}</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2.5">
              <KeyRound className="w-4 h-4 text-[#FF416C] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#1B1B1B]">Password</p>
                <p className="text-[11px] text-[#8C8880]">Pakai password yang diberikan admin (sudah diganti jika diminta).</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2.5">
              <UserCheck className="w-4 h-4 text-[#FF416C] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#1B1B1B]">Google (opsional)</p>
                <p className="text-[11px] text-[#8C8880]">Tautkan nanti di Akun → Keamanan. Password tetap jadi cadangan.</p>
              </div>
            </li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={dismissInvited} className="flex-1 py-2.5 rounded-xl bg-[#181818] text-white text-xs font-bold">
              Mulai pakai portal
            </button>
            {!authUser.googleLinked && (
              <button type="button" onClick={goSecurity} className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold hover:bg-gray-50">
                Taut Google sekarang
              </button>
            )}
          </div>
        </div>
      </>,
    );
  }

  const dismissMentee = () => {
    if (authUser.id && groupId) writeStored(welcomeDismissKey(authUser.id, groupId), '1');
    setDismissed(true);
  };

  return shell(
    <>
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <PartyPopper className="w-5 h-5" />
          <p className="text-sm font-black">{fmt(w.title, { name: currentUser.name })}</p>
        </div>
        <p className="text-[11px] text-white/90 mt-1">{fmt(w.subtitle, { group: group?.name || '—' })}</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-[#5C5850]">
          {mentor && <span>{fmt(w.mentorTpl, { mentor })}</span>}
          {batch?.comentor && <span>{fmt(w.comentorTpl, { comentor: batch.comentor })}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow">
              <MessageCircle className="w-4 h-4" /> {fmt(w.joinWa, { group: group?.name || '' })}
            </a>
          ) : (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {fmt(w.noWa, { mentor: mentor || 'mentor' })}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              dismissMentee();
              window.location.hash = buildPortalPath({ namespace: roleToNamespace(currentRole), page: 'groups-monitoring' }).slice(1);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#D9D7D0] bg-white text-xs font-bold text-[#5C5850] hover:border-[#1B1B1B]"
          >
            <Users className="w-4 h-4" /> {w.viewGroup}
          </button>
        </div>
        <button type="button" onClick={dismissMentee} className="w-full py-2.5 rounded-xl border border-[#D9D7D0] text-[#8C8880] text-xs font-bold hover:bg-gray-50">
          {w.dismiss}
        </button>
      </div>
    </>,
  );
};
