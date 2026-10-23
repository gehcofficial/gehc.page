/**
 * Creative Lab — draft bebas (aktivitas 1..N + item jar).
 * Parser + kompatibilitas draft lama (section jar + dua stasiun).
 */

export const CREATIVE_LAB_ACTIVITY_CAP = 6;
export const CREATIVE_LAB_ITEM_CAP = 6;
export const CREATIVE_LAB_JAR_CODES = [
  'JAR-1', 'JAR-2', 'JAR-3', 'JAR-4', 'JAR-5', 'JAR-6',
];
const LEGACY_JAR_MAP = [
  { key: 'root', code: 'JAR-ROOT', title: 'A Root I Carry', field: 'jar-root' },
  { key: 'truth', code: 'JAR-TRUTH', title: 'A Truth I Need to Remember', field: 'jar-truth' },
  { key: 'lost', code: 'JAR-LOST', title: 'When I Feel Lost', field: 'jar-lost' },
  { key: 'community', code: 'JAR-COMMUNITY', title: 'A Word for My Community', field: 'jar-community' },
  { key: 'verse', code: 'JAR-VERSE', title: 'A Verse to Hold Onto', field: 'jar-verse' },
  { key: 'step', code: 'JAR-STEP', title: 'My Next Faith Step', field: 'jar-step' },
];

function str(v, max = 4000) {
  return String(v ?? '').trim().slice(0, max);
}

function sec(draft, key) {
  const d = draft && typeof draft === 'object' ? draft : {};
  const s = d[key];
  return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
}

function minutesField(raw, fallback) {
  const n = Number(String(raw ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function parseItems(activitySec, prefix) {
  const items = [];
  for (let i = 1; i <= CREATIVE_LAB_ITEM_CAP; i += 1) {
    const judul = str(activitySec[`${prefix}-item-${i}-judul`], 120);
    const konteks = str(activitySec[`${prefix}-item-${i}-konteks`], 800);
    const pertanyaan = str(activitySec[`${prefix}-item-${i}-pertanyaan`], 800);
    const contoh = str(activitySec[`${prefix}-item-${i}-contoh`], 400);
    const tagline = str(activitySec[`${prefix}-item-${i}-tagline`], 120);
    const ai = str(activitySec[`${prefix}-item-${i}-ai`], 8).toLowerCase() === '1'
      || String(activitySec[`${prefix}-item-${i}-ai`] || '').toLowerCase() === 'true';
    if (!judul && !konteks && !pertanyaan) continue;
    items.push({ index: i, judul, konteks, pertanyaan, contoh, tagline, ai });
  }
  return items;
}

function activityCountFromDraft(draft) {
  const meta = sec(draft, 'meta');
  const n = minutesField(meta['activity-count'], 0);
  if (n >= 1 && n <= CREATIVE_LAB_ACTIVITY_CAP) return n;
  let max = 0;
  for (let i = 1; i <= CREATIVE_LAB_ACTIVITY_CAP; i += 1) {
    const a = sec(draft, `activity-${i}`);
    if (str(a[`a${i}-title`], 120) || str(a[`a${i}-minutes`], 12)) max = i;
  }
  return Math.max(1, max || 2);
}

/**
 * @returns {{
 *   firmanTitle: string;
 *   firmanPoints: string;
 *   briefing: Record<string, string>;
 *   activities: Array<{
 *     index: number; title: string; minutes: number;
 *     konteks: string; pertanyaan: string; contoh: string;
 *     items: Array<{ index: number; judul: string; konteks: string; pertanyaan: string; contoh: string; tagline: string; ai: boolean }>;
 *     stationMedia: string; stationTheme: string;
 *   }>;
 *   present: { order: string; questions: string; seconds: number };
 *   closing: { script: string; commit: string; prayer: string };
 *   activityCount: number;
 * }}
 */
export function parseCreativeLabDraft(draft) {
  const d = draft && typeof draft === 'object' ? draft : {};
  const firman = sec(d, 'firman');
  const briefing = sec(d, 'briefing');
  const present = sec(d, 'present');
  const closing = sec(d, 'closing');
  const activityCount = activityCountFromDraft(d);

  const activities = [];
  for (let i = 1; i <= activityCount; i += 1) {
    const a = sec(d, `activity-${i}`);
    const prefix = `a${i}`;
    const legacyPot = i === 2 ? str(a['a2-pot'], 800) : '';
    const legacyBag = i === 2 ? str(a['a2-bag'], 800) : '';
    activities.push({
      index: i,
      title: str(a[`${prefix}-title`], 120),
      minutes: minutesField(a[`${prefix}-minutes`], i === 1 ? 15 : 25),
      konteks: str(a[`${prefix}-konteks`], 1200) || str(a[`${prefix}-goal`], 1200),
      pertanyaan: str(a[`${prefix}-pertanyaan`], 1200),
      contoh: str(a[`${prefix}-contoh`], 800),
      items: parseItems(a, prefix),
      stationMedia: str(a[`${prefix}-station-media`] || a['a2-a-media'], 40)
        || (i === 2 ? str(a['a2-a-media'], 40) : ''),
      stationTheme: str(a[`${prefix}-station-theme`] || a['a2-a-theme'], 120)
        || (i === 2 ? str(a['a2-a-theme'], 120) : ''),
      stationBMedia: str(a['a2-b-media'], 40),
      stationBTheme: str(a['a2-b-theme'], 120),
      legacyPot,
      legacyBag,
      legacyPotMeaning: str(a['a2-pot-meaning'], 1200),
      legacyBagMeaning: str(a['a2-bag-meaning'], 1200),
    });
  }

  return {
    firmanTitle: str(firman['firman-judul'] || briefing['firman-judul'], 200),
    firmanPoints: str(firman['firman-poin'] || briefing['firman-poin'], 1200),
    briefing: {
      core: str(briefing['brief-core'], 4000),
      rules: str(briefing['brief-rules'], 4000),
      scribe: str(briefing['brief-scribe'], 800),
      draw: str(briefing['brief-draw'], 800),
      audienceDirective: str(briefing['brief-audience-directive'], 400),
      projectorDirective: str(briefing['brief-projector-directive'], 400),
    },
    activities,
    present: {
      order: str(present['present-order'], 2000),
      questions: str(present['present-questions'], 2000),
      seconds: Math.min(600, Math.max(30, minutesField(present['present-seconds'], 150))),
    },
    closing: {
      script: str(closing['closing-script'], 4000),
      commit: str(closing['closing-commit'], 2000),
      prayer: str(closing['closing-prayer'], 2000),
    },
    activityCount,
  };
}

export function jarCardsFromDraft(draft) {
  const parsed = parseCreativeLabDraft(draft);
  const first = parsed.activities[0];
  if (first?.items?.length) {
    return first.items.slice(0, CREATIVE_LAB_ITEM_CAP).map((it, i) => ({
      key: `item-${i + 1}`,
      code: CREATIVE_LAB_JAR_CODES[i] || `JAR-${i + 1}`,
      title: it.judul || `Pertanyaan ${i + 1}`,
      direction: [it.konteks, it.pertanyaan].filter(Boolean).join('\n\n') || it.contoh || '',
      example: it.contoh || '',
    }));
  }
  const jar = sec(draft, 'jar');
  const legacy = LEGACY_JAR_MAP.map((c) => ({
    key: c.key,
    code: c.code,
    title: c.title,
    direction: str(jar[c.field], 1200),
    example: '',
  }));
  const anyLegacy = legacy.some((c) => c.direction);
  if (anyLegacy) return legacy;
  return CREATIVE_LAB_JAR_CODES.map((code, i) => ({
    key: `slot-${i + 1}`,
    code,
    title: `Pertanyaan ${i + 1}`,
    direction: '',
    example: '',
  }));
}

/** Kartu jar untuk validasi catatan — gabung kode baru + legacy. */
export function jarNoteCodes(draft) {
  const cards = jarCardsFromDraft(draft);
  const codes = new Set(cards.map((c) => c.code));
  for (const c of LEGACY_JAR_MAP) codes.add(c.code);
  return codes;
}

export function creativeLabBriefFromDraft(draft) {
  const p = parseCreativeLabDraft(draft);
  const a1 = p.activities[0] || { title: '', minutes: 15, konteks: '', items: [] };
  const a2 = p.activities[1] || {
    title: '', minutes: 25, stationMedia: '', stationTheme: '', stationBMedia: '', stationBTheme: '',
    legacyPot: '', legacyBag: '', legacyPotMeaning: '', legacyBagMeaning: '',
  };
  const mediaA = a2.stationMedia || 'Stasiun A';
  const mediaB = a2.stationBMedia || 'Stasiun B';
  const themeA = a2.stationTheme || '';
  const themeB = a2.stationBTheme || '';
  return {
    firmanTitle: p.firmanTitle,
    firmanPoints: p.firmanPoints,
    briefing: {
      core: p.briefing.core,
      rules: p.briefing.rules,
      jarIntro: '',
      scribe: p.briefing.scribe || 'Kirim perwakilan kelompok ke depan — nama hanya tampil di Sesi 2.',
      draw: p.briefing.draw || 'Urutan presentasi mengikuti pengundian di layar.',
      audienceDirective: p.briefing.audienceDirective
        || 'Ikuti arahan di layar; tulis di kertas saat diminta, isi web hanya untuk slot digital.',
      projectorDirective: p.briefing.projectorDirective
        || 'Tampilkan timer fase, nomor grup saat undian, dan progres kelompok saat Sesi 2.',
    },
    a1: {
      title: a1.title || 'Sesi 1',
      subtitle: '',
      goal: a1.konteks,
      tools: '',
      steps: a1.pertanyaan,
      output: a1.contoh,
      minutes: a1.minutes,
    },
    a2: {
      title: a2.title || 'Sesi 2',
      goal: a2.konteks,
      tools: '',
      stationA: { media: mediaA, theme: themeA },
      stationB: { media: mediaB, theme: themeB },
      pot: a2.legacyPot || a2.pertanyaan || '',
      bag: a2.legacyBag || '',
      potMeaning: a2.legacyPotMeaning || '',
      bagMeaning: a2.legacyBagMeaning || '',
      report: '',
      commit: p.closing.commit,
      minutes: a2.minutes,
    },
    activities: p.activities,
    present: p.present,
    closing: p.closing,
    activityCount: p.activityCount,
  };
}

function artActivitiesFromBrief(brief) {
  const fromBrief = (Array.isArray(brief?.activities) ? brief.activities : []).filter((a) => a.index >= 2);
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

export function artStationBVisible(a) {
  const media = str(a.stationBMedia, 40);
  const theme = str(a.stationBTheme, 120);
  const bag = str(a.legacyBag, 800);
  const bagMeaning = str(a.legacyBagMeaning, 1200);
  return Boolean(media || theme || bag || bagMeaning);
}

function slideForStation(a, station, photoKind) {
  const isB = station === 'B';
  const media = isB
    ? (str(a.stationBMedia, 40) || 'Stasiun B')
    : (str(a.stationMedia, 40) || str(a.title, 120) || `Aktivitas ${a.index}` || 'Stasiun A');
  const theme = isB ? str(a.stationBTheme, 120) : str(a.stationTheme, 120);
  const letter = isB ? 'B' : 'A';
  const shortLabel = photoKind === 'POT' ? 'Pot' : photoKind === 'BAG' ? 'Bag' : `Slide Stasiun ${letter} · ${media}`;
  return {
    activityIndex: a.index,
    label: shortLabel,
    media,
    theme,
    photoKind,
    station,
  };
}

/** Slide presentasi: Art Station A/B (aktivitas 2) + satu slide per aktivitas seni lain + Commitment. */
export function presentSlidePlan(brief) {
  const acts = artActivitiesFromBrief(brief);
  const slides = [];
  for (const a of acts) {
    if (a.index === 2) {
      slides.push(slideForStation(a, 'A', 'POT'));
      if (artStationBVisible(a)) slides.push(slideForStation(a, 'B', 'BAG'));
    } else {
      const media = str(a.stationMedia, 40) || str(a.title, 120) || `Aktivitas ${a.index}`;
      slides.push({
        activityIndex: a.index,
        label: media,
        media,
        theme: str(a.stationTheme, 120),
        photoKind: `ACT${a.index}`,
        station: 'A',
      });
    }
  }
  slides.push({
    activityIndex: 0,
    label: 'Commitment',
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
      label: 'Commitment',
      media: 'Commitment',
      theme: '',
      photoKind: 'COMMIT',
      station: 'COMMIT',
    },
  ];
}

export function presentSlideCount(brief) {
  return Math.max(0, presentSlidePlan(brief).length - 1);
}

export function labArtStationSlotsFromBrief(brief) {
  const acts = artActivitiesFromBrief(brief);
  if (!acts.length) {
    return [
      { kind: 'POT', label: brief?.a2?.stationA?.media || 'Stasiun A', theme: brief?.a2?.stationA?.theme || '', photoLimit: 2 },
      { kind: 'BAG', label: brief?.a2?.stationB?.media || 'Stasiun B', theme: brief?.a2?.stationB?.theme || '', photoLimit: 2 },
    ];
  }
  const slots = [];
  for (const a of acts) {
    if (a.index === 2) {
      const mediaA = str(a.stationMedia, 40) || 'Stasiun A';
      const mediaB = str(a.stationBMedia, 40) || 'Stasiun B';
      slots.push({ kind: 'POT', label: mediaA, theme: str(a.stationTheme, 120), photoLimit: 2 });
      if (artStationBVisible(a)) {
        slots.push({ kind: 'BAG', label: mediaB, theme: str(a.stationBTheme, 120), photoLimit: 2 });
      }
    } else {
      const media = str(a.stationMedia, 40) || str(a.title, 120) || `Aktivitas ${a.index}`;
      slots.push({ kind: `ACT${a.index}`, label: media, theme: str(a.stationTheme, 120), photoLimit: 2 });
    }
  }
  return slots.length ? slots : [
    { kind: 'POT', label: 'Stasiun A', theme: '', photoLimit: 2 },
    { kind: 'BAG', label: 'Stasiun B', theme: '', photoLimit: 2 },
  ];
}

export function totalActivityMinutes(draft) {
  const p = parseCreativeLabDraft(draft);
  return p.activities.reduce((sum, a) => sum + (a.minutes || 0), 0);
}

/** Validasi menit aktivitas vs slot jemaat (default 140). */
export function validateActivityMinutes(draft, slotMinutes = 140) {
  const total = totalActivityMinutes(draft);
  const delta = total - slotMinutes;
  if (Math.abs(delta) <= 2) return { ok: true, total, slotMinutes };
  return {
    ok: false,
    total,
    slotMinutes,
    message: `Total menit aktivitas (${total}) tidak selaras dengan slot jemaat (${slotMinutes} menit). Sesuaikan draft atau rundown.`,
  };
}

/** Kunci foto per aktivitas seni (indeks ≥2): POT/BAG/ACTn + GROUP. */
export function labPhotoKindForArtIndex(i) {
  if (i === 0) return 'POT';
  if (i === 1) return 'BAG';
  return `ACT${i + 1}`;
}

export function labPhotoLimitsForBrief(brief) {
  const limits = { GROUP: 1 };
  for (const slot of labArtStationSlotsFromBrief(brief)) {
    limits[slot.kind] = slot.photoLimit;
  }
  return limits;
}

export function labPhotoKindLabels(brief) {
  const labels = { GROUP: 'Foto Bersama' };
  for (const slot of labArtStationSlotsFromBrief(brief)) {
    labels[slot.kind] = `Foto ${slot.label}`;
  }
  return labels;
}

function isAiFlag(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

/** Field bertanda diisi AI yang belum direview sebelum terbit. */
export function listAiReviewPending(draft, reviewedKeys = []) {
  const reviewed = new Set((reviewedKeys || []).map((k) => String(k)));
  const pending = [];
  const d = draft && typeof draft === 'object' ? draft : {};
  for (const [sectionKey, sec] of Object.entries(d)) {
    if (!sec || typeof sec !== 'object' || Array.isArray(sec)) continue;
    for (const [fk, fv] of Object.entries(sec)) {
      if (!String(fk).endsWith('-ai') || !isAiFlag(fv)) continue;
      const stem = String(fk).slice(0, -3);
      for (const [ck, cv] of Object.entries(sec)) {
        if (ck.endsWith('-ai')) continue;
        if (!(ck === stem || ck.startsWith(`${stem}-`))) continue;
        if (!String(cv || '').trim()) continue;
        const id = `${sectionKey}/${ck}`;
        if (reviewed.has(id)) continue;
        pending.push({
          id,
          sectionKey,
          fieldKey: ck,
          preview: String(cv).slice(0, 160),
        });
      }
    }
  }
  return pending;
}

export function parseAiReviewedKeys(draft) {
  const meta = sec(draft, 'meta');
  const raw = String(meta['ai-reviewed-keys'] || '');
  return raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

export const CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES = 140;
export const CREATIVE_LAB_PATTERN_MINUTES = 160;

/** Validasi menit aktivitas untuk terbit: blok jika lewat slot, peringatan jika jauh dari 140′ jemaat. */
export function validateCreativeLabMinutesForPublish(draft) {
  const total = totalActivityMinutes(draft);
  if (total > CREATIVE_LAB_PATTERN_MINUTES) {
    return {
      ok: false,
      severity: 'block',
      total,
      jemaatSlot: CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES,
      patternSlot: CREATIVE_LAB_PATTERN_MINUTES,
      message: `Total menit aktivitas (${total}) melebihi pola ${CREATIVE_LAB_PATTERN_MINUTES} menit.`,
    };
  }
  if (total > CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES + 2) {
    return {
      ok: false,
      severity: 'block',
      total,
      jemaatSlot: CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES,
      patternSlot: CREATIVE_LAB_PATTERN_MINUTES,
      message: `Total menit aktivitas (${total}) melebihi slot jemaat ${CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES} menit (tanpa PRA/liturgi).`,
    };
  }
  if (Math.abs(total - CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES) > 5) {
    return {
      ok: false,
      severity: 'warn',
      total,
      jemaatSlot: CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES,
      patternSlot: CREATIVE_LAB_PATTERN_MINUTES,
      message: `Total menit aktivitas (${total}) belum selaras dengan target ${CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES} menit jemaat.`,
    };
  }
  return {
    ok: true,
    severity: 'ok',
    total,
    jemaatSlot: CREATIVE_LAB_JEMAAT_ACTIVITY_MINUTES,
    patternSlot: CREATIVE_LAB_PATTERN_MINUTES,
  };
}

const REACTION_LABELS = { SUKA: '#Suka', BIASA: '#Biasa', KURANG: '#Kurang' };

export function aggregateLabReactionCloud(votes, released) {
  if (!released || !votes || typeof votes !== 'object') return [];
  const counts = { SUKA: 0, BIASA: 0, KURANG: 0 };
  for (const v of Object.values(votes)) {
    const k = String(v || '').toUpperCase();
    if (counts[k] != null) counts[k] += 1;
  }
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, count]) => ({
      code: k,
      label: REACTION_LABELS[k] || k,
      count,
    }));
}

export function cleanLabReactions(raw) {
  if (!raw || typeof raw !== 'object') return { released: false, votes: {} };
  const votes = {};
  const src = raw.votes && typeof raw.votes === 'object' ? raw.votes : {};
  for (const [k, v] of Object.entries(src).slice(0, 800)) {
    const key = String(k).slice(0, 80);
    const choice = String(v || '').toUpperCase();
    if (key && ['SUKA', 'BIASA', 'KURANG'].includes(choice)) votes[key] = choice;
  }
  return { released: Boolean(raw.released), votes };
}
