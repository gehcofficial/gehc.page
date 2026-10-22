/**
 * Gabung satu bagian studio ke minggu yang sudah ada.
 * Satu permintaan = satu tulis JSON, tanpa mengirim ulang diskusi/render/gambar.
 */

const SECTION_KEYS = ['PENGANTAR', 'PEMBAHASAN_TEMATIS', 'MAKNA_IMPLIKASI', 'REFLEKSI_PRIBADI', 'DISKUSI_KELOMPOK'];

function clip(v, n) {
  return String(v ?? '').slice(0, n);
}

export function sanitizeSourceSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const paths = Array.isArray(raw.paths) ? raw.paths.slice(0, 7).map((p, i) => {
    const src = p?.sections && typeof p.sections === 'object' ? p.sections : {};
    const sections = {};
    for (const k of SECTION_KEYS) sections[k] = clip(src[k], 20000);
    return {
      pathIndex: i + 1,
      title: clip(p?.title, 160),
      scriptureRef: clip(p?.scriptureRef, 160),
      summary: clip(p?.summary, 600),
      bridge: clip(p?.bridge, 2000),
      sections,
    };
  }) : [];
  const sermon = raw.sermon && typeof raw.sermon === 'object' ? raw.sermon : {};
  const outline = sermon.outline && typeof sermon.outline === 'object' ? sermon.outline : {};
  return {
    kitabFundamental: clip(raw.kitabFundamental, 160),
    kitabFokus: clip(raw.kitabFokus, 160),
    paths,
    sermon: {
      teksUtamaRef: clip(sermon.teksUtamaRef, 160),
      bigIdea: clip(sermon.bigIdea, 500),
      summary: clip(sermon.summary, 8000),
      outline: {
        pengantar: clip(outline.pengantar, 6000),
        bedahTeologis: clip(outline.bedahTeologis, 8000),
        jembatan: clip(outline.jembatan, 6000),
        kesimpulan: clip(outline.kesimpulan, 4000),
      },
    },
  };
}

export function mergeStudioSection(studio, body) {
  const s = studio && typeof studio === 'object' ? { ...studio } : {};
  const target = String(body?.target || '');
  if (target === 'path') {
    const pathIndex = Number(body.pathIndex);
    const paths = Array.isArray(s.paths) ? s.paths.map((p) => (p && typeof p === 'object' ? { ...p } : {})) : [];
    while (paths.length < 7) paths.push({});
    const i = pathIndex - 1;
    if (i >= 0 && i < 7 && body.path && typeof body.path === 'object') {
      paths[i] = { ...paths[i], ...body.path, pathIndex };
    }
    s.paths = paths.slice(0, 7);
    return s;
  }
  if (target === 'sermon') {
    const patch = body.sermon && typeof body.sermon === 'object' ? body.sermon : {};
    const cur = s.sermon && typeof s.sermon === 'object' ? s.sermon : {};
    s.sermon = {
      ...cur,
      ...patch,
      teksUtama: { ...(cur.teksUtama || {}), ...(patch.teksUtama || {}) },
      outline: { ...(cur.outline || {}), ...(patch.outline || {}) },
    };
    if (Array.isArray(body.homileticMethods)) {
      s.homileticMethods = body.homileticMethods.map((x) => clip(x, 80)).filter(Boolean).slice(0, 12);
    }
    if (Array.isArray(body.methodMix)) {
      s.methodMix = body.methodMix.slice(0, 8).map((row) => ({
        method: clip(row?.method, 80),
        percent: Math.max(0, Math.min(100, Number(row?.percent) || 0)),
        note: clip(row?.note, 200),
      }));
    }
    if (body.chapterNo !== undefined) s.chapterNo = clip(body.chapterNo, 40);
    if (body.fundamentalFirman && typeof body.fundamentalFirman === 'object') {
      const firman = s.fundamentalFirman && typeof s.fundamentalFirman === 'object' ? s.fundamentalFirman : {};
      s.fundamentalFirman = {
        ...firman,
        ...(body.fundamentalFirman.ref !== undefined ? { ref: clip(body.fundamentalFirman.ref, 160) } : {}),
        ...(body.fundamentalFirman.text !== undefined ? { text: clip(body.fundamentalFirman.text, 4000) } : {}),
      };
    }
    return s;
  }
  if (target === 'sumber') {
    const p = body.sumber && typeof body.sumber === 'object' ? body.sumber : {};
    if (p.kitabFokus !== undefined) s.kitabFokus = clip(p.kitabFokus, 160);
    if (p.chapterNo !== undefined) s.chapterNo = clip(p.chapterNo, 40);
    if (p.fundamentalFirman && typeof p.fundamentalFirman === 'object') {
      s.fundamentalFirman = { ...(s.fundamentalFirman || {}), ...p.fundamentalFirman };
    }
    if (p.teksUtama && typeof p.teksUtama === 'object') {
      const cur = s.sermon && typeof s.sermon === 'object' ? s.sermon : {};
      s.sermon = { ...cur, teksUtama: { ...(cur.teksUtama || {}), ...p.teksUtama } };
    }
    if (p.sourceMd && typeof p.sourceMd === 'object') s.sourceMd = p.sourceMd;
    if (p.sourceSnapshot && typeof p.sourceSnapshot === 'object') s.sourceSnapshot = p.sourceSnapshot;
    if (Array.isArray(p.paths)) s.paths = p.paths;
    if (p.sermon && typeof p.sermon === 'object') {
      s.sermon = p.sermon;
    }
    return s;
  }
  if (target === 'discussion') {
    if (Array.isArray(body.discussion)) s.discussion = body.discussion;
    return s;
  }
  if (target === 'presentation') {
    const patch = body.presentation && typeof body.presentation === 'object' ? body.presentation : {};
    s.presentation = { ...(s.presentation || {}), ...patch };
    return s;
  }
  return s;
}
