import React from 'react';
import { Crown, Heart, Users } from 'lucide-react';
import { shortName } from '../../lib/privacy-name';
import { displayAvatar } from '../../lib/avatar';

interface NodeProps {
  name: string;
  label: string;
  color: string;
  icon?: React.ReactNode;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const initialsOf = (name: string) =>
  name
    .replace(/[^A-Za-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

export const PersonNode: React.FC<NodeProps> = ({ name, label, color, icon, photoUrl, size = 'md' }) => {
  const dims =
    size === 'lg' ? 'w-16 h-16 text-base' : size === 'sm' ? 'w-9 h-9 text-[10px]' : 'w-12 h-12 text-sm';
  const photo = photoUrl ? displayAvatar(name, photoUrl) : '';
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[86px]">
      <div className="relative">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className={`${dims} rounded-full object-cover shadow-md border-2 border-white shrink-0`}
          />
        ) : (
          <div
            className={`${dims} rounded-full flex items-center justify-center font-black shadow-md border-2 border-white shrink-0`}
            style={{ backgroundColor: `${color}22`, color }}
          >
            {icon ?? initialsOf(name)}
          </div>
        )}
        {photo && icon ? (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm [&>svg]:w-2.5 [&>svg]:h-2.5"
            style={{ backgroundColor: color }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="text-center leading-tight">
        <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8C8880]">{label}</span>
        <span className={`block font-bold text-[#1B1B1B] ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}>
          {shortName(name)}
        </span>
      </div>
    </div>
  );
};

const ConnectorVertical: React.FC<{ color: string }> = ({ color }) => (
  <div className="flex justify-center py-1">
    <div className="w-0.5 h-5 rounded-full" style={{ backgroundColor: `${color}66` }} />
  </div>
);

/** Pohon keluarga mini: hanya Mentor & Comentor aktif — kartu carousel */
export const MiniFamilyTree: React.FC<{
  mentor: string;
  comentor: string;
  color: string;
  mentorAvatar?: string | null;
  comentorAvatar?: string | null;
}> = ({ mentor, comentor, color, mentorAvatar, comentorAvatar }) => (
  <div className="relative p-4 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/60 overflow-hidden">
    <div
      className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
      style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }}
    />
    <div className="flex items-center gap-1.5 mb-3 mt-1">
      <Users className="w-3 h-3" style={{ color }} />
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#8C8880]">Active Leaders</span>
    </div>
    <div className="flex flex-col items-center">
      <PersonNode
        name={mentor}
        label="Mentor"
        color={color}
        icon={<Crown className="w-4 h-4" />}
        photoUrl={mentorAvatar}
      />
      <ConnectorVertical color={color} />
      <PersonNode
        name={comentor}
        label="Co-Mentor"
        color={color}
        icon={<Heart className="w-4 h-4" />}
        photoUrl={comentorAvatar}
      />
    </div>
  </div>
);

interface MenteeNode {
  name: string;
  note?: string;
  avatar?: string;
}

/** Pohon keluarga lengkap: Mentor → Comentor → seluruh Mentee */
export const FullFamilyTree: React.FC<{
  mentor: string;
  comentor: string;
  mentees: MenteeNode[];
  color: string;
  mentorAvatar?: string | null;
  comentorAvatar?: string | null;
}> = ({ mentor, comentor, mentees, color, mentorAvatar, comentorAvatar }) => (
  <div className="relative p-6 sm:p-8 rounded-[28px] bg-white border border-[#D9D7D0]/50 overflow-hidden">
    <div
      className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
      style={{ backgroundColor: color }}
    />
    <div className="relative flex flex-col items-center">
      <PersonNode
        name={mentor}
        label="Mentor"
        color={color}
        size="lg"
        icon={<Crown className="w-6 h-6" />}
        photoUrl={mentorAvatar}
      />
      <ConnectorVertical color={color} />
      <PersonNode
        name={comentor}
        label="Co-Mentor"
        color={color}
        icon={<Heart className="w-4 h-4" />}
        photoUrl={comentorAvatar}
      />

      {mentees.length > 0 && (
        <>
          <ConnectorVertical color={color} />
          <div className="w-full max-w-2xl flex flex-col items-center">
            <div className="w-full h-0.5 rounded-full max-w-md" style={{ backgroundColor: `${color}44` }} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5 pt-5 w-full justify-items-center">
              {mentees.map((m) => (
                <PersonNode
                  key={m.name}
                  name={m.name}
                  label={`Mentee${m.note ? ' ' + m.note : ''}`}
                  color="#8C8880"
                  size="sm"
                  photoUrl={m.avatar}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  </div>
);
