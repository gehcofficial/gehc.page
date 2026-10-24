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
    title: 'Panduan FGD (tepat 3)',
    hint: 'Q1 observasi + analogi konkret Beyonders → Q2 interpretasi dari Bedah Teologis → Q3 aplikasi nyata. Tiap Q 1-2 kalimat + 1 ilustrasi (kuliah/kerja/kos/relasi).',
    fields: [
      t('fgd-observe', 'Q1 Observasi + analogi', 'textarea', 'Apa kata teks ...? + analogi: seperti ...'),
      t('fgd-interpret', 'Q2 Interpretasi', 'textarea', 'Apa artinya dalam tema ...? Kaitkan Bedah Teologis.'),
      t('fgd-apply', 'Q3 Aplikasi', 'textarea', 'Langkah nyata minggu ini ...? Konkret dan terukur.'),
    ],
  },
  {
    key: 'song',
    title: 'Lagu bedah pekan ini',
    hint: 'Pilih dari himne KJ/NKB/NNBT + kisah di balik lagu + makna tiap bait. Tampil di web, layar, dan PDF.',
    fields: [
      t('song-title', 'Judul lagu', 'text', 'Judul lagu ...'),
      t('song-book-ref', 'Nomor buku (KJ/NKB/NNBT)', 'text', 'mis. KJ 10 / NKB 5 / NNBT 17'),
      t('song-writer', 'Pencipta', 'text', 'Nama pencipta (kosongkan bila tak tahu)'),
      t('song-story', 'Kisah di balik lagu', 'textarea', 'Sejarah lagu + kaitan ke firman pekan ...'),
      t('song-about', 'Tentang apa (makna tiap bait)', 'textarea', 'Bait 1 berarti ...; bait 2 ...'),
      t('song-id', 'ID pustaka (opsional)', 'text', 'Otomatis terisi bila dipilih dari pustaka'),
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
  {
    key: 'lesson',
    title: 'Chip Lesson Learned (maks 10)',
    hint: 'Kata pelajaran 1-2 kata dari firman pekan (format #Kata, maks 3 dipilih per peserta). Tampil sebagai pilihan + word cloud di layar.',
    fields: Array.from({ length: 10 }, (_, i) => t(`lesson-chip-${i + 1}`, `Chip ${i + 1}`, 'text', '#KataKunci')),
  },
];

const DEBAT_TEMPLATE: DraftSection[] = [
  {
    key: 'aturan',
    title: 'Aturan main & logistik hari-H',
    hint: '5 ronde × 20 menit. Delegasi 3 orang/tim (1 Mentor + 2 Mentee). HP/AI hanya saat Brainstorming 4′ — sisanya karantina HP.',
    fields: [
      t('debat-rules', 'Aturan & alur ronde', 'textarea', '5 ronde × 20 menit; tiap ronde 11 langkah (Reveal → Brainstorming → Paparan → 2× Sanggahan → Final Blow → Jeda). Karantina HP; AI hanya saat Brainstorming.'),
      t('debat-quarantine', 'Aturan karantina & penalti', 'textarea', 'HP dikumpulkan saat Reveal dan dikembalikan saat Brainstorming; penalti bila melanggar.'),
    ],
  },
  {
    key: 'mosi',
    title: 'Mosi (3–5, dikotomi palsu)',
    hint: 'Rumus: "A yang baik vs B yang baik" dari pergumulan tema. Tiap mosi untuk 1 ronde.',
    fields: [1, 2, 3, 4, 5].map((n) => t(`mosi-${n}`, `Mosi ${n}`, 'textarea', '... yang baik vs ... yang baik')),
  },
  {
    key: 'teams',
    title: 'Tim PRO & KONTRA (undian H-1)',
    hint: 'Delegasi 3 orang/tim: 1 Mentor + 2 Mentee. Sisi ditentukan undian H-1 (acak, tanpa ulang).',
    fields: [
      t('pro-name', 'Nama tim PRO', 'text', 'mis. Tim Api'),
      t('pro-mentor', 'Mentor PRO', 'text', 'Nama mentor'),
      t('pro-members', 'Anggota PRO (2 Mentee)', 'text', 'Nama1, Nama2'),
      t('kontra-name', 'Nama tim KONTRA', 'text', 'mis. Tim Angin'),
      t('kontra-mentor', 'Mentor KONTRA', 'text', 'Nama mentor'),
      t('kontra-members', 'Anggota KONTRA (2 Mentee)', 'text', 'Nama1, Nama2'),
    ],
  },
  {
    key: 'juri',
    title: 'Juri & kriteria penilaian',
    hint: '4 kriteria berbobot: argumen biblika 40 · logika 30 · teamwork 20 · etika 10 (total 100/juri). Isi nama juri (1–3 orang).',
    fields: [
      t('juri-1', 'Juri 1', 'text', 'Nama juri 1'),
      t('juri-2', 'Juri 2', 'text', 'Nama juri 2'),
      t('juri-3', 'Juri 3', 'text', 'Nama juri 3'),
    ],
  },
  {
    key: 'trap',
    title: 'Trap Reveal (konklusi)',
    hint: '1 paragraf: kedua sisi runtuh di hadapan firman pekan (membongkar dikotomi palsu). 20 menit penutup.',
    fields: [t('trap-reveal', 'Naskah Trap Reveal', 'textarea', 'Setiap mosi tadi adalah dikotomi palsu ...')],
  },
];

const BEDAH_FILM_TEMPLATE: DraftSection[] = [
  {
    key: 'film',
    title: 'Film & ayat',
    hint: 'Film 60–95 menit yang isu sentralnya = tema pekan (total = 80 + durasi film).',
    fields: [
      t('film-title', 'Judul film', 'text', 'Judul (durasi menit)'),
      t('film-alt', 'Kandidat lain + alasan pilih', 'textarea', '2 kandidat + alasan kecocokan tiap film'),
      t('film-scenes', '3 adegan paralel firman', 'textarea', 'Adegan 1/2/3 + kaitan ayat'),
      t('pleno-prompt', 'Pancingan cadangan', 'textarea', 'Karakter siapa yang paling ...?'),
    ],
  },
  {
    key: 'likert-film',
    title: 'Likert film (5 pernyataan, dipakai awal + akhir)',
    hint: 'Tulis 5 pernyataan skala 1–5 seputar film/tema (baseline, tanpa jawaban benar/salah). Teks yang sama dipakai di ronde AWAL dan AKHIR.',
    fields: [1, 2, 3, 4, 5].map((n) => t(`likert-film-${n}`, `Pernyataan ${n}`, 'textarea', 'Saya ...')),
  },
  {
    key: 'deep',
    title: 'Catatan selama film (3 pertanyaan wajib)',
    hint: 'Q1 masa lalu, Q2 masa kini, Q3 langkah otentik. Dijawab di HP selama film + afirmasi firman per jawaban.',
    fields: [
      t('film-q1', 'Pertanyaan 1 — akting suci', 'textarea', 'Kapan terakhir ...?'),
      t('film-q2', 'Pertanyaan 2 — topeng terberat', 'textarea', 'Topeng apa ...?'),
      t('film-q3', 'Pertanyaan 3 — langkah otentik', 'textarea', 'Langkah otentik minggu ini ...?'),
    ],
  },
  {
    key: 'affirm',
    title: 'Afirmasi firman (tampil setelah peserta menjawab)',
    hint: '1 afirmasi per Q catatan + 2 varian Likert (skor rendah/tinggi). Tampil otomatis di HP peserta.',
    fields: [
      t('affirm-q1', 'Afirmasi Q1', 'textarea', 'Kejujuranmu dilihat Tuhan ... (1Kor 15:3)'),
      t('affirm-q2', 'Afirmasi Q2', 'textarea', 'Bukti itu menguatkanmu ... (1Kor 15:5-8)'),
      t('affirm-q3', 'Afirmasi Q3', 'textarea', 'Langkah kecilmu berarti ... (Kis 4:19-20)'),
      t('affirm-likert-low', 'Afirmasi Likert (rata-rata ≤ 3)', 'textarea', 'Meragukan itu manusiawi — Tomas pun ... (Yoh 20:27)'),
      t('affirm-likert-high', 'Afirmasi Likert (rata-rata > 3)', 'textarea', 'Imanmu bertumbuh — jadilah saksi ... (1Kor 15:58)'),
    ],
  },
  {
    key: 'lesson',
    title: 'Chip Lesson Learned (maks 10)',
    hint: 'Kata pelajaran 1-2 kata dari firman pekan (format #Kata, maks 3 dipilih per peserta). Tampil sebagai pilihan + word cloud di layar.',
    fields: Array.from({ length: 10 }, (_, i) => t(`lesson-chip-${i + 1}`, `Chip ${i + 1}`, 'text', '#KataKunci')),
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

const CREATIVE_LAB_ACTIVITY_SLOTS = 4;

function creativeLabActivitySection(n: number): DraftSection {
  const p = `a${n}`;
  const jarItemFields: DraftField[] = [];
  if (n === 1) {
    for (let i = 1; i <= 6; i += 1) {
      jarItemFields.push(
        t(`${p}-item-${i}-judul`, `Kartu ${i} — judul`, 'text', 'Judul kartu (English boleh)'),
        t(`${p}-item-${i}-konteks`, `Kartu ${i} — konteks`, 'textarea', 'Arahan singkat untuk peserta …'),
        t(`${p}-item-${i}-pertanyaan`, `Kartu ${i} — pertanyaan`, 'textarea', 'Pertanyaan refleksi …'),
        t(`${p}-item-${i}-contoh`, `Kartu ${i} — contoh (opsional)`, 'textarea', 'Contoh jawaban …'),
        t(`${p}-item-${i}-ai`, `Kartu ${i} — diisi AI (1/true)`, 'text', ''),
      );
    }
  }
  const advancedItemFields: DraftField[] = [];
  if (n >= 3) {
    for (let i = 1; i <= 6; i += 1) {
      advancedItemFields.push(
        t(`${p}-item-${i}-judul`, `Item ${i} — judul`, 'text', 'Judul stasiun / karya'),
        t(`${p}-item-${i}-konteks`, `Item ${i} — konteks`, 'textarea', 'Arahan singkat untuk peserta …'),
        t(`${p}-item-${i}-pertanyaan`, `Item ${i} — pertanyaan`, 'textarea', 'Pertanyaan refleksi …'),
        t(`${p}-item-${i}-contoh`, `Item ${i} — contoh (opsional)`, 'textarea', 'Contoh jawaban …'),
        t(`${p}-item-${i}-ai`, `Item ${i} — diisi AI (1/true)`, 'text', ''),
      );
    }
  }
  const artStationFields: DraftField[] = n === 2
    ? [
      t('a2-station-media', 'Stasiun A — nama media', 'text', 'Pot'),
      t('a2-station-theme', 'Stasiun A — judul tema', 'text', ''),
      t('a2-pot-meaning', 'Stasiun A — makna (layar)', 'textarea', ''),
      t('a2-pot', 'Stasiun A — arahan / refleksi', 'textarea', ''),
      t('a2-b-media', 'Stasiun B — nama media', 'text', 'Bag'),
      t('a2-b-theme', 'Stasiun B — judul tema', 'text', ''),
      t('a2-bag-meaning', 'Stasiun B — makna (layar)', 'textarea', ''),
      t('a2-bag', 'Stasiun B — arahan / refleksi', 'textarea', ''),
    ]
    : [];
  const extraStationFields: DraftField[] = n >= 3
    ? [
      t(`${p}-station-media`, 'Nama media / stasiun', 'text', ''),
      t(`${p}-station-theme`, 'Judul tema stasiun', 'text', ''),
    ]
    : [];
  const titleDefault = n === 1 ? 'Reminder Jar' : n === 2 ? 'Art Station' : `Aktivitas ${n}`;
  const sectionTitle = n === 1 ? 'Aktivitas 1 · Reminder Jar' : n === 2 ? 'Aktivitas 2 · Art Station' : `Aktivitas ${n} (lanjutan)`;
  const hint = n === 1
    ? 'Sesi kertas + web: 6 kartu di layar; tiap orang tulis di kertas, pilih 2 untuk diisi digital. Wajib judul aktivitas + menit.'
    : n === 2
      ? 'Dua stasiun paralel (label media bebas, mis. Pot/Bag) + slide Commitment saat presentasi. Field bertanda diisi AI harus direview sebelum terbit.'
      : 'Opsi lanjutan: aktivitas seni tambahan (satu slide presentasi per aktivitas). Field bertanda diisi AI harus direview sebelum terbit.';
  return {
    key: `activity-${n}`,
    title: sectionTitle,
    hint,
    fields: [
      t(`${p}-title`, 'Judul aktivitas *', 'text', titleDefault),
      t(`${p}-minutes`, 'Durasi (menit) *', 'number', n === 1 ? '15' : '25'),
      t(`${p}-konteks`, 'Konteks / tujuan', 'textarea', ''),
      ...(n >= 3 ? [
        t(`${p}-pertanyaan`, 'Pertanyaan / langkah', 'textarea', ''),
        t(`${p}-contoh`, 'Contoh (opsional)', 'textarea', ''),
      ] : []),
      ...artStationFields,
      ...extraStationFields,
      ...jarItemFields,
      ...advancedItemFields,
    ],
  };
}

/** Sembunyikan aktivitas di atas `activity-count` (data tetap tersimpan). */
export function visibleCreativeLabDraftSections(
  sections: DraftSection[],
  showHiddenActivities: boolean,
): { visible: DraftSection[]; hiddenCount: number; activityCount: number } {
  const raw = Number(String(sections.find((s) => s.key === 'meta')?.fields.find((f) => f.key === 'activity-count')?.value || '2').replace(/[^\d]/g, ''));
  const activityCount = Number.isFinite(raw) && raw >= 1 && raw <= CREATIVE_LAB_ACTIVITY_SLOTS ? raw : 2;
  let hiddenCount = 0;
  const visible = sections.filter((s) => {
    const m = /^activity-(\d+)$/.exec(s.key);
    if (!m) return true;
    const n = Number(m[1]);
    if (n <= activityCount) return true;
    hiddenCount += 1;
    return showHiddenActivities;
  });
  return { visible, hiddenCount, activityCount };
}

/** Template bebas Creative Lab — liturgi tetap di rundown; blok aktivitas fleksibel. */
function creativeLabTemplate(): DraftSection[] {
  return [
    {
      key: 'meta',
      title: 'Meta draft',
      hint: 'Jumlah aktivitas yang dipakai (1–4). Validasi total menit vs slot jemaat 140 menit dilakukan saat terbit.',
      fields: [t('activity-count', 'Jumlah aktivitas', 'number', '2')],
    },
    {
      key: 'firman',
      title: 'Firman',
      hint: 'Wajib diisi: judul firman. Poin tema opsional (layar 10 menit pertama briefing).',
      fields: [
        t('firman-judul', 'Judul firman *', 'text', 'Fundamental Firman pekan ini …'),
        t('firman-poin', 'Poin tema (opsional, layar)', 'textarea', '3 poin singkat …'),
      ],
    },
    {
      key: 'briefing',
      title: 'Firman & Briefing (15 menit)',
      hint: 'Menit 1–10: layar hanya judul firman (+ poin). Menit 11–15: panggil perwakilan. Undian urutan dilakukan sebelum briefing (kontrol).',
      fields: [
        t('brief-core', 'Inti khotbah (opsional)', 'textarea', 'Catatan pembicara …'),
        t('brief-rules', 'Aturan main', 'textarea', ''),
        t('brief-scribe', 'Panggilan perwakilan (menit 11–15)', 'textarea', 'Kirim satu perwakilan tiap kelompok ke depan.'),
        t('brief-draw', 'Pengumuman undian', 'textarea', 'Urutan presentasi mengikuti nomor grup di layar.'),
        t('brief-audience-directive', 'Kalimat arahan · HP peserta', 'text', 'Ikuti layar; tulis di kertas saat diminta.'),
        t('brief-projector-directive', 'Kalimat arahan · proyektor', 'text', 'Tampilkan timer, nomor grup, dan progres kelompok.'),
      ],
    },
    ...Array.from({ length: CREATIVE_LAB_ACTIVITY_SLOTS }, (_, i) => creativeLabActivitySection(i + 1)),
    {
      key: 'present',
      title: 'Presentasi Kelompok',
      hint: 'Satu slide per aktivitas seni + slide Commitment. Reaksi penonton: Suka / Biasa / Kurang (dirilis di akhir).',
      fields: [
        t('present-order', 'Urutan & aturan presentasi', 'textarea', ''),
        t('present-questions', 'Pertanyaan apresiasi', 'textarea', ''),
        t('present-seconds', 'Detik per kelompok', 'number', '150'),
      ],
    },
    {
      key: 'closing',
      title: 'Konklusi & komitmen',
      hint: 'Konklusi firman + komitmen kelompok (liturgi penutup mengikuti rundown baku).',
      fields: [
        t('closing-script', 'Naskah konklusi', 'textarea', ''),
        t('closing-commit', 'Komitmen kelompok', 'textarea', ''),
        t('closing-prayer', 'Doa penutup', 'textarea', ''),
      ],
    },
  ];
}

export const SESSION_DRAFT_CODES = ['MONOLOG', 'POST_TO_POST', 'DEBAT', 'BEDAH_FILM', 'THREE_SEQUENCES', 'CREATIVE_LAB'] as const;

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
    case 'CREATIVE_LAB':
      return structuredClone(creativeLabTemplate());
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

const LEGACY_ACTIVITY_TITLES: Record<string, Set<string>> = {
  'a1-title': new Set(['the roots reminder jar', 'roots reminder jar', 'reminder jar']),
  'a2-title': new Set(['roots & dna creative lab', 'roots and dna creative lab', 'art stations']),
};
const DRAFT_DEFAULT_WHEN_ABSENT = new Set<string>();

export function storedToSections(patternCode: string | null | undefined, stored?: StoredDraft | null): DraftSection[] {
  const tpl = emptySessionDraft(patternCode);
  if (!stored) return tpl;
  return tpl.map((s) => ({
    ...s,
    fields: s.fields.map((f) => {
      const raw = stored[s.key]?.[f.key];
      if (raw == null && DRAFT_DEFAULT_WHEN_ABSENT.has(f.key)) return { ...f, value: f.value };
      let value = raw ?? '';
      const legacy = LEGACY_ACTIVITY_TITLES[f.key];
      if (legacy?.has(String(value).trim().toLowerCase())) value = f.value;
      return { ...f, value };
    }),
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

/**
 * Siklus ideal mingguan: kontrol hari-H mengikuti hanya SETELAH draft terisi.
 * True bila config.draft ada field terisi, atau sudah ada soal/chip hasil
 * Terapkan (kasus non-POST yang menulis chip lesson).
 */
export function sessionHasDraftContent(detail: {
  config?: Record<string, unknown> | null;
  likertItems?: Array<unknown> | null;
  chips?: Array<unknown> | null;
} | null | undefined): boolean {
  if (!detail) return false;
  if ((detail.likertItems || []).length > 0 || (detail.chips || []).length > 0) return true;
  const draft = detail.config?.draft;
  if (!draft || typeof draft !== 'object') return false;
  return Object.values(draft as Record<string, unknown>).some(
    (sec) => sec && typeof sec === 'object' && Object.values(sec as Record<string, unknown>).some((v) => String(v ?? '').trim()),
  );
}

/** Kunci field template agar prompt AI tahu slot yang harus diisi (pola non-Post-to-Post). */
export function templateFieldKeys(patternCode?: string | null): { section: string; key: string; label: string }[] {
  return emptySessionDraft(patternCode).flatMap((s) =>
    s.fields.map((f) => ({ section: s.key, key: f.key, label: f.label })),
  );
}
