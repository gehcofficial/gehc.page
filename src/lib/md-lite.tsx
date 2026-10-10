/**
 * Markdown-lite untuk slide Didaskalia — render verbatim MD jadi blok baca yang rapi.
 *
 * DB tetap menyimpan teks mentah (standar literal); modul ini hanya cara tampil:
 * blok (heading/quote/divider/list/paragraf), inline tebal/miring,
 * dan PERAN semantik (firman/takeaway/koreksi/suara) yang memicu highlight
 * berbeda — warna tak pernah jadi satu-satunya pembeda (ikon/label/bentuk ikut).
 */
import React from 'react';
import { AlertTriangle, Quote, Star } from 'lucide-react';
import { BIBLE_BOOKS } from '../data/bible-books';

export type MdRole = 'body' | 'scripture' | 'takeaway' | 'correction' | 'speech' | 'reflection';

export type MdBlock =
  | { kind: 'para'; text: string; role: MdRole }
  | { kind: 'heading'; text: string }
  | { kind: 'quote'; text: string; ref?: string }
  | { kind: 'divider' }
  | { kind: 'list'; ordered: boolean; items: { text: string; level: number }[] };

/** Kupas penanda markdown inline → teks polos (untuk PDF/teks biasa). */
export function stripMd(text?: string): string {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(>"'])\*([^*`\n]+)\*(?=[\s).,"';:!?]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

const VERSE_RE = (() => {
  const names = BIBLE_BOOKS.flatMap((b) => [b.name, b.abbr])
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${names.join('|')})\\s+(\\d{1,3}:\\d{1,3}(?:\\s*[–—-]\\s*\\d{1,3}(?::\\d{1,3})?)?)`, 'i');
})();

/** Deteksi referensi ayat pertama dalam teks ("2 Korintus 5:21"). */
export function extractVerseRef(text?: string): string | undefined {
  const m = String(text || '').match(VERSE_RE);
  return m ? `${m[1]} ${m[2].replace(/\s+/g, '')}` : undefined;
}

const TAKEAWAY_RE = /(poin utama|ingatlah|kuncinya|camkan|jadi,? hari ini)/i;
const CORRECTION_RE = /^(bukan berarti|sering disalahpahami|jangan salah|kesalahpahaman|bukan(kan)? berarti)/i;
/** Baris refleksi RHB (konteks Pelajar/Mahasiswa/Pekerja) → highlight emas. */
const REFLECTION_RE = /^[🎒🎓💼]/u;

function roleOf(text: string, speech: boolean): MdRole {
  const t = stripMd(text);
  if (REFLECTION_RE.test(t)) return 'reflection';
  if (TAKEAWAY_RE.test(t)) return 'takeaway';
  if (CORRECTION_RE.test(t)) return 'correction';
  if (speech) return 'speech';
  return 'body';
}

/**
 * Urai teks MD menjadi blok. Kata-kata TIDAK diubah — hanya struktur.
 * Opsi `speech`: seluruh paragraf dianggap suara pengkhotbah (bagian Kesimpulan).
 */
export function parseMdLite(text?: string, opts?: { speech?: boolean }): MdBlock[] {
  const speech = Boolean(opts?.speech);
  const lines = String(text || '').split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: { text: string; level: number }[] } | null = null;

  const flushPara = () => {
    const t = para.join(' ').replace(/\s+/g, ' ').trim();
    para = [];
    if (t) blocks.push({ kind: 'para', text: t, role: roleOf(t, speech) });
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const raw = quote.join(' ').replace(/\s+/g, ' ').trim();
    quote = [];
    if (!raw) return;
    const refM = raw.match(/\(([^()]{1,60})\)\s*$/);
    const ref = refM ? refM[1].trim() : extractVerseRef(raw);
    const text = refM ? raw.slice(0, refM.index).trim() : raw;
    blocks.push({ kind: 'quote', text, ref });
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const line of lines) {
    if (/^\s*---+\s*$/.test(line)) { flushPara(); flushQuote(); flushList(); blocks.push({ kind: 'divider' }); continue; }
    const h = line.match(/^\s*#{2,4}\s+(.*)$/);
    if (h) { flushPara(); flushQuote(); flushList(); const t = stripMd(h[1]); if (t) blocks.push({ kind: 'heading', text: t }); continue; }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
    const li = line.match(/^(\s*)([*\-]|\d+[.)])\s+(.*)$/);
    if (li) {
      flushPara(); flushQuote();
      const ordered = /^\d/.test(li[2]);
      const level = Math.min(2, Math.floor(li[1].replace(/\t/g, '  ').length / 2));
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      const t = li[3].trim();
      if (t) list.items.push({ text: t, level });
      continue;
    }
    if (!line.trim()) { flushPara(); flushQuote(); flushList(); continue; }
    flushQuote(); flushList();
    para.push(line.trim());
  }
  flushPara(); flushQuote(); flushList();
  return blocks;
}

/** Pecah inline **tebal** / *miring* menjadi node React (tanpa HTML mentah). */
export function inlineSpans(text: string, boldCls: string, italicCls: string): React.ReactNode[] {
  const parts = String(text).split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return <strong key={i} className={boldCls}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <em key={i} className={italicCls}>{p.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

export type MdTone = 'overlay' | 'plain' | 'paper';

const ROLE_LABEL: Record<Exclude<MdRole, 'body' | 'scripture'>, string> = {
  takeaway: 'Poin Utama',
  correction: 'Luruskan',
  speech: 'Suara Pengkhotbah',
  reflection: 'Refleksi',
};

/** Kepadatan tipografi: roomy (slide ringan → font naik), compact (slide gabungan → font turun + rapat). */
export type MdDensity = 'roomy' | 'compact';

/**
 * Render blok markdown-lite dengan highlight per peran.
 *
 * Tone:
 * - `overlay` — di atas foto/gelap (layar + cetak tetap terang).
 * - `plain` — permukaan gelap tanpa foto (layar terang, cetak gelap).
 * - `paper` — permukaan terang/kartu putih (layar + cetak gelap).
 */
export function MdBlocks({ blocks, tone = 'overlay', speech = false, density }: { blocks: MdBlock[]; tone?: MdTone; speech?: boolean; density?: MdDensity }) {
  const onPaper = tone === 'paper';
  const ink = onPaper ? 'text-[#1B1B1B]/90' : tone === 'overlay' ? 'text-white/90' : 'text-white/85 print:text-black/85';
  const dim = onPaper ? 'text-[#8C8880]' : tone === 'overlay' ? 'text-white/70' : 'text-white/60 print:text-black/60';
  const boldCls = onPaper ? 'font-bold text-sky-700' : tone === 'overlay' ? 'font-bold text-sky-200' : 'font-bold text-sky-300 print:text-sky-700';
  const accentDot = onPaper ? 'bg-sky-600' : tone === 'overlay' ? 'bg-white' : 'bg-sky-400';
  const kickerCls = onPaper ? 'text-sky-700' : tone === 'overlay' ? 'text-sky-200' : 'text-sky-300 print:text-sky-700';
  const para = !density ? 'text-base sm:text-xl' : density === 'roomy' ? 'text-lg sm:text-2xl' : 'text-sm sm:text-base';
  const big = !density ? 'text-lg sm:text-2xl' : density === 'roomy' ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl';
  const gap = density === 'compact' ? 'space-y-2.5' : density === 'roomy' ? 'space-y-5' : 'space-y-4';

  return (
    <div className={gap}>
      {blocks.map((b, i) => {
        if (b.kind === 'divider') {
          return <hr key={i} className={tone === 'overlay' ? 'border-white/15' : onPaper ? 'border-black/10' : 'border-white/10 print:border-black/20'} />;
        }
        if (b.kind === 'heading') {
          return (
            <p key={i} className={`text-xs font-black uppercase tracking-[0.18em] ${kickerCls} pt-1`}>
              {stripMd(b.text)}
            </p>
          );
        }
        if (b.kind === 'quote') {
          // Overlay (di atas foto yang ikut tercetak): teks TETAP terang.
          // Plain (permukaan gelap): fallback cetak gelap.
          // Paper (kartu putih): selalu gelap.
          const quoteCls = onPaper
            ? `${big} font-medium leading-relaxed text-[#1B1B1B]`
            : tone === 'overlay'
              ? `${big} font-medium leading-relaxed text-white`
              : `${big} font-medium leading-relaxed text-white print:text-black`;
          return (
            <figure key={i} className={`rounded-2xl border-l-4 border-sky-400 pl-4 py-1 ${tone === 'overlay' ? '' : 'print:border-sky-600'}`}>
              <blockquote className={quoteCls}>
                {inlineSpans(b.text.replace(/^["“”'\s]+|["“”'\s]+$/g, ''), boldCls, 'italic')}
              </blockquote>
              {b.ref && (
                <figcaption className="mt-2">
                  <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black tracking-wide ${onPaper ? 'bg-sky-50 text-sky-700 border border-sky-200' : tone === 'overlay' ? 'bg-sky-400/20 text-sky-200' : 'bg-sky-500/15 text-sky-300 print:bg-sky-50 print:text-sky-700'}`}>
                    {stripMd(b.ref)}
                  </span>
                </figcaption>
              )}
            </figure>
          );
        }
        if (b.kind === 'list') {
          return (
            <ul key={i} className={density === 'compact' ? 'space-y-1.5' : 'space-y-2.5'}>
              {b.items.map((it, j) => (
                <li key={j} className={`flex gap-3 ${para} leading-relaxed ${ink} ${it.level > 0 ? 'ml-6 text-[0.92em]' : ''}`}>
                  {b.ordered
                    ? <span className={`shrink-0 font-black ${onPaper ? 'text-sky-700' : tone === 'overlay' ? 'text-sky-200' : 'text-sky-300 print:text-sky-700'}`}>{j + 1}.</span>
                    : <span className={`mt-[9px] rounded-full shrink-0 ${accentDot} ${it.level > 0 ? 'h-1 w-1 opacity-70' : 'h-1.5 w-1.5'}`} />}
                  <span>{inlineSpans(it.text, boldCls, 'italic')}</span>
                </li>
              ))}
            </ul>
          );
        }
        // para
        const role: MdRole = speech && b.role === 'body' ? 'speech' : b.role;
        if (role === 'takeaway' || role === 'reflection') {
          const panelCls = onPaper
            ? 'rounded-2xl p-4 border bg-amber-50 border-amber-300'
            : tone === 'overlay'
              ? 'rounded-2xl p-4 border bg-amber-400/15 border-amber-300/40'
              : 'rounded-2xl p-4 border bg-amber-400/15 border-amber-300/40 print:bg-amber-50 print:border-amber-300';
          const labelCls = onPaper
            ? 'text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5'
            : tone === 'overlay'
              ? 'text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5'
              : 'text-[10px] font-black uppercase tracking-wider text-amber-300 print:text-amber-700 flex items-center gap-1.5';
          const textCls = onPaper
            ? `mt-1.5 ${para} leading-relaxed font-medium text-[#1B1B1B]`
            : tone === 'overlay'
              ? `mt-1.5 ${para} leading-relaxed font-medium text-white`
              : `mt-1.5 ${para} leading-relaxed font-medium text-white print:text-black`;
          const takeBold = onPaper ? 'font-bold text-amber-800' : tone === 'overlay' ? 'font-bold text-amber-200' : 'font-bold text-amber-200 print:text-amber-800';
          return (
            <div key={i} className={panelCls}>
              <p className={labelCls}>
                <Star className="w-3.5 h-3.5" /> {ROLE_LABEL[role]}
              </p>
              <p className={textCls}>
                {inlineSpans(b.text, takeBold, 'italic')}
              </p>
            </div>
          );
        }
        if (role === 'correction') {
          const panelCls = onPaper
            ? 'rounded-2xl p-4 border bg-[#FFFBEB] border-amber-300'
            : tone === 'overlay'
              ? 'rounded-2xl p-4 border bg-white/[0.06] border-amber-300/30'
              : 'rounded-2xl p-4 border bg-white/[0.06] border-amber-300/30 print:bg-white print:border-amber-300';
          const labelCls = onPaper
            ? 'text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5'
            : tone === 'overlay'
              ? 'text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5'
              : 'text-[10px] font-black uppercase tracking-wider text-amber-300 print:text-amber-700 flex items-center gap-1.5';
          return (
            <div key={i} className={panelCls}>
              <p className={labelCls}>
                <AlertTriangle className="w-3.5 h-3.5" /> {ROLE_LABEL.correction}
              </p>
              <p className={`mt-1.5 ${para} leading-relaxed ${ink}`}>
                {inlineSpans(b.text, boldCls, 'italic')}
              </p>
            </div>
          );
        }
        if (role === 'speech') {
          const speechCls = onPaper
            ? `${big} leading-relaxed font-medium text-[#1B1B1B] flex gap-2.5`
            : tone === 'overlay'
              ? `${big} leading-relaxed font-medium text-white flex gap-2.5`
              : `${big} leading-relaxed font-medium text-white print:text-black flex gap-2.5`;
          const iconCls = onPaper
            ? 'w-5 h-5 shrink-0 mt-1 text-amber-600'
            : tone === 'overlay'
              ? 'w-5 h-5 shrink-0 mt-1 text-amber-300'
              : 'w-5 h-5 shrink-0 mt-1 text-amber-300 print:text-amber-600';
          return (
            <p key={i} className={speechCls}>
              <Quote className={iconCls} />
              <span>{inlineSpans(b.text, boldCls, 'italic')}</span>
            </p>
          );
        }
        return (
          <p key={i} className={`${para} leading-relaxed ${ink}`}>
            {inlineSpans(b.text, boldCls, 'italic')}
          </p>
        );
      })}
      {blocks.length === 0 && <p className={`text-sm italic ${dim}`}>Belum ada isi.</p>}
    </div>
  );
}
