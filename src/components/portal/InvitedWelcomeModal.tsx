import React, { useEffect, useState } from 'react';
import { Sparkles, KeyRound, AtSign, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { buildPortalPath } from '../../lib/portal-routes';
import { readStoredString, writeStored } from '../../lib/safe-storage';

const storageKey = (userId: string) => `gehc_invited_welcome_${userId}`;

export const InvitedWelcomeModal: React.FC = () => {
  const { authUser } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!authUser?.id) return;
    if (authUser.onboardingPath !== 'INVITED') return;
    if (authUser.mustChangePassword) return;
    if (readStoredString(storageKey(authUser.id))) return;
    setOpen(true);
  }, [authUser?.id, authUser?.onboardingPath, authUser?.mustChangePassword]);

  if (!open || !authUser) return null;

  const dismiss = () => {
    writeStored(storageKey(authUser.id), '1');
    setOpen(false);
  };

  const goSecurity = () => {
    dismiss();
    window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'security' }).slice(1);
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#D9D7D0] shadow-xl overflow-hidden">
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
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-xl bg-[#181818] text-white text-xs font-bold"
            >
              Mulai pakai portal
            </button>
            {!authUser.googleLinked && (
              <button
                type="button"
                onClick={goSecurity}
                className="flex-1 py-2.5 rounded-xl border border-[#D9D7D0] text-[#1B1B1B] text-xs font-bold hover:bg-gray-50"
              >
                Taut Google sekarang
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
