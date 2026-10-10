/**
 * Didaskalia — provider ayat Alkitab via bolls.life (tanpa API key).
 *
 * Canonical: TB (Terjemahan Baru) untuk materi prod Indonesia.
 * Pembanding studi: KJV, ESV. NIV & varian SENGAJA dinonaktifkan —
 * penerbit (Biblica) melarang penayangan di bolls.life (respons `ablated`,
 * diverifikasi live Okt 2026).
 *
 * Prinsip: READ-ONLY terhadap DB. Modul ini hanya mengambil + membandingkan
 * teks kanonis; koreksi tetap MANUAL oleh admin via Studio (tombol salin).
 * Hormati server bolls (single-core): batch via get-text per pasal, cache
 * 30 hari, timeout 15 dtk. Jangan scrape seluruh Alkitab via loop —
 * untuk itu pakai /static/translations/<slug>.zip di sisi admin.
 */

export const BOLLS_BASE = 'https://bolls.life';

/** Versi yang didukung endpoint verify (slug = short_name bolls). */
export const BOLLS_VERSIONS = {
  TB: { label: 'Terjemahan Baru', lang: 'Indonesian', canonical: true, attribution: 'TB © LAI via bolls.life' },
  KJV: { label: 'King James Version', lang: 'English', canonical: false, attribution: 'KJV (public domain) via bolls.life' },
  ESV: { label: 'English Standard Version', lang: 'English', canonical: false, attribution: 'ESV © Crossway via bolls.life' },
};

/** Versi yang ditolak (ablated / dilarang penerbit di bolls.life). */
export const BOLLS_DISABLED = {
  NIV: 'NIV dilarang tampil di bolls.life oleh penerbit (Biblica) — pakai ESV/KJV/NET sebagai pembanding Inggris.',
  NIV2011: 'NIV 2011 dilarang tampil di bolls.life oleh penerbit (Biblica) — pakai ESV/KJV/NET sebagai pembanding Inggris.',
  NIVUK: 'NIVUK dilarang tampil di bolls.life oleh penerbit (Biblica).',
  TNIV: 'TNIV dilarang tampil di bolls.life oleh penerbit (Biblica).',
  NIRV: 'NIRV dilarang tampil di bolls.life oleh penerbit (Biblica).',
};

/**
 * Urutan 66 kitab Protestan (bookid bolls = indeks + 1).
 * Diverifikasi live via get-books/TB/: 46 = 1 Korintus, 47 = 2 Korintus,
 * 51 = Kolose. Sinkron dengan src/data/bible-books.ts.
 */
const BOOK_ORDER = [
  ['Kejadian', 'Kej'], ['Keluaran', 'Kel'], ['Imamat', 'Im'], ['Bilangan', 'Bil'],
  ['Ulangan', 'Ul'], ['Yosua', 'Yos'], ['Hakim-hakim', 'Hak'], ['Rut', 'Rut'],
  ['1 Samuel', '1Sam'], ['2 Samuel', '2Sam'], ['1 Raja-raja', '1Raj'], ['2 Raja-raja', '2Raj'],
  ['1 Tawarikh', '1Taw'], ['2 Tawarikh', '2Taw'], ['Ezra', 'Ezr'], ['Nehemia', 'Neh'],
  ['Ester', 'Est'], ['Ayub', 'Ayb'], ['Mazmur', 'Mzm'], ['Amsal', 'Ams'],
  ['Pengkhotbah', 'Pkh'], ['Kidung Agung', 'Kid'], ['Yesaya', 'Yes'], ['Yeremia', 'Yer'],
  ['Ratapan', 'Rat'], ['Yehezkiel', 'Yeh'], ['Daniel', 'Dan'], ['Hosea', 'Hos'],
  ['Yoel', 'Yl'], ['Amos', 'Am'], ['Obaja', 'Ob'], ['Yunus', 'Yun'],
  ['Mikha', 'Mi'], ['Nahum', 'Nah'], ['Habakuk', 'Hab'], ['Zefanya', 'Zef'],
  ['Hagai', 'Hag'], ['Zakharia', 'Za'], ['Maleakhi', 'Mal'], ['Matius', 'Mat'],
  ['Markus', 'Mrk'], ['Lukas', 'Luk'], ['Yohanes', 'Yoh'], ['Kisah Para Rasul', 'Kis'],
  ['Roma', 'Rm'], ['1 Korintus', '1Kor'], ['2 Korintus', '2Kor'], ['Galatia', 'Gal'],
  ['Efesus', 'Ef'], ['Filipi', 'Flp'], ['Kolose', 'Kol'], ['1 Tesalonika', '1Tes'],
  ['2 Tesalonika', '2Tes'], ['1 Timotius', '1Tim'], ['2 Timotius', '2Tim'], ['Titus', 'Tit'],
  ['Filemon', 'Flm'], ['Ibrani', 'Ibr'], ['Yakobus', 'Yak'], ['1 Petrus', '1Ptr'],
  ['2 Petrus', '2Ptr'], ['1 Yohanes', '1Yoh'], ['2 Yohanes', '2Yoh'], ['3 Yohanes', '3Yoh'],
  ['Yudas', 'Yud'], ['Wahyu', 'Why'],
];

const normBook = (s) => String(s || '').toLowerCase().replace(/[.\s]/g, '');

/** bookid bolls (1–66) dari nama/singkatan Indonesia, atau null. */
export function bookIdFor(label) {
  const n = normBook(label);
  if (!n) return null;
  const idx = BOOK_ORDER.findIndex(([name, abbr]) => normBook(name) === n || normBook(abbr) === n);
  return idx >= 0 ? idx + 1 : null;
}

/** Nama kitab Indonesia dari bookid, atau null. */
export function bookNameFor(bookId) {
  const b = BOOK_ORDER[Number(bookId) - 1];
  return b ? b[0] : null;
}

/**
 * Parse "2 Korintus 5:21" / "Kol 1:13-14" / "Kolose 1:13–14" (en-dash ok).
 * @returns {{bookId, book, chapter, verseStart, verseEnd} | null}
 */
export function parseBollsRef(ref) {
  const s = String(ref || '').trim().replace(/[–—]/g, '-');
  const m = s.match(/^(.+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  const bookId = bookIdFor(m[1]);
  if (!bookId) return null;
  const chapter = Number(m[2]);
  const verseStart = Number(m[3]);
  const verseEnd = m[4] ? Number(m[4]) : verseStart;
  if (!Number.isFinite(chapter) || chapter < 1 || !Number.isFinite(verseStart) || verseStart < 1) return null;
  return { bookId, book: bookNameFor(bookId), chapter, verseStart, verseEnd: Math.max(verseEnd, verseStart) };
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Kupas tag HTML bolls (termasuk nomor Strong `<S>1063</S>`) + rapikan spasi. */
export function stripBollsHtml(html) {
  let s = String(html || '');
  s = s.replace(/<S>\d+<\/S>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);
  return s.replace(/\s+/g, ' ').trim();
}

/** Normalisasi untuk perbandingan longgar (abaikan kapital/spasi/tanda baca). */
export function normVerseText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[,"“”‘’.;:!?()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** true bila teks DB selaras dengan teks kanonis (perbandingan longgar). */
export function verseMatches(canonical, actual) {
  if (!canonical || !actual) return false;
  return normVerseText(canonical) === normVerseText(actual);
}

const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const _cache = new Map();

function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return hit.data;
}

function cacheSet(key, data) {
  if (_cache.size > 2000) _cache.clear();
  _cache.set(key, { at: Date.now(), data });
}

async function fetchJson(url, { fetchImpl, timeoutMs = 15000 } = {}) {
  const f = fetchImpl || globalThis.fetch;
  if (typeof f !== 'function') throw new Error('fetch tidak tersedia.');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`bolls.life ${res.status} untuk ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Deteksi respons ablated (ditarik penerbit) — teks protes, bukan ayat. */
export function isAblatedText(text) {
  return /has prohibited me from using|prohibit.*from using/i.test(String(text || ''));
}

/**
 * Ambil rentang ayat dari bolls.life (1 request get-text per pasal).
 * @returns {Promise<{version, bookId, book, chapter, verseStart, verseEnd, verses: [{verse, text}], text, ablated, attribution}>}
 */
export async function getBollsRange(version, parsed, opts = {}) {
  const V = String(version || '').toUpperCase();
  if (BOLLS_DISABLED[V]) throw new Error(BOLLS_DISABLED[V]);
  if (!BOLLS_VERSIONS[V]) throw new Error(`Versi ${V} belum didukung (pakai ${Object.keys(BOLLS_VERSIONS).join('/')}).`);
  const key = `${V}:${parsed.bookId}:${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  const rows = await fetchJson(
    `${BOLLS_BASE}/get-text/${V}/${parsed.bookId}/${parsed.chapter}/`,
    opts,
  );
  if (!Array.isArray(rows)) throw new Error(`Respons tak terduga dari bolls.life (${V}).`);
  const verses = rows
    .filter((r) => Number(r?.verse) >= parsed.verseStart && Number(r?.verse) <= parsed.verseEnd)
    .map((r) => ({ verse: Number(r.verse), text: stripBollsHtml(r.text) }))
    .sort((a, b) => a.verse - b.verse);
  if (!verses.length) throw new Error(`Ayat tidak ditemukan di bolls.life (${V} ${parsed.book} ${parsed.chapter}:${parsed.verseStart}).`);
  const ablated = verses.some((v) => isAblatedText(v.text));
  const out = {
    version: V,
    bookId: parsed.bookId,
    book: parsed.book,
    chapter: parsed.chapter,
    verseStart: parsed.verseStart,
    verseEnd: parsed.verseEnd,
    verses,
    text: verses.map((v) => v.text).join(' '),
    ablated,
    attribution: BOLLS_VERSIONS[V].attribution,
  };
  cacheSet(key, out);
  return out;
}

/**
 * Verifikasi satu referensi ke beberapa versi (default TB).
 * @returns {Promise<{ok, ref, parsed, results}>} — results per versi {version, text, verses, ablated, attribution} atau {version, error}.
 */
export async function verifyVerse(ref, versions = ['TB'], opts = {}) {
  const parsed = parseBollsRef(ref);
  if (!parsed) return { ok: false, ref: String(ref || ''), error: 'Referensi tidak dikenali (contoh: 2 Korintus 5:21, Kolose 1:13-14).' };
  const list = [...new Set((Array.isArray(versions) ? versions : [versions]).map((v) => String(v || '').toUpperCase()).filter(Boolean))].slice(0, 4);
  if (!list.length) return { ok: false, ref, error: 'versions kosong.' };
  const results = [];
  for (const V of list) {
    if (BOLLS_DISABLED[V]) { results.push({ version: V, error: BOLLS_DISABLED[V], disabled: true }); continue; }
    if (!BOLLS_VERSIONS[V]) { results.push({ version: V, error: `Versi ${V} belum didukung.` }); continue; }
    try {
      results.push(await getBollsRange(V, parsed, opts));
    } catch (e) {
      results.push({ version: V, error: String(e?.message || e) });
    }
  }
  return { ok: results.some((r) => !r.error), ref: String(ref), parsed, results };
}
