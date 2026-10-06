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
 * Struktur: `### Path N: Judul` + `**Scripture:** ref` + narasi + `> bridge`.
 */
export function parseRhbMd(raw) {
  const md = unwrapPythonMd(raw);
  const sections = splitSections(md).filter((s) => /^path\s+\d+/i.test(s.title));
  const paths = sections.slice(0, 7).map((s, i) => {
    const titleM = s.title.match(/^path\s+\d+\s*[:\-–—]?\s*(.*)$/i);
    const title = asStr(titleM ? titleM[1] : s.title, 120);
    const refM = s.body.match(/\*\*scripture:\*\*\s*([^\n]+)/i);
    const scriptureRef = asStr(refM ? refM[1] : '', 160);
    const bridgeM = s.body.match(/^>\s*(.+)$/m);
    const bridge = asStr(bridgeM ? bridgeM[1] : '', 500);
    const summary = cleanBody(
      s.body
        .replace(/\*\*scripture:\*\*\s*[^\n]+\n?/i, '')
        .replace(/^>\s*.+$/m, ''),
      600
    );
    return { pathIndex: i + 1, title, scriptureRef, summary, bridge };
  });
  const missing = [];
  if (paths.length < 7) missing.push(`Hanya ${paths.length}/7 Path ditemukan`);
  paths.forEach((p, i) => {
    if (!p.scriptureRef) missing.push(`Path ${i + 1}: Scripture kosong`);
  });
  return { ok: missing.length === 0, missing, paths };
}
