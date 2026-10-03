import React from 'react';
import {
  BookOpen,
  Brush,
  Camera,
  Clapperboard,
  ClipboardCheck,
  DoorOpen,
  Drum,
  Flame,
  Gift,
  Guitar,
  HandHeart,
  Heart,
  Megaphone,
  Mic,
  Music,
  Palette,
  Piano,
  Sparkles,
  User,
  Users,
  UtensilsCrossed,
  Video,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { displayAvatar } from '../../lib/avatar';

export type DutyPerson = {
  name: string;
  avatar?: string | null;
  role?: string | null;
  division?: string | null;
};

/** Warna + ikon baku per divisi panca (selaras StrukturSection & DivisionPhaseTabs). */
export const DIVISION_STYLE: Record<string, { color: string; icon: string }> = {
  LITURGIA: { color: '#7C3AED', icon: 'Flame' },
  DIDASKALIA: { color: '#0EA5E9', icon: 'BookOpen' },
  KOINONIA: { color: '#059669', icon: 'Heart' },
  DIAKONIA: { color: '#EA580C', icon: 'HandHeart' },
  MARTURIA: { color: '#DC2626', icon: 'Megaphone' },
};

export function divisionStyleFor(division?: string | null): { color: string; icon: string } {
  return DIVISION_STYLE[String(division || '').toUpperCase()] || { color: '#8C8880', icon: 'User' };
}

const ICONS: Record<string, LucideIcon> = {
  BookOpen, Brush, Camera, Clapperboard, ClipboardCheck, DoorOpen, Drum, Flame, Gift, Guitar,
  HandHeart, Heart, Megaphone, Mic, Music, Palette, Piano, Sparkles, User, Users,
  UtensilsCrossed, Video, Volume2,
};

/** Kata kunci peran → nama ikon lucide. Tak cocok → ikon divisi. */
const ROLE_KEYWORDS: Array<[string, string]> = [
  ['worship leader', 'Mic'],
  ['song leader', 'Music'],
  ['kantoria', 'Music'],
  ['rebana', 'Music'],
  ['keyboard', 'Piano'],
  ['gitar', 'Guitar'],
  ['bass', 'Guitar'],
  ['drum', 'Drum'],
  ['pemusik', 'Music'],
  ['singer', 'Music'],
  ['pembaca firman', 'BookOpen'],
  ['doa syafaat', 'Flame'],
  ['doa persembahan', 'Gift'],
  ['kolektor', 'Gift'],
  ['mc', 'Megaphone'],
  ['koordinator tuan rumah', 'Users'],
  ['usher', 'DoorOpen'],
  ['penerima tamu', 'DoorOpen'],
  ['absensi', 'ClipboardCheck'],
  ['dekorasi', 'Sparkles'],
  ['kebersihan', 'Brush'],
  ['penataan ruang', 'Brush'],
  ['konsumsi', 'UtensilsCrossed'],
  ['sound', 'Volume2'],
  ['multimedia', 'Video'],
  ['live streaming', 'Video'],
  ['kameramen', 'Video'],
  ['fotografer', 'Camera'],
  ['editor video', 'Clapperboard'],
  ['desain', 'Palette'],
];

export function roleIconName(role?: string | null, division?: string | null): string {
  const r = String(role || '').toLowerCase();
  for (const [kw, icon] of ROLE_KEYWORDS) {
    if (r.includes(kw)) return icon;
  }
  return divisionStyleFor(division).icon;
}

export function roleIconFor(role?: string | null, division?: string | null): LucideIcon {
  return ICONS[roleIconName(role, division)] || ICONS[divisionStyleFor(division).icon] || Users;
}

/** Urutan seksi divisi (Lainnya selalu terakhir). */
export const DIVISION_ORDER = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'];

export type DivisionPeopleGroup = {
  /** Kode divisi panca, atau null = Lainnya. */
  division: string | null;
  people: DutyPerson[];
};

/** Kelompokkan orang per divisi panca sesuai urutan baku. */
export function groupPeopleByDivision(people: DutyPerson[]): DivisionPeopleGroup[] {
  const buckets = new Map<string | null, DutyPerson[]>();
  for (const p of people) {
    const div = String(p.division || '').toUpperCase();
    const key = (DIVISION_ORDER as string[]).includes(div) ? div : null;
    const list = buckets.get(key) || [];
    list.push(p);
    buckets.set(key, list);
  }
  const out: DivisionPeopleGroup[] = [];
  for (const div of DIVISION_ORDER) {
    const list = buckets.get(div);
    if (list?.length) out.push({ division: div, people: list });
  }
  const rest = buckets.get(null);
  if (rest?.length) out.push({ division: null, people: rest });
  return out;
}

/** Seksi satu divisi: header ikon+warna+jumlah + chip anggotanya. */
export const DivisionDutyGroup: React.FC<{ group: DivisionPeopleGroup }> = ({ group }) => {
  const style = divisionStyleFor(group.division);
  const Icon = ICONS[style.icon] || Users;
  const label = group.division
    ? group.division.charAt(0) + group.division.slice(1).toLowerCase()
    : 'Lainnya';
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: style.color }}>
        <Icon className="w-3 h-3" /> {label} · {group.people.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {group.people.map((p) => (
          <DutyPersonChip key={`${p.name}-${p.role || ''}`} person={p} />
        ))}
      </div>
    </div>
  );
};

/** Chip satu orang: foto + nama + badge ikon peran/divisi. */
export const DutyPersonChip: React.FC<{ person: DutyPerson; color?: string }> = ({ person, color }) => {
  const style = divisionStyleFor(person.division);
  const Icon = roleIconFor(person.role, person.division);
  const accent = color || style.color;
  return (
    <span
      title={[person.role, person.division].filter(Boolean).join(' · ') || person.name}
      className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0]/60 hover:border-[#1B1B1B]/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 max-w-full"
    >
      <img
        src={displayAvatar(person.name, person.avatar)}
        alt={person.name}
        loading="lazy"
        decoding="async"
        className="w-6 h-6 rounded-full object-cover shrink-0 bg-[#EFEDE8]"
      />
      <span className="text-[11px] font-bold text-[#1B1B1B] truncate">{person.name}</span>
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: accent }}
      >
        <Icon className="w-3 h-3" />
      </span>
    </span>
  );
};

/** Tumpukan foto overlap +n; klik membuka daftar chip penuh (dikelompokkan divisi). */
export const DutyAvatarStack: React.FC<{
  people: DutyPerson[];
  max?: number;
  expanded: boolean;
  onToggle: () => void;
  label: string;
  /** false = daftar datar (mis. anggota tuan rumah yang tak berdivisi). */
  grouped?: boolean;
}> = ({ people, max = 6, expanded, onToggle, label, grouped = true }) => {
  if (!people.length) return null;
  const shown = expanded ? people : people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div>
      <div className="flex items-center">
        {shown.map((p) => (
          <img
            key={p.name}
            src={displayAvatar(p.name, p.avatar)}
            alt={p.name}
            title={p.name}
            loading="lazy"
            decoding="async"
            className="w-8 h-8 rounded-full object-cover border-2 border-white bg-[#EFEDE8] -ml-2 first:ml-0"
          />
        ))}
        {rest > 0 && (
          <span className="-ml-2 w-8 h-8 rounded-full bg-[#1B1B1B] text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
            +{rest}
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="ml-2 text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B] underline-offset-2 hover:underline shrink-0"
        >
          {expanded ? 'Tutup' : `${label} (${people.length})`}
        </button>
      </div>
      {expanded && (
        grouped ? (
          <div className="mt-2 space-y-3">
            {groupPeopleByDivision(people).map((g) => (
              <DivisionDutyGroup key={g.division || 'lainnya'} group={g} />
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {people.map((p) => (
              <DutyPersonChip key={`${p.name}-${p.role || ''}`} person={p} />
            ))}
          </div>
        )
      )}
    </div>
  );
};
