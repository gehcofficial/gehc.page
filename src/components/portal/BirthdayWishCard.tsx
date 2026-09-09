import React, { useEffect, useState } from 'react';
import { Cake } from 'lucide-react';
import { displayAvatar } from '../../lib/avatar';

type BirthdayPerson = {
  id: string;
  name: string;
  avatar?: string | null;
  age?: number | null;
};

function renderCaption(caption: string, name: string, age?: number | null) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'Jemaat';
  return caption
    .split('{nama}').join(first)
    .split('{umur}').join(age === null || age === undefined ? '–' : String(age));
}

/**
 * Kartu ucapan HUT hari ini (dashboard). Foto + caption dari panel Komisi.
 * Tidak tampil bila tak ada yang ultah hari ini.
 */
export const BirthdayWishCard: React.FC<{ birthdays: BirthdayPerson[] }> = ({ birthdays }) => {
  const [caption, setCaption] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    if (!birthdays.length) return;
    fetch('/api/birthday/wish', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { caption?: string; photoUrl?: string }) => {
        setCaption(d.caption || '');
        setPhotoUrl(d.photoUrl || '');
      })
      .catch(() => {});
  }, [birthdays.length]);

  if (!birthdays.length) return null;

  return (
    <div className="rounded-[32px] overflow-hidden border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-amber-50 shadow-sm">
      {photoUrl && (
        <img src={photoUrl} alt="Ucapan ulang tahun" className="w-full max-h-52 object-cover" />
      )}
      <div className="p-6">
        <p className="text-[11px] font-black uppercase tracking-wider text-pink-700 flex items-center gap-1.5">
          <Cake className="w-4 h-4" /> Selamat ulang tahun! 🎉
        </p>
        <div className="flex flex-wrap gap-2 mt-3 mb-2">
          {birthdays.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-pink-200 text-[#1B1B1B]">
              <img src={displayAvatar(b.name, b.avatar)} alt="" className="w-7 h-7 rounded-full object-cover" />
              {b.name}{typeof b.age === 'number' ? ` · ${b.age}` : ''}
            </span>
          ))}
        </div>
        <p className="text-xs text-[#5C5850] leading-relaxed whitespace-pre-wrap">
          {renderCaption(caption || 'Selamat ulang tahun, {nama}! Tuhan Yesus memberkati di usia {umur} tahun. 🎉', birthdays[0].name, birthdays[0].age)}
        </p>
        <p className="text-[10px] text-[#8C8880] mt-2">dari GMIM Eben Haezer Cikarang</p>
      </div>
    </div>
  );
};
