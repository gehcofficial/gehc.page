/**
 * Normalisasi prosa naskah PDF (hard wrap) + markdown deck khotbah.
 * Dipakai parser server dan builder presentasi (import .mjs dari TS/Vite).
 */

const PDF_PAGE_FOOTER_RE = /^--\s*\d+\s+of\s+\d+\s*--$/i;
const MARKDOWN_HEADING_RE = /^#{2,4}\s+/;
const LETTER_HEADING_RE = /^[A-D]\.\s+\S/;
const NUMBER_HEADING_RE = /^\d+\.\s+\S/;
const SUBHEADING_RE = /^[a-z]\.\s+\S/i;
const LIST_LINE_RE = /^(?:[*\-•]|\d+[.)])\s+/;
const QUOTE_LINE_RE = /^>\s?/;

export function lineKind(line) {
  const t = String(line || '').trim();
  if (!t) return 'blank';
  if (PDF_PAGE_FOOTER_RE.test(t)) return 'noise';
  if (MARKDOWN_HEADING_RE.test(t) || LETTER_HEADING_RE.test(t) || NUMBER_HEADING_RE.test(t) || SUBHEADING_RE.test(t)) {
    return 'head';
  }
  if (LIST_LINE_RE.test(t)) return 'list';
  if (QUOTE_LINE_RE.test(t)) return 'quote';
  return 'prose';
}

function endsIncompleteHeading(line) {
  const t = String(line || '').trim();
  if (!t || lineKind(t) !== 'head') return false;
  if (/[.!?]$/.test(t)) return false;
  const colonIdx = t.indexOf(':');
  if (colonIdx > 0) {
    const after = t.slice(colonIdx + 1).trim();
    if (after.length >= 12) return false;
  }
  if (/\s(dan|atau|yang|Hal|ke|di|dari|pada|untuk|dengan|adalah)\s*$/i.test(t)) return true;
  return t.length > 0 && t.length < 120 && !/[.!?]$/.test(t) && colonIdx < 0;
}

function shouldJoinProse(prev, next) {
  const p = String(prev || '').trim();
  const n = String(next || '').trim();
  if (!p || !n) return false;
  if (lineKind(n) !== 'prose') return false;
  if (/[.!?…:;]$/.test(p)) {
    if (/^[a-z(]/.test(n)) return true;
    return false;
  }
  return true;
}

/**
 * Gabung baris terpotong PDF menjadi paragraf utuh.
 * Pertahankan heading (A./1./a.), list, quote, dan jeda paragraf (baris kosong).
 */
export function joinHardWrappedLines(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const paragraphs = [];
  let buf = [];

  const flush = () => {
    if (!buf.length) return;
    paragraphs.push(buf.join(' ').replace(/\s+/g, ' ').trim());
    buf = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const kind = lineKind(raw);
    if (kind === 'noise') continue;
    if (kind === 'blank') {
      flush();
      continue;
    }
    if (kind === 'head' || kind === 'list' || kind === 'quote') {
      flush();
      let head = raw.trim();
      while (i + 1 < lines.length) {
        const nk = lineKind(lines[i + 1]);
        if (nk === 'noise' || nk === 'blank') break;
        if (endsIncompleteHeading(head) && nk === 'prose') {
          const frag = lines[i + 1].trim();
          if (frag.length < 120 && !/[.!?]/.test(frag)) {
            head = `${head} ${frag}`.replace(/\s+/g, ' ').trim();
            i += 1;
            continue;
          }
        }
        break;
      }
      paragraphs.push(head);
      continue;
    }
    const trimmed = raw.trim();
    if (!buf.length) {
      buf.push(trimmed);
      continue;
    }
    if (shouldJoinProse(buf[buf.length - 1], trimmed)) {
      buf[buf.length - 1] = `${buf[buf.length - 1]} ${trimmed}`.replace(/\s+/g, ' ').trim();
    } else {
      flush();
      buf.push(trimmed);
    }
  }
  flush();
  return paragraphs.join('\n\n');
}

const QUESTION_START_RE = /^(apakah|mengapa|bagaimana|siapa|berapa|kapan|adakah|atau apakah|pertanyaan)/i;
const SCRIPTURE_INLINE_RE = /\(\s*(?:[1-3]\s+)?[A-Za-zÀ-ÿ][\w.'’]*(?:\s+[A-Za-zÀ-ÿ][\w.'’]*){0,4}\s+\d+\s*:\s*\d+/;
const VERSE_QUOTE_RE = /^["“"'].*["”"']\s*(?:\([^)]+\))?$/;
const SUBHEADING_PREFIX_RE = /^(?:#{2,4}\s+)?(?:[a-z]\.|[A-D]\.|\d+\.)\s+/i;

function ensureSubheadingMd(line) {
  const t = String(line || '').trim();
  if (!t) return '';
  if (MARKDOWN_HEADING_RE.test(t)) return t;
  if (SUBHEADING_PREFIX_RE.test(t)) return `#### ${t.replace(/^#{2,4}\s+/, '')}`;
  return t;
}

function formatParagraphBlock(para) {
  const t = String(para || '').trim();
  if (!t) return '';
  if (MARKDOWN_HEADING_RE.test(t) || SUBHEADING_PREFIX_RE.test(t)) return ensureSubheadingMd(t);
  if (QUOTE_LINE_RE.test(t)) return t;
  if (VERSE_QUOTE_RE.test(t) || (SCRIPTURE_INLINE_RE.test(t) && t.length < 320 && /["“"']/.test(t))) {
    return `> ${t.replace(/^>\s?/, '')}`;
  }
  const plain = stripMdLite(t);
  if (plain.endsWith('?') && (QUESTION_START_RE.test(plain) || plain.length < 220)) {
    return `> ${t.replace(/^>\s?/, '')}`;
  }
  return t;
}

function stripMdLite(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(>"'])\*([^*`\n]+)\*(?=[\s).,"';:!?]|$)/g, '$1$2')
    .trim();
}

/** Tambah penanda MD untuk deck (heading, kutipan, pertanyaan) tanpa mengubah kata. */
export function formatKhutbahOutlineMd(text) {
  const joined = joinHardWrappedLines(text);
  if (!joined.trim()) return '';
  return joined
    .split(/\n{2,}/)
    .map((p) => formatParagraphBlock(p))
    .filter(Boolean)
    .join('\n\n');
}

/** True bila baris berikutnya adalah sisa kata dari baris sebelumnya (potongan PDF). */
export function isMidSentenceLineBreak(prevLine, nextLine) {
  const p = String(prevLine || '').trim();
  const n = String(nextLine || '').trim();
  if (!p || !n) return false;
  if (lineKind(p) !== 'prose' || lineKind(n) !== 'prose') return false;
  if (/[.!?…]$/.test(p) && /^[A-Z]/.test(n)) return false;
  return shouldJoinProse(p, n);
}
