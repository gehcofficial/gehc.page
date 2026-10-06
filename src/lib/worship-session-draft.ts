/**
 * Draft Sesi Hari-H per pola ibadah (Didaskalia).
 *
 * Model: tiap pola punya daftar section kosongan (form). Nilai tersimpan di
 * `session.config.draft` (JSON, tanpa migrasi skema). AI mengusulkan nilai
 * per field; tim me-review per section lalu menyimpan/menerapkan.
 * Guard: sesi yang sudah berjalan/terisi tidak boleh ditimpa otomatis.
 */

export type DraftFieldKind = 'text' | 'textarea' | 'number';

export type DraftField = {
  key: string;
  label: string;
  kind: DraftFieldKind;
  placeholder?: string;
  value: string;
};

export type DraftSection = {
  key: string;
  title: string;
  hint: string;
  fields: DraftField[];
};

const t = (key: string, label: string, kind: DraftFieldKind = 'textarea', placeholder = ''): DraftField => ({
  key,
  label,
  kind,
  placeholder,
  value: '',
});

function likertSection(topicCode: string, topicLabel: string): DraftSection {
  return {
    key: `likert-${topicCode}`,
    title: `Likert — ${topicLabel}`,
    hint: '3 pernyataan skala 1–5 + catatan Injil (solusi dari firman pekan).',
    fields: [1, 2, 3].flatMap((n) => [
      t(`item-${topicCode}-${n}`, `Pernyataan ${n}`, 'textarea', 'Saya merasa ...'),
      t(`note-${topicCode}-${n}`, `Catatan Injil ${n}`, 'text', 'Solusi dari firman: ...'),
    ]),
  };
}

function postToPostTemplate(): DraftSection[] {
  return [
    {
      key: 'topics',
      title: 'Topik & PIC pos',
      hint: '3 pos. Label + penanggung jawab tiap pos.',
      fields: [
        t('topic-HUBUNGAN-label', 'Topik 1 — label', 'text', 'Hubungan (Romansa & Pertemanan)'),
        t('topic-HUBUNGAN-pic', 'Topik 1 — PIC', 'text', 'Nama PIC pos'),
        t('topic-PEKERJAAN-label', 'Topik 2 — label', 'text', 'Pekerjaan & Perkuliahan'),
        t('topic-PEKERJAAN-pic', 'Topik 2 — PIC', 'text', 'Nama PIC pos'),
        t('topic-KELUARGA-label', 'Topik 3 — label', 'text', 'Keluarga'),
        t('topic-KELUARGA-pic', 'Topik 3 — PIC', 'text', 'Nama PIC pos'),
      ],
    },
    likertSection('HUBUNGAN', 'Topik 1'),
    likertSection('PEKERJAAN', 'Topik 2'),
    likertSection('KELUARGA', 'Topik 3'),
    {
      key: 'chips',
      title: 'Chip words (maks 12)',
      hint: 'Kata pelajaran (maks 3 dipilih per peserta). Format: #Kata.',
      fields: Array.from({ length: 12 }, (_, i) => t(`chip-${i + 1}`, `Chip ${i + 1}`, 'text', '#KataKunci')),
    },
    {
      key: 'affirmations',
      title: 'Afirmasi per topik',
      hint: '3 kalimat peneguh per topik, dari firman pekan.',
      fields: (['HUBUNGAN', 'PEKERJAAN', 'KELUARGA'] as const).flatMap((tc) =>
        [1, 2, 3].map((n) => t(`affirm-${tc}-${n}`, `Afirmasi ${tc} ${n}`, 'text', 'Kamu ...')),
      ),
    },
    {
      key: 'timer',
      title: 'Timer sesi',
      hint: 'Durasi Post-to-Post dalam detik (default 1200 = 20 menit).',
      fields: [t('timerSeconds', 'Durasi (detik)', 'number', '1200')],
    },
  ];
}

const MONOLOG_TEMPLATE: DraftSection[] = [
  {
    key: 'fgd',
    title: 'Panduan FGD',
    hint: '3 pertanyaan: observasi → interpretasi → aplikasi, dari firman pekan.',
    fields: [
      t('fgd-observe', 'Observasi', 'textarea', 'Apa kata teks ...?'),
      t('fgd-interpret', 'Interpretasi', 'textarea', 'Apa artinya dalam tema ...?'),
      t('fgd-apply', 'Aplikasi', 'textarea', 'Langkah nyata minggu ini ...?'),
    ],
  },
  {
    key: 'song',
    title: 'Lagu bedah pekan ini',
    hint: 'Judul + makna tiap bait + penyanyi. Tampil di web, layar, dan PDF.',
    fields: [
      t('song-title', 'Judul lagu', 'text', 'Judul lagu ...'),
      t('song-about', 'Tentang apa (makna tiap bait)', 'textarea', 'Bait 1 berarti ...; bait 2 ...'),
      t('song-singer', 'Penyanyi', 'text', 'Nama penyanyi ...'),
    ],
  },
  {
    key: 'deep',
    title: 'Deep sharing (2 pertanyaan wajib)',
    hint: 'Q1 observasi teks, Q2 langkah pulang. Dibuka berurutan oleh pemicu.',
    fields: [
      t('deep-q1', 'Pertanyaan 1', 'textarea', 'Di mana kamu melihat dirimu ...?'),
      t('deep-q2', 'Pertanyaan 2', 'textarea', 'Langkah pulang minggu ini ...?'),
    ],
  },
];

const DEBAT_TEMPLATE: DraftSection[] = [
  {
    key: 'mosi',
    title: 'Mosi (3–5, dikotomi palsu)',
    hint: 'Rumus: "A yang baik vs B yang baik" dari pergumulan tema.',
    fields: [1, 2, 3, 4, 5].map((n) => t(`mosi-${n}`, `Mosi ${n}`, 'textarea', '... vs ...')),
  },
  {
    key: 'trap',
    title: 'Trap Reveal (konklusi)',
    hint: '1 paragraf: kedua sisi runtuh di hadapan firman pekan.',
    fields: [t('trap-reveal', 'Naskah Trap Reveal', 'textarea', 'Setiap mosi tadi adalah dikotomi palsu ...')],
  },
];

const BEDAH_FILM_TEMPLATE: DraftSection[] = [
  {
    key: 'film',
    title: 'Film & ayat',
    hint: 'Film 60–95 menit yang isu sentralnya = tema pekan.',
    fields: [
      t('film-title', 'Judul film', 'text', 'Judul (durasi menit)'),
      t('film-alt', 'Kandidat lain + alasan pilih', 'textarea', '2 kandidat + alasan kecocokan tiap film'),
      t('film-scenes', '3 adegan paralel firman', 'textarea', 'Adegan 1/2/3 + kaitan ayat'),
      t('pleno-prompt', 'Pancingan pleno', 'textarea', 'Karakter siapa yang paling ...?'),
    ],
  },
  {
    key: 'deep',
    title: 'Deep sharing (3 pertanyaan wajib)',
    hint: 'Q1 masa lalu, Q2 masa kini, Q3 langkah otentik.',
    fields: [
      t('film-q1', 'Pertanyaan 1 — akting suci', 'textarea', 'Kapan terakhir ...?'),
      t('film-q2', 'Pertanyaan 2 — topeng terberat', 'textarea', 'Topeng apa ...?'),
      t('film-q3', 'Pertanyaan 3 — langkah otentik', 'textarea', 'Langkah otentik minggu ini ...?'),
    ],
  },
];

const THREE_SEQUENCES_TEMPLATE: DraftSection[] = [
  {
    key: 'yel',
    title: 'Yel-yel & sandi',
    hint: 'Yel-yel memuat 1 kata tema + 1 frasa firman; sandi dari nomor ayat.',
    fields: [
      t('yel', 'Contoh yel-yel misi', 'text', '...'),
      t('cipher', 'Sandi Kode Alkitab', 'text', 'Contoh: nomor ayat jadi kode angka'),
    ],
  },
  {
    key: 'cases',
    title: 'Amplop studi kasus (2)',
    hint: 'Kasus nyata Beyonders seputar tema + 2 pertanyaan + ayat penuntun.',
    fields: [1, 2].flatMap((n) => [
      t(`case-${n}-title`, `Amplop ${n} — judul`, 'text', 'Kasus ...'),
      t(`case-${n}-body`, `Amplop ${n} — isi + pertanyaan`, 'textarea', '1 paragraf kasus + 2 pertanyaan'),
    ]),
  },
];

export const SESSION_DRAFT_CODES = ['MONOLOG', 'POST_TO_POST', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES'] as const;

/** Template kosongan per pola (tanpa nilai). */
export function emptySessionDraft(patternCode?: string | null): DraftSection[] {
  switch (String(patternCode || 'MONOLOG').toUpperCase()) {
    case 'POST_TO_POST':
      return postToPostTemplate();
    case 'DUAL_MONOLOG':
      // Pola lama yang diarsip — petakan ke template gabungan MONOLOG.
      return structuredClone(MONOLOG_TEMPLATE);
    case 'DEBAT':
      return structuredClone(DEBAT_TEMPLATE);
    case 'BEDAH_FILM':
      return structuredClone(BEDAH_FILM_TEMPLATE);
    case 'THREE_SEQUENCES':
      return structuredClone(THREE_SEQUENCES_TEMPLATE);
    default:
      return structuredClone(MONOLOG_TEMPLATE);
  }
}

function structuredClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Nilai draft tersimpan: { [sectionKey]: { [fieldKey]: string } }. */
export type StoredDraft = Record<string, Record<string, string>>;

export function draftToStored(sections: DraftSection[]): StoredDraft {
  const out: StoredDraft = {};
  for (const s of sections) {
    out[s.key] = {};
    for (const f of s.fields) out[s.key][f.key] = f.value || '';
  }
  return out;
}

export function storedToSections(patternCode: string | null | undefined, stored?: StoredDraft | null): DraftSection[] {
  const tpl = emptySessionDraft(patternCode);
  if (!stored) return tpl;
  return tpl.map((s) => ({
    ...s,
    fields: s.fields.map((f) => ({ ...f, value: stored[s.key]?.[f.key] ?? '' })),
  }));
}

/** Jumlah field terisi (untuk badge progres + deteksi kosongan). */
export function countFilled(sections: DraftSection[]): { filled: number; total: number } {
  const all = sections.flatMap((s) => s.fields);
  return { filled: all.filter((f) => String(f.value || '').trim()).length, total: all.length };
}

export type SessionLockInfo = {
  status: string;
  submittedCount: number;
  hasItems: boolean;
};

/**
 * Guard: sesi terkunci bila BUKAN DRAFT, sudah ada jawaban peserta,
 * atau sudah berisi soal (kasus 4 Okt) — AI-fill/penerapan otomatis dilarang.
 */
export function sessionDraftGuard(info: SessionLockInfo): { locked: boolean; reason: string } {
  if (String(info.status || '').toUpperCase() !== 'DRAFT') {
    return { locked: true, reason: `Sesi berstatus ${info.status} — hanya sesi DRAFT yang bisa diisi.` };
  }
  if (Number(info.submittedCount) > 0) {
    return { locked: true, reason: 'Sudah ada jawaban peserta — isi sesi dikunci.' };
  }
  if (info.hasItems) {
    return { locked: true, reason: 'Sesi sudah berisi soal — ubah manual via kontrol hari-H.' };
  }
  return { locked: false, reason: '' };
}

/** Kunci field template agar prompt AI tahu slot yang harus diisi (pola non-Post-to-Post). */
export function templateFieldKeys(patternCode?: string | null): { section: string; key: string; label: string }[] {
  return emptySessionDraft(patternCode).flatMap((s) =>
    s.fields.map((f) => ({ section: s.key, key: f.key, label: f.label })),
  );
}
