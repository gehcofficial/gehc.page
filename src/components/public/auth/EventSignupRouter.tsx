import React from 'react';
import { useApp } from '../../../context/AppContext';
import { BakutauEventPage } from './BakutauEventPage';

export const EventSignupRouter: React.FC = () => {
  const { eventSlug } = useApp();

  if (eventSlug === 'bakutau') {
    return <BakutauEventPage />;
  }

  return (
    <section className="pt-[130px] pb-24 px-4 max-w-xl mx-auto text-center">
      <h1 className="text-xl font-black mb-2">Event tidak ditemukan</h1>
      <p className="text-sm text-[#8C8880] mb-4">Slug: {eventSlug || '(kosong)'}</p>
      <a href="#/events" className="text-sm font-bold text-[#FF416C]">← Kembali ke kegiatan</a>
    </section>
  );
};
