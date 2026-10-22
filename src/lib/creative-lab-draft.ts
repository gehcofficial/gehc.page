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

export type LabArtStationSlot = {
  kind: string;
  label: string;
  theme: string;
  photoLimit: number;
};

export function labArtStationSlots(brief?: SessionActivityBrief | null): LabArtStationSlot[] {
  const acts = (brief?.activities || []).filter((a) => a.index >= 2);
  if (!acts.length) {
    return [
      { kind: 'POT', label: brief?.a2?.stationA?.media || 'Stasiun A', theme: brief?.a2?.stationA?.theme || '', photoLimit: 2 },
      { kind: 'BAG', label: brief?.a2?.stationB?.media || 'Stasiun B', theme: brief?.a2?.stationB?.theme || '', photoLimit: 2 },
    ];
  }
  return acts.map((a, i) => {
    const kind = i === 0 ? 'POT' : i === 1 ? 'BAG' : `ACT${i + 1}`;
    const media = a.stationMedia || a.title || `Aktivitas ${a.index}`;
    return {
      kind,
      label: media,
      theme: a.stationTheme || '',
      photoLimit: 2,
    };
  });
}

/** Urutan presentasi (skip / tunda / undian) — selaras server `labPresentationOrder`. */
export function labPresentationOrder(
  activity: {
    presentOrder?: number[];
    presentSkipped?: number[];
    presentPostponed?: number[];
  } | null | undefined,
  teamCount: number,
): number[] {
  const count = Math.max(0, Number(teamCount) || 0);
  const skipped = new Set(
    (Array.isArray(activity?.presentSkipped) ? activity.presentSkipped : [])
      .map((n) => Math.floor(Number(n)))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < count),
  );
  const postponed = (Array.isArray(activity?.presentPostponed) ? activity.presentPostponed : [])
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < count && !skipped.has(n));
  const out: number[] = [];
  for (const n of Array.isArray(activity?.presentOrder) ? activity.presentOrder : []) {
    const i = Math.floor(Number(n));
    if (Number.isInteger(i) && i >= 0 && i < count && !skipped.has(i) && !out.includes(i)) out.push(i);
  }
  for (const i of postponed) if (!out.includes(i)) out.push(i);
  for (let i = 0; i < count; i += 1) {
    if (!skipped.has(i) && !out.includes(i)) out.push(i);
  }
  return out;
}
