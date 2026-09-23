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

  return { diff, summary: parts.length ? parts.join(' · ') : 'Tidak ada perubahan terdeteksi' };
}

/** Proposal dari draft AI (hanya field yang boleh diusulkan; struktur tetap). */
export function proposalFromDraft(draft, current) {
  const cur = current && typeof current === 'object' ? current : {};
  const paths = Array.isArray(draft?.paths) ? draft.paths : [];
  // Struktur dikunci: hari & key RHB tetap dari data saat ini.
  const mergedPaths = Array.from({ length: 7 }, (_, i) => {
    const base = (cur.paths || [])[i] || {};
    const next = paths[i] || {};
    return {
      ...base,
      ...next,
      pathIndex: i + 1,
      dayLabel: base.dayLabel || next.dayLabel || '',
      rhbSections: (base.rhbSections || []).map((s, si) => ({
        ...s,
        body: (next.rhbSections || [])[si]?.body ?? s.body,
      })),
    };
  });
  return {
    chapterNo: draft?.chapterNo ?? cur.chapterNo ?? '',
    fundamentalFirman: draft?.fundamentalFirman ?? cur.fundamentalFirman ?? { ref: '', text: '' },
    kitabFokus: draft?.kitabFokus ?? cur.kitabFokus ?? '',
    homileticMethods: Array.isArray(draft?.homileticMethods) && draft.homileticMethods.length ? draft.homileticMethods : (cur.homileticMethods || []),
    methodMix: Array.isArray(draft?.methodMix) && draft.methodMix.length ? draft.methodMix : (cur.methodMix || []),
    paths: mergedPaths,
    sermon: draft?.sermon ?? cur.sermon ?? {},
  };
}
