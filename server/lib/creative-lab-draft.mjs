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

/** Slide presentasi: satu per aktivitas seni (indeks ≥2) + Commitment. */
export function presentSlidePlan(brief) {
  const acts = Array.isArray(brief?.activities) ? brief.activities : [];
  const art = acts.filter((a) => a.index >= 2);
  const slides = art.map((a, i) => {
    const label = a.stationMedia || a.title || `Aktivitas ${a.index}`;
    const letter = String.fromCharCode(65 + Math.min(i, 25));
    return {
      activityIndex: a.index,
      label: `Slide Stasiun ${letter} · ${label}`,
      media: label,
      theme: a.stationTheme || '',
    };
  });
  slides.push({ activityIndex: 0, label: 'Slide Bersama · Commitment', media: 'Commitment', theme: '' });
  return slides;
}

export function presentSlideCount(brief) {
  return Math.max(1, presentSlidePlan(brief).length);
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

export function labPhotoLimitsForBrief(brief) {
  const acts = Array.isArray(brief?.activities) ? brief.activities : [];
  const artCount = acts.filter((a) => a.index >= 2).length;
  const limits = { GROUP: 1 };
  if (artCount <= 1) {
    limits.POT = 2;
    limits.BAG = artCount === 0 ? 0 : 2;
  } else {
    for (let i = 0; i < artCount; i += 1) {
      const key = i === 0 ? 'POT' : i === 1 ? 'BAG' : `ACT${i + 1}`;
      limits[key] = 2;
    }
  }
  return limits;
}
