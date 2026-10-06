/**
 * Didaskalia — diff usulan regenerate (pure, tanpa DB) untuk ringkasan ke HOD.
 * Membandingkan studio saat ini vs proposal AI → daftar field berubah + ringkasan.
 */

const clip = (s, n = 120) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

const joinList = (arr, key) => (Array.isArray(arr) ? arr.map((x) => (key ? x?.[key] : x)).filter(Boolean).join(' · ') : '');

/**
 * @param {object} current  studio saat ini
 * @param {object} proposal usulan AI
 * @returns {{ diff: Array<{section:string,label:string,before:string,after:string}>, summary: string }}
 */
export function computeRegenDiff(current, proposal) {
  const cur = current && typeof current === 'object' ? current : {};
  const prop = proposal && typeof proposal === 'object' ? proposal : {};
  const diff = [];

  const push = (section, label, before, after) => {
    const b = String(before ?? '');
    const a = String(after ?? '');
    if (b !== a) diff.push({ section, label, before: clip(b), after: clip(a) });
  };

  // Inti / brief
  push('INTI', 'Chapter', cur.chapterNo, prop.chapterNo);
  push('INTI', 'Fundamental Firman', cur.fundamentalFirman?.ref, prop.fundamentalFirman?.ref);
  push('INTI', 'Inti Pesan (Big Idea)', cur.fundamentalFirman?.text, prop.fundamentalFirman?.text);
  push('INTI', 'Kitab / Bagian Fokus', cur.kitabFokus, prop.kitabFokus);
  push('INTI', 'Metode Khotbah', joinList(cur.homileticMethods), joinList(prop.homileticMethods));
  push(
    'INTI',
    'Analisa Metode (%)',
    joinList(cur.methodMix, 'method') && (cur.methodMix || []).map((m) => `${m.method} ${m.percent}%`).join(' · '),
    joinList(prop.methodMix, 'method') && (prop.methodMix || []).map((m) => `${m.method} ${m.percent}%`).join(' · '),
  );

  // Path 1..7 (hanya field teks — struktur dikunci)
  const curPaths = Array.isArray(cur.paths) ? cur.paths : [];
  const propPaths = Array.isArray(prop.paths) ? prop.paths : [];
  for (let i = 0; i < 7; i += 1) {
    const a = curPaths[i] || {};
    const b = propPaths[i] || {};
    const sc = `PATH:${i + 1}`;
    push(sc, `Path ${i + 1} · Judul`, a.title, b.title);
    push(sc, `Path ${i + 1} · Ringkasan`, a.summary, b.summary);
    push(sc, `Path ${i + 1} · Nats Pembimbing`, a.scriptureRef, b.scriptureRef);
    push(sc, `Path ${i + 1} · Bacaan Alkitab`, a.bacaanRef, b.bacaanRef);
    push(sc, `Path ${i + 1} · Perenungan`, a.reflection, b.reflection);
    const curBody = (a.rhbSections || []).map((s) => (s.body || '').trim()).join('|');
    const propBody = (b.rhbSections || []).map((s) => (s.body || '').trim()).join('|');
    push(sc, `Path ${i + 1} · 5 Section RHB`, curBody, propBody);
  }

  // Ringkasan khotbah
  const cs = cur.sermon || {};
  const ps = prop.sermon || {};
  push('SERMON', 'Inti Pesan (Big Idea)', cs.bigIdea, ps.bigIdea);
  push('SERMON', 'Teks Utama Sermon', cs.teksUtama?.ref, ps.teksUtama?.ref);
  push('SERMON', 'Outline · Pengantar', cs.outline?.pengantar, ps.outline?.pengantar);
  push('SERMON', 'Outline · Bedah Teologis', cs.outline?.bedahTeologis, ps.outline?.bedahTeologis);
  push('SERMON', 'Outline · Jembatan', cs.outline?.jembatan, ps.outline?.jembatan);
  push('SERMON', 'Outline · Kesimpulan', cs.outline?.kesimpulan, ps.outline?.kesimpulan);
  push('SERMON', 'Ringkasan Khotbah', cs.summary, ps.summary);
  push('SERMON', 'Pendekatan & Metode', cs.rationale, ps.rationale);
  push('SERMON', 'Kerangka Slide', joinList(cs.slideOutline, 'title'), joinList(ps.slideOutline, 'title'));
  push('SERMON', 'Panduan Deliver', joinList(cs.deliveryPlan, 'method'), joinList(ps.deliveryPlan, 'method'));
  push('SERMON', 'Checklist Persiapan', joinList(cs.prepChecklist), joinList(ps.prepChecklist));
  push('SERMON', 'Alur FGD', joinList(cs.discussionFlow), joinList(ps.discussionFlow));

  // Ringkasan singkat
  const parts = [];
  const pathChanged = diff.filter((d) => d.section.startsWith('PATH:')).length;
  if (pathChanged) parts.push(`${pathChanged} item Path berubah`);
  if (diff.some((d) => d.section === 'SERMON' && d.label === 'Ringkasan Khotbah')) parts.push('Ringkasan Khotbah diperbarui');
  if (diff.some((d) => d.section === 'SERMON' && d.label === 'Kerangka Slide')) parts.push('Kerangka slide berubah');
  if (diff.some((d) => d.section === 'INTI')) parts.push('Inti/brief diperbarui');
  const rhbFilled = propPaths.filter((p) => (p.rhbSections || []).some((s) => (s.body || '').trim())).length;
  if (rhbFilled) parts.push(`RHB terisi ${rhbFilled}/7 hari`);
  // Guard susut: peringatkan bila isi RHB menyusut >50% dibanding saat ini.
  const rhbChars = (paths) => (paths || []).reduce((n, p) => n + ((p.rhbSections || []).reduce((m, s) => m + String(s.body || '').length, 0)), 0);
  const beforeChars = rhbChars(curPaths);
  const afterChars = rhbChars(propPaths);
  if (beforeChars > 0 && afterChars < beforeChars / 2) {
    parts.push(`PERINGATAN: isi RHB menyusut ${beforeChars} → ${afterChars} karakter — periksa sebelum menyetujui`);
  }
  const thin = richnessCheck(prop);
  if (thin.underStandard > 0) {
    parts.push(`${thin.underStandard} section RHB di bawah standar 300 karakter`);
  }

  return { diff, summary: parts.length ? parts.join(' · ') : 'Tidak ada perubahan terdeteksi' };
}

/** Hari kalender baku Path 1-7 (Path 1 = Minggu). */
const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Standar panjang minimum body RHB per section. */
export const RHB_MIN_BODY_CHARS = 300;

/**
 * Cek kekayaan proposal: section kosong (penolak) + di bawah standar.
 * @returns {{ empty: Array<{path:number,key:string}>, underStandard: number, totalChars: number }}
 */
export function richnessCheck(proposal) {
  const paths = Array.isArray(proposal?.paths) ? proposal.paths : [];
  const empty = [];
  let underStandard = 0;
  let totalChars = 0;
  paths.forEach((p, i) => {
    for (const s of p?.rhbSections || []) {
      const len = String(s?.body || '').length;
      totalChars += len;
      if (!String(s?.body || '').trim()) empty.push({ path: i + 1, key: s?.key || '' });
      else if (len < RHB_MIN_BODY_CHARS) underStandard += 1;
    }
  });
  return { empty, underStandard, totalChars };
}

/** Usulan kosong (string kosong/whitespace, array kosong) = pertahankan lama. */
function keepOld(nextVal, oldVal) {
  if (Array.isArray(nextVal)) return nextVal.length ? nextVal : (oldVal ?? nextVal);
  const s = nextVal === undefined || nextVal === null ? '' : String(nextVal);
  return s.trim() ? nextVal : oldVal;
}

/** Proposal dari draft AI (hanya field yang boleh diusulkan; struktur tetap). */
export function proposalFromDraft(draft, current) {
  const cur = current && typeof current === 'object' ? current : {};
  const paths = Array.isArray(draft?.paths) ? draft.paths : [];
  // Struktur dikunci: hari & key RHB tetap dari data saat ini.
  const mergedPaths = Array.from({ length: 7 }, (_, i) => {
    const base = (cur.paths || [])[i] || {};
    const next = paths[i] || {};
    const baseRhb = Array.isArray(base.rhbSections) ? base.rhbSections : [];
    const nextRhb = Array.isArray(next.rhbSections) ? next.rhbSections : [];
    // Bila struktur lama belum ada (mis. setelah reset), pakai RHB dari AI.
    // Kosong dari AI = pertahankan lama (anti-hilang).
    const rhbSections = baseRhb.length
      ? baseRhb.map((s, si) => ({ ...s, body: keepOld(nextRhb[si]?.body, s.body) }))
      : nextRhb;
    const merged = { ...base };
    for (const [k, v] of Object.entries(next)) {
      if (k === 'pathIndex' || k === 'rhbSections') continue;
      merged[k] = keepOld(v, base[k]);
    }
    return {
      ...merged,
      pathIndex: i + 1,
      dayLabel: DAY_LABELS[i],
      rhbSections,
    };
  });
  const draftSermon = draft?.sermon && typeof draft.sermon === 'object' ? draft.sermon : null;
  const sermonHasContent = draftSermon && (String(draftSermon.summary || '').trim() || (Array.isArray(draftSermon.slideOutline) && draftSermon.slideOutline.length));
  const curFF = cur.fundamentalFirman && typeof cur.fundamentalFirman === 'object' ? cur.fundamentalFirman : {};
  const nextFF = draft?.fundamentalFirman && typeof draft.fundamentalFirman === 'object' ? draft.fundamentalFirman : {};
  return {
    chapterNo: keepOld(draft?.chapterNo, cur.chapterNo) ?? '',
    fundamentalFirman: {
      ref: keepOld(nextFF.ref, curFF.ref) ?? '',
      text: keepOld(nextFF.text, curFF.text) ?? '',
    },
    kitabFokus: keepOld(draft?.kitabFokus, cur.kitabFokus) ?? '',
    homileticMethods: Array.isArray(draft?.homileticMethods) && draft.homileticMethods.length ? draft.homileticMethods : (cur.homileticMethods || []),
    methodMix: Array.isArray(draft?.methodMix) && draft.methodMix.length ? draft.methodMix : (cur.methodMix || []),
    paths: mergedPaths,
    sermon: sermonHasContent ? draftSermon : (cur.sermon ?? {}),
  };
}
