import type { SessionActivityBrief } from './mentoring';

export type PresentSlide = {
  activityIndex: number;
  label: string;
  media: string;
  theme: string;
  /** POT / BAG / ACTn / COMMIT — untuk layar presentasi & kuota foto. */
  photoKind: string;
  station?: 'A' | 'B' | 'COMMIT';
};

type ArtActivity = {
  index: number;
  title?: string;
  minutes?: number;
  stationMedia?: string;
  stationTheme?: string;
  stationBMedia?: string;
  stationBTheme?: string;
  legacyPot?: string;
  legacyBag?: string;
  legacyPotMeaning?: string;
  legacyBagMeaning?: string;
  pertanyaan?: string;
};

/** Ringkas draft tersimpan → brief untuk slide/kuota (selaras server `creativeLabBriefFromDraft`). */
export function sessionBriefFromStoredDraft(
  draft?: Record<string, Record<string, string>> | null,
): SessionActivityBrief {
  const d = draft && typeof draft === 'object' ? draft : {};
  const meta = d.meta && typeof d.meta === 'object' ? d.meta : {};
  const rawCount = Number(String(meta['activity-count'] || '2').replace(/[^\d]/g, ''));
  const activityCount = Number.isFinite(rawCount) && rawCount >= 1 && rawCount <= 6 ? rawCount : 2;
  const activities: ArtActivity[] = [];
  for (let i = 1; i <= activityCount; i += 1) {
    const a = d[`activity-${i}`] && typeof d[`activity-${i}`] === 'object' ? d[`activity-${i}`] : {};
    const p = `a${i}`;
    activities.push({
      index: i,
      title: String(a[`${p}-title`] || '').trim(),
      minutes: Number(String(a[`${p}-minutes`] || '').replace(/[^\d.]/g, '')) || (i === 1 ? 15 : 25),
      stationMedia: String(a[`${p}-station-media`] || (i === 2 ? a['a2-a-media'] : '') || '').trim(),
      stationTheme: String(a[`${p}-station-theme`] || (i === 2 ? a['a2-a-theme'] : '') || '').trim(),
      stationBMedia: i === 2 ? String(a['a2-b-media'] || '').trim() : '',
      stationBTheme: i === 2 ? String(a['a2-b-theme'] || '').trim() : '',
      legacyPot: i === 2 ? String(a['a2-pot'] || '').trim() : '',
      legacyBag: i === 2 ? String(a['a2-bag'] || '').trim() : '',
      legacyPotMeaning: i === 2 ? String(a['a2-pot-meaning'] || '').trim() : '',
      legacyBagMeaning: i === 2 ? String(a['a2-bag-meaning'] || '').trim() : '',
    });
  }
  const a2sec = d['activity-2'] && typeof d['activity-2'] === 'object' ? d['activity-2'] : {};
  const mediaA = String(a2sec['a2-station-media'] || a2sec['a2-a-media'] || '').trim() || 'Stasiun A';
  const mediaB = String(a2sec['a2-b-media'] || '').trim() || 'Stasiun B';
  return {
    firmanTitle: '',
    briefing: { core: '', rules: '', jarIntro: '', scribe: '', draw: '' },
    a1: { title: 'Sesi 1', subtitle: '', goal: '', tools: '', steps: '', output: '', minutes: 15 },
    a2: {
      title: 'Sesi 2',
      goal: '',
      tools: '',
      stationA: { media: mediaA, theme: String(a2sec['a2-station-theme'] || a2sec['a2-a-theme'] || '').trim() },
      stationB: { media: mediaB, theme: String(a2sec['a2-b-theme'] || '').trim() },
      pot: String(a2sec['a2-pot'] || '').trim(),
      bag: String(a2sec['a2-bag'] || '').trim(),
      potMeaning: String(a2sec['a2-pot-meaning'] || '').trim(),
      bagMeaning: String(a2sec['a2-bag-meaning'] || '').trim(),
      report: '',
      commit: '',
      minutes: 25,
    },
    present: { order: '', questions: '', seconds: 150 },
    closing: { script: '', commit: '', prayer: '' },
    activities: activities as NonNullable<SessionActivityBrief>['activities'],
    activityCount,
  };
}

function artActivities(brief?: SessionActivityBrief | null): ArtActivity[] {
  const fromBrief = (brief?.activities || []).filter((a) => a.index >= 2);
  if (fromBrief.length) return fromBrief;
  if (brief?.a2) {
    return [{
      index: 2,
      title: brief.a2.title,
      stationMedia: brief.a2.stationA?.media,
      stationTheme: brief.a2.stationA?.theme,
      stationBMedia: brief.a2.stationB?.media,
      stationBTheme: brief.a2.stationB?.theme,
      legacyPot: brief.a2.pot,
      legacyBag: brief.a2.bag,
      legacyPotMeaning: brief.a2.potMeaning,
      legacyBagMeaning: brief.a2.bagMeaning,
    }];
  }
  return [];
}

export function artStationBVisible(a: ArtActivity): boolean {
  const media = String(a.stationBMedia || '').trim();
  const theme = String(a.stationBTheme || '').trim();
  const bag = String(a.legacyBag || '').trim();
  const bagMeaning = String(a.legacyBagMeaning || '').trim();
  return Boolean(media || theme || bag || bagMeaning);
}

function slideForStation(
  a: ArtActivity,
  station: 'A' | 'B',
  photoKind: string,
): PresentSlide {
  const isB = station === 'B';
  const media = isB
    ? (String(a.stationBMedia || '').trim() || 'Stasiun B')
    : (String(a.stationMedia || '').trim() || a.title || `Aktivitas ${a.index}` || 'Stasiun A');
  const theme = isB ? (a.stationBTheme || '') : (a.stationTheme || '');
  const letter = isB ? 'B' : 'A';
  return {
    activityIndex: a.index,
    label: `Slide Stasiun ${letter} · ${media}`,
    media,
    theme,
    photoKind,
    station,
  };
}

export function presentSlidePlan(brief?: SessionActivityBrief | null): PresentSlide[] {
  const acts = artActivities(brief);
  const slides: PresentSlide[] = [];
  for (const a of acts) {
    if (a.index === 2) {
      slides.push(slideForStation(a, 'A', 'POT'));
      if (artStationBVisible(a)) slides.push(slideForStation(a, 'B', 'BAG'));
    } else {
      const media = String(a.stationMedia || '').trim() || a.title || `Aktivitas ${a.index}`;
      const letter = String.fromCharCode(65 + Math.min(slides.filter((s) => s.activityIndex === a.index).length, 25));
      slides.push({
        activityIndex: a.index,
        label: `Slide Stasiun ${letter} · ${media}`,
        media,
        theme: a.stationTheme || '',
        photoKind: `ACT${a.index}`,
        station: 'A',
      });
    }
  }
  slides.push({
    activityIndex: 0,
    label: 'Slide Bersama · Commitment',
    media: 'Commitment',
    theme: '',
    photoKind: 'COMMIT',
    station: 'COMMIT',
  });
  if (slides.length > 1) return slides;
  return [
    slideForStation({ index: 2, stationMedia: 'Stasiun A' }, 'A', 'POT'),
    slideForStation({ index: 2, stationBMedia: 'Stasiun B' }, 'B', 'BAG'),
    {
      activityIndex: 0,
      label: 'Slide Bersama · Commitment',
      media: 'Commitment',
      theme: '',
      photoKind: 'COMMIT',
      station: 'COMMIT',
    },
  ];
}

export function presentSlideCount(brief?: SessionActivityBrief | null): number {
  return Math.max(0, presentSlidePlan(brief).length - 1);
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
  const acts = artActivities(brief);
  if (!acts.length) {
    return [
      { kind: 'POT', label: brief?.a2?.stationA?.media || 'Stasiun A', theme: brief?.a2?.stationA?.theme || '', photoLimit: 2 },
      { kind: 'BAG', label: brief?.a2?.stationB?.media || 'Stasiun B', theme: brief?.a2?.stationB?.theme || '', photoLimit: 2 },
    ];
  }
  const slots: LabArtStationSlot[] = [];
  for (const a of acts) {
    if (a.index === 2) {
      const mediaA = String(a.stationMedia || '').trim() || 'Stasiun A';
      const mediaB = String(a.stationBMedia || '').trim() || 'Stasiun B';
      slots.push({ kind: 'POT', label: mediaA, theme: a.stationTheme || '', photoLimit: 2 });
      if (artStationBVisible(a)) {
        slots.push({ kind: 'BAG', label: mediaB, theme: a.stationBTheme || '', photoLimit: 2 });
      }
    } else {
      const media = String(a.stationMedia || '').trim() || a.title || `Aktivitas ${a.index}`;
      slots.push({ kind: `ACT${a.index}`, label: media, theme: a.stationTheme || '', photoLimit: 2 });
    }
  }
  return slots.length ? slots : [
    { kind: 'POT', label: 'Stasiun A', theme: '', photoLimit: 2 },
    { kind: 'BAG', label: 'Stasiun B', theme: '', photoLimit: 2 },
  ];
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
