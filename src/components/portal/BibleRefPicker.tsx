import React, { useEffect, useState } from 'react';
import { BookMarked } from 'lucide-react';
import { BIBLE_BOOKS, parseBibleRef, formatBibleRef, type BibleBook } from '../../data/bible-books';

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]';

/**
 * Picker referensi Alkitab (Kitab → Pasal → Ayat). Referensi saja (tanpa teks
 * TB2). Nilai tak dikenal → mode "ketik manual".
 */
export const BibleRefPicker: React.FC<{
  value: string;
  onChange: (ref: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [manual, setManual] = useState(false);
  const [book, setBook] = useState<BibleBook | null>(null);
  const [chapter, setChapter] = useState(1);
  const [vStart, setVStart] = useState<number | ''>('');
  const [vEnd, setVEnd] = useState<number | ''>('');

  useEffect(() => {
    const p = parseBibleRef(value);
    if (p) {
      setBook(p.book);
      setChapter(p.chapter);
      setVStart(p.verseStart ?? '');
      setVEnd(p.verseEnd ?? '');
      setManual(false);
    } else if (value) {
      setManual(true);
    }
  }, [value]);

  const emit = (b: BibleBook | null, c: number, vs: number | '', ve: number | '') => {
    if (!b) return;
    onChange(formatBibleRef(b, c, typeof vs === 'number' ? vs : null, typeof ve === 'number' ? ve : null));
  };

  if (manual) {
    return (
      <div className="space-y-1">
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ketik referensi, mis. 2 Kor 3:7-11"
          className={inputCls}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setManual(false)}
          className="text-[10px] font-bold text-sky-700 inline-flex items-center gap-1"
        >
          <BookMarked className="w-3 h-3" /> Pilih dari daftar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={book?.name || ''}
          disabled={disabled}
          onChange={(e) => {
            const b = BIBLE_BOOKS.find((x) => x.name === e.target.value) || null;
            setBook(b);
            setChapter(1);
            setVStart('');
            setVEnd('');
            emit(b, 1, '', '');
          }}
          className={inputCls}
        >
          <option value="">Pilih kitab…</option>
          {BIBLE_BOOKS.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>
        <select
          value={String(chapter)}
          disabled={disabled || !book}
          onChange={(e) => {
            const c = Number(e.target.value);
            setChapter(c);
            emit(book, c, vStart, vEnd);
          }}
          className={inputCls}
        >
          {Array.from({ length: book?.chapters || 0 }, (_, i) => (
            <option key={i + 1} value={i + 1}>Pasal {i + 1}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="number"
          min={1}
          placeholder="Ayat (dari)"
          disabled={disabled || !book}
          value={vStart}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : Number(e.target.value);
            setVStart(v);
            emit(book, chapter, v, vEnd);
          }}
          className={inputCls}
        />
        <input
          type="number"
          min={1}
          placeholder="Ayat (sampai, opsional)"
          disabled={disabled || !book}
          value={vEnd}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : Number(e.target.value);
            setVEnd(v);
            emit(book, chapter, vStart, v);
          }}
          className={inputCls}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8C8880]">{value ? `Referensi: ${value}` : 'Belum dipilih'}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setManual(true)}
          className="text-[10px] font-bold text-sky-700"
        >
          Ketik manual
        </button>
      </div>
    </div>
  );
};
