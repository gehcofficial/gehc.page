import { describe, expect, it } from 'vitest';
import {
  artStationBVisible,
  labArtStationSlots,
  presentSlideCount,
  presentSlidePlan,
  sessionBriefFromStoredDraft,
} from '../../src/lib/creative-lab-draft';
import {
  creativeLabBriefFromDraft,
  labArtStationSlotsFromBrief,
  presentSlideCount as presentSlideCountServer,
  presentSlidePlan as presentSlidePlanServer,
} from '../../server/lib/creative-lab-draft.mjs';
import { visibleCreativeLabDraftSections, emptySessionDraft } from '../../src/lib/worship-session-draft';

function briefFromDraft(draft: Record<string, Record<string, string>>) {
  return creativeLabBriefFromDraft(draft);
}

describe('creative-lab-draft: presentSlidePlan', () => {
  it('default kosong → Stasiun A, B, Commitment', () => {
    const slides = presentSlidePlan(null);
    expect(slides.map((s) => s.photoKind)).toEqual(['POT', 'BAG', 'COMMIT']);
    expect(presentSlideCount(null)).toBe(2);
  });

  it('activity-count 2 dengan stasiun A/B → A, B, Commitment', () => {
    const draft = {
      meta: { 'activity-count': '2' },
      'activity-2': {
        'a2-station-media': 'Pot',
        'a2-b-media': 'Tas',
        'a2-b-theme': 'Carry',
      },
    };
    const brief = briefFromDraft(draft);
    const slides = presentSlidePlan(brief);
    expect(slides.map((s) => s.media)).toEqual(['Pot', 'Tas', 'Commitment']);
    expect(presentSlideCount(brief)).toBe(2);
    expect(presentSlidePlanServer(brief).map((s) => s.photoKind)).toEqual(['POT', 'BAG', 'COMMIT']);
    expect(presentSlideCountServer(brief)).toBe(2);
  });

  it('hanya stasiun A (tanpa B) → A + Commitment', () => {
    const draft = {
      meta: { 'activity-count': '2' },
      'activity-2': { 'a2-station-media': 'Clay', 'a2-pot': 'Refleksi pot' },
    };
    const brief = briefFromDraft(draft);
    const a2 = brief.activities?.find((a) => a.index === 2);
    expect(a2 && artStationBVisible(a2)).toBe(false);
    const slides = presentSlidePlan(brief);
    expect(slides.map((s) => s.photoKind)).toEqual(['POT', 'COMMIT']);
    expect(presentSlideCount(brief)).toBe(1);
  });

  it('legacy a2-pot tidak memaksa slide B', () => {
    const draft = {
      meta: { 'activity-count': '2' },
      'activity-2': { 'a2-a-media': 'Pot lama', 'a2-pot': 'Arah lama' },
    };
    const brief = briefFromDraft(draft);
    expect(presentSlidePlan(brief).map((s) => s.photoKind)).toEqual(['POT', 'COMMIT']);
  });

  it('activity-count 3 → A, B dari aktivitas 2 + slide aktivitas 3', () => {
    const draft = {
      meta: { 'activity-count': '3' },
      'activity-2': { 'a2-station-media': 'Pot', 'a2-b-media': 'Bag' },
      'activity-3': { 'a3-title': 'Mural', 'a3-station-media': 'Kanvas' },
    };
    const brief = briefFromDraft(draft);
    const kinds = presentSlidePlan(brief).map((s) => s.photoKind);
    expect(kinds).toEqual(['POT', 'BAG', 'ACT3', 'COMMIT']);
    expect(labArtStationSlots(brief).map((s) => s.kind)).toEqual(['POT', 'BAG', 'ACT3']);
    expect(labArtStationSlotsFromBrief(brief).map((s) => s.kind)).toEqual(['POT', 'BAG', 'ACT3']);
  });

  it('sessionBriefFromStoredDraft selaras dengan slide plan', () => {
    const draft = {
      meta: { 'activity-count': '2' },
      'activity-2': { 'a2-station-media': 'Pot', 'a2-b-media': 'Tas' },
    };
    const brief = sessionBriefFromStoredDraft(draft);
    expect(presentSlidePlan(brief).length).toBe(3);
  });
});

describe('creative-lab-draft: visibleCreativeLabDraftSections', () => {
  it('menyembunyikan activity-3/4 saat activity-count=2', () => {
    const sections = emptySessionDraft('CREATIVE_LAB');
    const { visible, hiddenCount, activityCount } = visibleCreativeLabDraftSections(sections, false);
    expect(activityCount).toBe(2);
    expect(hiddenCount).toBe(2);
    expect(visible.some((s) => s.key === 'activity-3')).toBe(false);
    expect(visible.some((s) => s.key === 'activity-1')).toBe(true);
    const shown = visibleCreativeLabDraftSections(sections, true).visible;
    expect(shown.some((s) => s.key === 'activity-3')).toBe(true);
  });
});
