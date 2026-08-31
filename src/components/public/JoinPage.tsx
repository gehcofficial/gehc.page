import React, { useEffect } from 'react';
import { parseHashRoute } from '../../lib/hash-routes';
import { InviteJoinPage, LegacyWaitlistPage } from './auth/InviteJoinPage';

export { GiftTestWizard } from './auth/shared/GiftTestWizard';

/** Legacy redirect hub — `#/join` tanpa inv/token → register; event=bakutau → event page. */
export const JoinPage: React.FC = () => {
  useEffect(() => {
    const { params, tab } = parseHashRoute();
    const token = params.get('token');
    const inv = params.get('inv');
    const event = params.get('event');

    if (token || inv) return;
    if (event === 'bakutau') {
      window.location.replace('#/event/bakutau');
      return;
    }
    if (tab === 'join') {
      window.location.replace('#/register');
    }
  }, []);

  const { params } = parseHashRoute();
  const tokenFromUrl = params.get('token');
  const invFromUrl = params.get('inv');

  if (tokenFromUrl) {
    return (
      <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#FF416C] mb-2">Legacy Waitlist</p>
        <h1 className="text-3xl font-black mb-8">Lengkapi Profil</h1>
        <LegacyWaitlistPage token={tokenFromUrl} />
      </section>
    );
  }

  if (invFromUrl) {
    return (
      <section className="pt-[130px] sm:pt-[160px] pb-24 px-4 max-w-xl mx-auto">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#FF416C] mb-2">Undangan Panitia</p>
        <h1 className="text-3xl font-black mb-8">Gabung Tim Pelayanan</h1>
        <InviteJoinPage code={invFromUrl} />
      </section>
    );
  }

  return (
    <section className="pt-[130px] pb-24 px-4 max-w-xl mx-auto text-center">
      <p className="text-sm text-[#8C8880]">Mengalihkan…</p>
    </section>
  );
};
