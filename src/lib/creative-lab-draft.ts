import type { SessionActivityBrief } from './mentoring';

export type PresentSlide = {
  activityIndex: number;
  label: string;
  media: string;
  theme: string;
};

export function presentSlidePlan(brief?: SessionActivityBrief | null): PresentSlide[] {
  const acts = brief?.activities || [];
  const art = acts.filter((a) => a.index >= 2);
  const slides: PresentSlide[] = art.map((a, i) => {
    const media = a.stationMedia || a.title || `Aktivitas ${a.index}`;
    const letter = String.fromCharCode(65 + Math.min(i, 25));
    return {
      activityIndex: a.index,
      label: `Slide Stasiun ${letter} · ${media}`,
      media,
      theme: a.stationTheme || '',
    };
  });
  slides.push({
    activityIndex: 0,
    label: 'Slide Bersama · Commitment',
    media: 'Commitment',
    theme: '',
  });
  return slides.length ? slides : [
    { activityIndex: 2, label: 'Slide Stasiun A · Stasiun A', media: 'Stasiun A', theme: '' },
    { activityIndex: 0, label: 'Slide Bersama · Commitment', media: 'Commitment', theme: '' },
  ];
}

export function presentSlideCount(brief?: SessionActivityBrief | null): number {
  return Math.max(1, presentSlidePlan(brief).length - 1);
}

/** Menit 1–10 briefing: hanya judul firman; menit 11–15: panggil perwakilan. */
export function briefingFirmanOnly(phase: string, startedAt: string | null, nowMs: number): boolean {
  if (String(phase || '').toUpperCase() !== 'IDLE') return false;
  if (!startedAt) return true;
  const elapsed = Math.max(0, nowMs - new Date(startedAt).getTime());
  return elapsed < 10 * 60 * 1000;
}
