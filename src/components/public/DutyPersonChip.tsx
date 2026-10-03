import React, { useState } from 'react';
import {
  BookOpen,
  Brush,
  Camera,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  ClipboardCheck,
  DoorOpen,
  Drum,
  Flame,
  Gift,
  Guitar,
  HandHeart,
  Heart,
  Home,
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
  BookOpen, Brush, Camera, ChevronDown, ChevronRight, Clapperboard, ClipboardCheck, DoorOpen, Drum, Flame, Gift, Guitar,
  HandHeart, Heart, Home, Megaphone, Mic, Music, Palette, Piano, Sparkles, User, Users,
  UtensilsCrossed, Video, Volume2,
};

/** Kata kunci peran → nama ikon lucide. Tak cocok → ikon divisi. */
const ROLE_KEYWORDS: Array<[string, string]> = [
  ['pemimpin pujian', 'Mic'],
  ['pemimpin liturgi', 'Flame'],
  ['paduan suara', 'Music'],
  ['penyanyi', 'Music'],
  ['keyboard', 'Piano'],
  ['gitar', 'Guitar'],
  ['bass', 'Guitar'],
  ['drum', 'Drum'],
  ['cajon', 'Drum'],
  ['rebana', 'Music'],
  ['pemusik', 'Music'],
  ['pembaca firman', 'BookOpen'],
  ['doa syafaat', 'Flame'],
  ['doa persembahan', 'Gift'],
  ['pengumpul persembahan', 'Gift'],
  ['pembawa acara', 'Megaphone'],
  ['koordinator tuan rumah', 'Users'],
  ['penerima tamu', 'DoorOpen'],
  ['absensi', 'ClipboardCheck'],
  ['dekorasi', 'Sparkles'],
  ['kebersihan', 'Brush'],
  ['penataan ruang', 'Brush'],
  ['konsumsi', 'UtensilsCrossed'],
  ['tata suara', 'Volume2'],
  ['multimedia', 'Video'],
  ['siaran langsung', 'Video'],
  ['videografer', 'Video'],
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

/** Divisi di bawah Penanggung Jawab vs Tuan Rumah. */
const JAWAB_DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'MARTURIA'];
const RUMAH_DIVISIONS = ['KOINONIA', 'DIAKONIA'];

const inDivs = (people: DutyPerson[], divs: string[]) =>
  people.filter((p) => divs.includes(String(p.division || '').toUpperCase()));

/** Satu seksi collapsible (trigger kiri): Penanggung Jawab / Tuan Rumah. */
const DutySection: React.FC<{
  title: string;
  icon: LucideIcon;
  people: DutyPerson[];
  children: React.ReactNode;
}> = ({ title, icon: Icon, people, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#8C8880] hover:text-[#1B1B1B] transition-colors"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{title} · {people.length}</span>
        {!open && people.length > 0 && (
          <span className="flex items-center ml-1">
            {people.slice(0, 4).map((p) => (
              <img
                key={p.name}
                src={displayAvatar(p.name, p.avatar)}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-5 h-5 rounded-full object-cover border border-white bg-[#EFEDE8] -ml-1.5 first:ml-0"
              />
            ))}
          </span>
        )}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
};

/**
 * Blok pelayanan satu hari: Penanggung Jawab (Liturgia/Didaskalia/Marturia)
 * + Tuan Rumah (Koinonia/Diakonia dari role yang di-assign). Nama grup
 * (penanggung & tuan rumah) tetap tampil walau petugas belum ada;
 * daftar anggota otomatis tidak ditampilkan. Konsisten mentoring & serving day.
 */
export const ServiceDutySections: React.FC<{
  duties: DutyPerson[];
  responsible?: string | null;
  host?: string | null;
  projected?: boolean;
}> = ({ duties, responsible, host, projected }) => {
  const jawab = groupPeopleByDivision(inDivs(duties, JAWAB_DIVISIONS));
  const rumah = groupPeopleByDivision(inDivs(duties, RUMAH_DIVISIONS));
  const jawabPeople = jawab.flatMap((g) => g.people);
  const rumahPeople = rumah.flatMap((g) => g.people);
  if (!responsible && !host && !jawabPeople.length && !rumahPeople.length) return null;
  return (
    <div className="space-y-3">
      <DutySection title="Penanggung Jawab" icon={HandHeart} people={jawabPeople}>
        {responsible && (
          <p className="text-xs font-bold text-[#1B1B1B]">
            {responsible}
            {projected ? <span className="font-normal text-[#8C8880]"> (perkiraan)</span> : null}
          </p>
        )}
        {jawab.map((g) => (
          <DivisionDutyGroup key={g.division || 'lainnya'} group={g} />
        ))}
        {!jawabPeople.length && <p className="text-[10px] text-[#B8B4AC]">Petugas belum ada.</p>}
      </DutySection>
      <DutySection title="Tuan Rumah" icon={Home} people={rumahPeople}>
        {host && (
          <p className="text-xs font-bold text-[#1B1B1B]">
            {host}
            {projected ? <span className="font-normal text-[#8C8880]"> (perkiraan)</span> : null}
          </p>
        )}
        {rumah.map((g) => (
          <DivisionDutyGroup key={g.division || 'lainnya'} group={g} />
        ))}
        {!rumahPeople.length && <p className="text-[10px] text-[#B8B4AC]">Belum ada.</p>}
      </DutySection>
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

