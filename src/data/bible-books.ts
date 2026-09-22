/** 66 kitab Alkitab (nama & singkatan gaya TB2) + jumlah pasal. */
export type BibleBook = { name: string; abbr: string; chapters: number };

export const BIBLE_BOOKS: BibleBook[] = [
  { name: 'Kejadian', abbr: 'Kej', chapters: 50 },
  { name: 'Keluaran', abbr: 'Kel', chapters: 40 },
  { name: 'Imamat', abbr: 'Im', chapters: 27 },
  { name: 'Bilangan', abbr: 'Bil', chapters: 36 },
  { name: 'Ulangan', abbr: 'Ul', chapters: 34 },
  { name: 'Yosua', abbr: 'Yos', chapters: 24 },
  { name: 'Hakim-hakim', abbr: 'Hak', chapters: 21 },
  { name: 'Rut', abbr: 'Rut', chapters: 4 },
  { name: '1 Samuel', abbr: '1Sam', chapters: 31 },
  { name: '2 Samuel', abbr: '2Sam', chapters: 24 },
  { name: '1 Raja-raja', abbr: '1Raj', chapters: 22 },
  { name: '2 Raja-raja', abbr: '2Raj', chapters: 25 },
  { name: '1 Tawarikh', abbr: '1Taw', chapters: 29 },
  { name: '2 Tawarikh', abbr: '2Taw', chapters: 36 },
  { name: 'Ezra', abbr: 'Ezr', chapters: 10 },
  { name: 'Nehemia', abbr: 'Neh', chapters: 13 },
  { name: 'Ester', abbr: 'Est', chapters: 10 },
  { name: 'Ayub', abbr: 'Ayb', chapters: 42 },
  { name: 'Mazmur', abbr: 'Mzm', chapters: 150 },
  { name: 'Amsal', abbr: 'Ams', chapters: 31 },
  { name: 'Pengkhotbah', abbr: 'Pkh', chapters: 12 },
  { name: 'Kidung Agung', abbr: 'Kid', chapters: 8 },
  { name: 'Yesaya', abbr: 'Yes', chapters: 66 },
  { name: 'Yeremia', abbr: 'Yer', chapters: 52 },
  { name: 'Ratapan', abbr: 'Rat', chapters: 5 },
  { name: 'Yehezkiel', abbr: 'Yeh', chapters: 48 },
  { name: 'Daniel', abbr: 'Dan', chapters: 12 },
  { name: 'Hosea', abbr: 'Hos', chapters: 14 },
  { name: 'Yoel', abbr: 'Yl', chapters: 3 },
  { name: 'Amos', abbr: 'Am', chapters: 9 },
  { name: 'Obaja', abbr: 'Ob', chapters: 1 },
  { name: 'Yunus', abbr: 'Yun', chapters: 4 },
  { name: 'Mikha', abbr: 'Mi', chapters: 7 },
  { name: 'Nahum', abbr: 'Nah', chapters: 3 },
  { name: 'Habakuk', abbr: 'Hab', chapters: 3 },
  { name: 'Zefanya', abbr: 'Zef', chapters: 3 },
  { name: 'Hagai', abbr: 'Hag', chapters: 2 },
  { name: 'Zakharia', abbr: 'Za', chapters: 14 },
  { name: 'Maleakhi', abbr: 'Mal', chapters: 4 },
  { name: 'Matius', abbr: 'Mat', chapters: 28 },
  { name: 'Markus', abbr: 'Mrk', chapters: 16 },
  { name: 'Lukas', abbr: 'Luk', chapters: 24 },
  { name: 'Yohanes', abbr: 'Yoh', chapters: 21 },
  { name: 'Kisah Para Rasul', abbr: 'Kis', chapters: 28 },
  { name: 'Roma', abbr: 'Rm', chapters: 16 },
  { name: '1 Korintus', abbr: '1Kor', chapters: 16 },
  { name: '2 Korintus', abbr: '2Kor', chapters: 13 },
  { name: 'Galatia', abbr: 'Gal', chapters: 6 },
  { name: 'Efesus', abbr: 'Ef', chapters: 6 },
  { name: 'Filipi', abbr: 'Flp', chapters: 4 },
  { name: 'Kolose', abbr: 'Kol', chapters: 4 },
  { name: '1 Tesalonika', abbr: '1Tes', chapters: 5 },
  { name: '2 Tesalonika', abbr: '2Tes', chapters: 3 },
  { name: '1 Timotius', abbr: '1Tim', chapters: 6 },
  { name: '2 Timotius', abbr: '2Tim', chapters: 4 },
  { name: 'Titus', abbr: 'Tit', chapters: 3 },
  { name: 'Filemon', abbr: 'Flm', chapters: 1 },
  { name: 'Ibrani', abbr: 'Ibr', chapters: 13 },
  { name: 'Yakobus', abbr: 'Yak', chapters: 5 },
  { name: '1 Petrus', abbr: '1Ptr', chapters: 5 },
  { name: '2 Petrus', abbr: '2Ptr', chapters: 3 },
  { name: '1 Yohanes', abbr: '1Yoh', chapters: 5 },
  { name: '2 Yohanes', abbr: '2Yoh', chapters: 1 },
  { name: '3 Yohanes', abbr: '3Yoh', chapters: 1 },
  { name: 'Yudas', abbr: 'Yud', chapters: 1 },
  { name: 'Wahyu', abbr: 'Why', chapters: 22 },
];

const norm = (s: string) => String(s || '').toLowerCase().replace(/[.\s]/g, '');

export function findBook(label: string): BibleBook | undefined {
  const n = norm(label);
  return BIBLE_BOOKS.find((b) => norm(b.abbr) === n || norm(b.name) === n);
}

export type ParsedBibleRef = {
  book: BibleBook;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
};

/** Parse referensi gaya "2 Kor 3:7-11" / "Yohanes 3:16". */
export function parseBibleRef(ref: string): ParsedBibleRef | null {
  const s = String(ref || '').trim();
  const m = s.match(/^(.+?)\s+(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) return null;
  return {
    book,
    chapter,
    verseStart: m[3] ? Number(m[3]) : null,
    verseEnd: m[4] ? Number(m[4]) : null,
  };
}

/** Bangun string referensi dari komponen. */
export function formatBibleRef(book: BibleBook, chapter: number, verseStart?: number | null, verseEnd?: number | null): string {
  let out = `${book.abbr} ${chapter}`;
  if (verseStart) {
    out += `:${verseStart}`;
    if (verseEnd && verseEnd !== verseStart) out += `-${verseEnd}`;
  }
  return out;
}
