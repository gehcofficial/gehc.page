/**
 * Didaskalia — parser MD mingguan (Service & RHB).
 *
 * Masukan utama baru skenario studio: file MD bersih (utama) atau terbungkus
 * wrapper Python `md_content = """..."""` (fallback, mis. For RHB_1111026.md).
 * Keluaran = draf yang bisa disunting, BUKAN timpa otomatis.
 */

function asStr(v, max = 8000) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Kupas wrapper Python `md_content = """..."""` + blok `open(...).write`. */
export function unwrapPythonMd(raw) {
  const s = String(raw || '');
  const m = s.match(/"""([\s\S]*)"""/);
  if (m) return m[1].trim();
  return s.trim();
}

function splitSections(md) {
  // Pecah berdasarkan heading ## / ### — kembalikan [{ level, title, body }].
  const lines = String(md || '').split('\n');
  const out = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      if (cur) out.push(cur);
      cur = { level: h[1].length, title: h[2].trim(), body: '' };
    } else if (cur) {
      cur.body += `${line}\n`;
    }
  }
  if (cur) out.push(cur);
  for (const s of out) s.body = s.body.trim();
  return out;
}

function cleanBody(s, max = 6000) {
  return asStr(s, max).replace(/\n{3,}/g, '\n\n');
}

/**
 * Parse MD Service (contoh: For Service_111026.md) → 4 outline khotbah.
 * Struktur yang dikenali:
 *   A. Informasi Sesi: Tema, Teks Utama, Teks Jangkar
 *   1. Pengantar | 2. Bedah Teologis | 3. Jembatan | 4. Kesimpulan
 * @returns {{ ok, missing: string[], info, outline }} — missing = bagian tak ditemukan.
 */
export function parseServiceMd(raw) {
  const md = unwrapPythonMd(raw);
  const sections = splitSections(md);
  const find = (...keys) =>
    sections.find((s) => keys.some((k) => s.title.toLowerCase().includes(k)));

  const infoSec = find('informasi sesi');
  const infoBody = infoSec ? infoSec.body : md.slice(0, 1500);
  const pick = (re) => {
    const m = infoBody.match(re);
    return m ? asStr(m[1], 300).replace(/^\*+\s*|\s*\*+$/g, '') : '';
  };
  const info = {
    tema: pick(/tema[^:\n]*:\*?\*?\s*([^\n]+)/i),
    teksUtama: pick(/teks utama[^:\n]*:\*?\*?\s*([^\n]+)/i),
    teksJangkar: pick(/teks jangkar[^:\n]*:\*?\*?\s*([^\n]+)/i),
  };

  const pengantar = find('pengantar');
  const bedah = find('bedah teologis', 'bedah teologi', 'the great exchange', 'pertukaran besar');
  const jembatan = find('jembatan');
  const kesimpulan = find('kesimpulan');

  const outline = {
    pengantar: pengantar ? cleanBody(pengantar.body) : '',
    bedahTeologis: bedah ? cleanBody(bedah.body) : '',
    jembatan: jembatan ? cleanBody(jembatan.body) : '',
    kesimpulan: kesimpulan ? cleanBody(kesimpulan.body) : '',
  };
  const missing = [];
  if (!outline.pengantar) missing.push('Pengantar');
  if (!outline.bedahTeologis) missing.push('Bedah Teologis');
  if (!outline.jembatan) missing.push('Jembatan Menuju Tema Mingguan');
  if (!outline.kesimpulan) missing.push('Kesimpulan');
  if (!info.teksUtama) missing.push('Teks Utama (Serving Day / Sermon)');
  return { ok: missing.length === 0, missing, info, outline };
}

/**
 * Parse MD RHB (contoh: For RHB_1111026.md) → 7 Path.
 * Struktur: `### Path N: Judul` + `**Scripture:** ref` (Nats Pembimbing, bervariasi)
 *   + opsional `**Bacaan:** ref` (porsi harian dari Kitab/Bagian Fokus statis) + narasi + `> bridge`.
 */
export function parseRhbMd(raw) {
  const md = unwrapPythonMd(raw);
  const sections = splitSections(md).filter((s) => /^path\s+\d+/i.test(s.title));
  const paths = sections.slice(0, 7).map((s, i) => {
    const titleM = s.title.match(/^path\s+\d+\s*[:\-–—]?\s*(.*)$/i);
    const title = asStr(titleM ? titleM[1] : s.title, 120);
    const refM = s.body.match(/\*\*scripture:\*\*\s*([^\n]+)/i);
    const scriptureRef = asStr(refM ? refM[1] : '', 160);
    const bacaanM = s.body.match(/\*\*bacaan:\*\*\s*([^\n]+)/i);
    const bacaanRef = asStr(bacaanM ? bacaanM[1] : '', 160);
    const bridgeM = s.body.match(/^>\s*(.+)$/m);
    const bridge = asStr(bridgeM ? bridgeM[1] : '', 500);
    const summary = cleanBody(
      s.body
        .replace(/\*\*scripture:\*\*\s*[^\n]+\n?/i, '')
        .replace(/\*\*bacaan:\*\*\s*[^\n]+\n?/i, '')
        .replace(/^>\s*.+$/m, ''),
      600
    );
    return { pathIndex: i + 1, title, scriptureRef, bacaanRef, summary, bridge };
  });
  const missing = [];
  if (paths.length < 7) missing.push(`Hanya ${paths.length}/7 Path ditemukan`);
  paths.forEach((p, i) => {
    if (!p.scriptureRef) missing.push(`Path ${i + 1}: Scripture kosong`);
  });
  return { ok: missing.length === 0, missing, paths };
}

/**
 * Parse MD RHB LENGKAP 7 hari (isi harian jadi, mis. Ancient_Word Paths_1-7.md).
 * Struktur per hari:
 *   `# PATH N — …` + `## Judul` + `**Ayat Renungan: ref**`
 *   + `### Pengantar|Pembahasan Tematis|Makna dan Implikasi bagi Beyonders|
 *     Pertanyaan untuk Refleksi Pribadi|Pertanyaan untuk Diskusi Kelompok`
 *   + `### Jembatan …` (= bridge).
 * @returns {{ ok, missing: string[], paths: [{ pathIndex, title, scriptureRef, sections, bridge }] }}
 */
const FULL_SECTION_KEYS = [
  { key: 'PENGANTAR', match: /^pengantar$/i },
  { key: 'PEMBAHASAN_TEMATIS', match: /^pembahasan tematis$/i },
  { key: 'MAKNA_IMPLIKASI', match: /^makna (dan|&) implikasi( bagi beyonders)?$/i },
  { key: 'REFLEKSI_PRIBADI', match: /^pertanyaan untuk refleksi pribadi$/i },
  { key: 'DISKUSI_KELOMPOK', match: /^pertanyaan untuk diskusi kelompok$/i },
];

export function parseRhbFullMd(raw) {
  const md = unwrapPythonMd(raw);
  const lines = String(md || '').split('\n');
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    const h1 = line.match(/^#\s+PATH\s+(\d+)\b/i);
    if (h1) {
      if (cur) blocks.push(cur);
      cur = { pathIndex: Number(h1[1]), lines: [] };
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  if (cur) blocks.push(cur);

  const paths = blocks.slice(0, 7).map((b, i) => {
    const pathIndex = Number.isInteger(b.pathIndex) && b.pathIndex >= 1 && b.pathIndex <= 7 ? b.pathIndex : i + 1;
    let title = '';
    let scriptureRef = '';
    const sections = {};
    let bridge = '';
    let curKey = '';
    let curBridge = false;
    const buf = [];
    const flush = () => {
      const t = buf.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      buf.length = 0;
      if (curBridge) {
        if (t) bridge = `${bridge ? `${bridge}\n\n` : ''}${t}`.slice(0, 2000);
      } else if (curKey) {
        sections[curKey] = `${sections[curKey] ? `${sections[curKey]}\n\n` : ''}${t}`.slice(0, 20000);
      }
      curKey = '';
      curBridge = false;
    };
    for (const line of b.lines) {
      const h2 = line.match(/^##\s+(.*)$/);
      if (h2 && !title) {
        flush();
        title = asStr(h2[1], 120);
        continue;
      }
      const ayat = line.match(/^\*\*ayat renungan:\s*(.+)$/i);
      if (ayat) {
        flush();
        scriptureRef = asStr(ayat[1].replace(/\*+\s*$/, ''), 160);
        continue;
      }
      const h3 = line.match(/^###\s+(.*)$/);
      if (h3) {
        flush();
        const name = h3[1].trim();
        const hit = FULL_SECTION_KEYS.find((k) => k.match.test(name));
        if (hit) curKey = hit.key;
        else if (/^jembatan/i.test(name)) curBridge = true;
        continue;
      }
      if (/^---+\s*$/.test(line)) {
        flush();
        continue;
      }
      buf.push(line);
    }
    flush();
    return { pathIndex, title, scriptureRef, sections, bridge: bridge.trim() };
  });

  const missing = [];
  if (paths.length < 7) missing.push(`Hanya ${paths.length}/7 Path ditemukan (heading "# PATH N" tidak lengkap?)`);
  paths.forEach((p, i) => {
    const n = p.pathIndex || i + 1;
    if (!p.title) missing.push(`Path ${n}: judul (## …) kosong`);
    if (!p.scriptureRef) missing.push(`Path ${n}: Ayat Renungan kosong`);
    for (const k of FULL_SECTION_KEYS) {
      if (!p.sections[k.key]?.trim()) missing.push(`Path ${n}: section ${k.key} kosong`);
    }
  });
  return { ok: missing.length === 0, missing, paths };
}
