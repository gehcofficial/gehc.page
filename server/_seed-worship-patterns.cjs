/**
 * Seed katalog Pola Ibadah (Didaskalia) + sesi Mentoring Day 4 Okt 2026.
 * Idempotent: pola di-upsert per `code`; sesi dibuat sekali (per `slug`).
 *
 * Jalankan: npm run db:seed:worship[:staging|:prod]
 */
require('dotenv').config();
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const uid = (p) => `${p}-${crypto.randomUUID()}`;

const POST_TO_POST_PLAYBOOK = `# Post-to-Post (Mentoring Day)

**Tema:** More Than Good News — Injil mengubahkan realita keseharian.
**Bacaan:** 1 Korintus 15:3-4.
**Konsep:** Monolog singkat + Post-to-Post (jemaat berpindah pos sesuai kebutuhan).

## Pra-acara
1. Didaskalia menyiapkan 3 pertanyaan Likert per topik (Hubungan, Pekerjaan/Kuliah, Keluarga) di panel Pola Ibadah.
2. Jemaat mengisi Likert lewat web sebelum sesi dimulai (form di-unlock panitia).
3. Alokasi ruangan otomatis dari ranking kerentanan topik: rank 1 = Lantai 2 (terbesar), rank 2 = Lantai 1, rank 3 = Lantai 3.

## Rundown
1. Praise & Worship — 10' — Liturgia
2. Monolog — 15' — Main Speaker (Didaskalia): Injil bukan sekadar tiket ke surga, tetapi solusi praktis untuk pergumulan Hubungan, Pekerjaan, dan Keluarga.
3. Briefing aturan main — 2': total Post-to-Post hanya 20 menit; jemaat bebas mengatur mobilitas; jika concern terjawab dalam 5-6 menit, pindah pos.
4. Post-to-Post — 20' total: tiga pos berjalan serentak. PIC menjabarkan solusi teologis & praktis berdasarkan Likert; membuka Open/Follow-up Question; jemaat menulis Catatan Individu.
5. Wrap-up — jemaat kembali ke ruang utama; berbagi Lesson Learned (pilih Chip Words di web).

## Aturan PIC pos
- Fokus pada pertanyaan Likert yang sudah diisi jemaat (data tersedia di panel).
- Buka ruang tanya jawab; dorong jemaat mencatat.
- Jaga waktu: setiap pos harus melayani banyak orang dalam 20 menit.`;

const DUAL_MONOLOG_PLAYBOOK = `# Dual Monolog — The Awakening of Depravity

**Tema:** Realitas Keterpurukan Kita. **Bacaan:** Lukas 15:11-32. **Durasi:** 120'.

## Struktur
1. **Bagian 1 — The Outer Exile (Anak Bungsu Modern), menit 00:00-05:00.** Speaker B; pakaian kerja kusut, tas ransel, penat; low synth pad monoton. Monolog: rutinitas, KPI, lembur, kehilangan kehadiran Tuhan — "aku tersesat di luar sana".
2. **Bagian 2 — The Inner Exile (Anak Sulung Modern), menit 05:00-10:00.** Speaker A; rapi, memegang Alkitab/notebook; musik kaku/dingin. Monolog: sibuk pelayanan, spiritual exhaustion, kehilangan cinta mula-mula — "aku tersesat di dalam rumah Bapa sendiri".
3. **Bagian 3 — The Convergence & Pesan Teologis, menit 10:00-25:00.** Keduanya sejajar; piano warm block chords; **pembacaan berbalasan Lukas 15:11-32** (ayat 1 Speaker A — per kelompok — ayat terakhir Speaker B); elaborasi bergantian: solusinya "Pulang" — kasih Bapa tidak tergantung performa.

## Pendukung
- **Bedah Lagu** (10'): nyanyikan bait → bedah makna teologis → lanjut bait berikutnya ("agar jemaat menyanyi dengan kesadaran, bukan otomatisasi").
- **Deep Sharing** (40'): mentor membuka diri lebih dulu; game "Satu Kata untuk Minggu Ini"; 2 pertanyaan pendalaman wajib; zero judgment.`;

const DEBAT_PLAYBOOK = `# Debat — The Battle of Minds

**Tema:** Peperangan Pikiran. **Bacaan:** Ibrani 10:25. **Durasi:** 140'.

## Aturan emas (dibacakan Moderator)
1. **Delegasi 3 orang** per tim: 1 Mentor + 2 Mentee.
2. **Karantina HP (digital detox):** HP/AI hanya boleh saat 4 menit masa persiapan; setelah pemaparan dimulai, HP diletakkan; membaca dari HP = argumen tidak dinilai.
3. **Kekuasaan mutlak timer:** waktu layar adalah komandan; saat 00:00 + buzzer, mic diinterupsi Moderator; tanpa tambahan waktu.

## Format per ronde (20', 5 ronde)
| Slide | Isi | Timer | Eksekutor |
|---|---|---|---|
| 1 | The Reveal (mosi + Tim PRO vs KONTRA) | 01:00 | Moderator |
| 2 | Brainstorming & AI Strategy | 04:00 | 3 PRO & 3 KONTRA |
| 3 | Pemaparan Argumen PRO | 04:00 | Tim PRO |
| 4 | Pemaparan Argumen KONTRA | 04:00 | Tim KONTRA |
| 5 | Sanggahan Pertama — PRO | 01:00 | bebas PRO |
| 6 | Sanggahan Pertama — KONTRA | 01:00 | bebas KONTRA |
| 7 | Sanggahan Kedua — PRO (utamakan Mentee) | 01:00 | PRO |
| 8 | Sanggahan Kedua — KONTRA | 01:00 | KONTRA |
| 9 | Final Blow — Konklusi PRO | 01:00 | PRO |
| 10 | Final Blow — Konklusi KONTRA | 01:00 | KONTRA |
| 11 | Jeda & Transisi | 01:00 | Moderator |

## Mosi (dikotomi palsu)
1. Spiritualitas pribadi vs komunitas.
2. Karier melesat vs kehadiran fisik ibadah.
3. Ibadah online fokus vs hadir fisik terdistraksi.
4. Kesehatan mental vs ketaatan komunitas.
5. Cuti pelayanan demi pemulihan vs bertahan demi komitmen.

## Konklusi teologis (20')
Validasi → "The Trap Reveal" (semua mosi adalah *false dichotomy*) → teologi Ibrani 10:25 ("saling menasihati") → panggilan menghancurkan dikotomi palsu.`;

const BEDAH_FILM_PLAYBOOK = `# Bedah Film — Dropping the Filter

**Tema:** Syarat menjadi murid adalah otentik. **Bacaan:** 2 Raja-raja 2:1-15. **Durasi:** 145'.

## Rundown
1. Opening + Praise singkat + doa — 10'
2. Pengantar film + ayat 2 Raja-raja 2 — 5'
3. **Pemutaran film** *The Resurrection of Gavin Stone* — 91' (lampu redup)
4. Transisi emosional — 4' (musik piano/gitar, lampu dinyalakan separuh)
5. **Pleno analisa film** — 15' (2-3 perwakilan campuran Mentor/Mentee; pancingan: "Karakter siapa yang paling bikin kamu tertampar, dan kenapa?")
6. **Team discussion / deep sharing** — 25' (3 pertanyaan wajib: berakting suci; topeng terberat; aplikasi 2 Raja-raja 2)
7. Doa persembahan & kolekte — 5'
8. Konklusi teologis & doa berkat — 10'

## Catatan
- Istilah kunci: *fake holiness*, *Christianese*, api & Roh (bukan sekadar jubah Elia).
- Mentor memulai duluan; jangan potong tangisan; tutup dengan saling mendoakan.`;

const THREE_SEQUENCES_PLAYBOOK = `# The 3 Sequences — Grand Finale (Coram Deo Challenge)

**Tema:** Coram Deo: From 9-to-5 to An Altar. **Bacaan:** Matius 28:19-20. **Durasi:** 120'.

## Sequence 1 — Melayani (Snack & Merge), 10'
Tukar snack Rp5.000 + kenalan kilat (3'), brainstorming **Yel-Yel Misi** (7'), diteriakkan serentak. Target: pencairan kilat & penyatuan dua kelompok (8+8=16).

## Sequence 2 — Bersekutu (Kode Alkitab), 15'
Subteam 1 (11 orang, Lantai 2) memecahkan sandi → *pass message* berantai → "The Runner" lari ke Lantai 1 membisikkan ayat (1x sebut) → Subteam 2 (5 orang) menyusun puzzle → "The Validator" memvalidasi ke Main Speaker → benar = Amplop Studi Kasus + telepon rekan di Lantai 2 (penanda Sequence 3).

## Sequence 3 — Bersaksi (Mission Room, paralel), 30' (countdown di layar)
- Tim Soal (3): merumuskan 2-3 pertanyaan dari amplop studi kasus.
- Tim Eksekusi Lapangan (5): wawancara warga non-GEHC, kirim video via WA.
- Tim Narasi (3): narasi alkitabiah. Tim Presentasi (2): bahan pitching.
- Tim Editor (3): potong/sambung video (CapCut) dengan template cepat.

## Penutup
Presentasi hasil (20', maks 4'/tim) → khotbah penutup & persembahan (15') → **Commissioning & Declaration** (15'): penumpangan tangan + doa personal + deklarasi bersama.`;

const MONOLOG_PLAYBOOK = `# Monolog & FGD (Standar)

**Tema:** Khotbah monolog sentral + pendalaman kelompok. **Durasi:** 60–90'.

## Alur
1. Praise & Worship (10–15').
2. Monolog khotbah oleh Main Speaker (25–35'): eksposisi teks, aplikasi, panggilan.
3. Briefing FGD (3'): bagi kelompok, bagikan panduan diskusi.
4. FGD hari Minggu (30–40'): observasi → interpretasi → aplikasi, tutup komitmen & doa.
5. Persembahan & doa berkat (10').

## Catatan
Pola default bila pekan tidak memilih pola khusus. Cocok untuk tema doktrinal yang perlu penyampaian utuh sebelum diskusi.`;

const PATTERNS = [
  {
    code: 'MONOLOG',
    name: 'Monolog & FGD (Standar)',
    summary:
      'Pola default: khotbah monolog sentral + FGD kelompok (observasi → interpretasi → aplikasi).',
    defaultDurationMin: 90,
    modules: ['timer', 'notes'],
    phases: [
      { no: 1, title: 'Praise & Worship', minutes: 15, owner: 'Liturgia' },
      { no: 2, title: 'Monolog khotbah', minutes: 30, owner: 'Main Speaker (Didaskalia)' },
      { no: 3, title: 'Briefing FGD', minutes: 3, owner: 'Main Speaker' },
      { no: 4, title: 'FGD kelompok', minutes: 35, owner: 'Mentor' },
      { no: 5, title: 'Persembahan & doa berkat', minutes: 10, owner: 'Main Speaker' },
    ],
    playbook: MONOLOG_PLAYBOOK,
    sortOrder: 5,
  },
  {
    code: 'POST_TO_POST',
    name: 'Post-to-Post (Mentoring Day)',
    summary:
      'Monolog singkat + jemaat berpindah pos sesuai kebutuhan. Didukung modul web: Likert, alokasi ruang, timer, catatan, chip words, word cloud.',
    defaultDurationMin: 60,
    modules: ['likert', 'rooms', 'timer', 'notes', 'chips', 'wordcloud'],
    phases: [
      { no: 1, title: 'Praise & Worship', minutes: 10, owner: 'Liturgia' },
      { no: 2, title: 'Monolog', minutes: 15, owner: 'Main Speaker (Didaskalia)' },
      { no: 3, title: 'Briefing aturan main', minutes: 2, owner: 'Main Speaker' },
      { no: 4, title: 'Post-to-Post (3 pos serentak)', minutes: 20, owner: 'PIC pos' },
      { no: 5, title: 'Wrap-up & Lesson Learned', minutes: 10, owner: 'MC' },
    ],
    playbook: POST_TO_POST_PLAYBOOK,
    sortOrder: 10,
  },
  {
    code: 'DUAL_MONOLOG',
    name: 'Dual Monolog',
    summary: 'Drama monolog-dialogis 2 speaker (anak bungsu vs anak sulung) + bedah lagu + deep sharing.',
    defaultDurationMin: 120,
    modules: ['timer', 'notes'],
    phases: [
      { no: 1, title: 'Praise & Bedah Lagu', minutes: 25, owner: 'Main Speaker' },
      { no: 2, title: 'Dual Monolog + pembacaan berbalasan', minutes: 25, owner: 'Main Speaker' },
      { no: 3, title: 'Deep Sharing kelompok', minutes: 40, owner: 'Mentor' },
    ],
    playbook: DUAL_MONOLOG_PLAYBOOK,
    sortOrder: 20,
  },
  {
    code: 'DEBAT',
    name: 'Debat — The Battle of Minds',
    summary: '5 ronde × 20 menit, timer mutlak, karantina HP, konklusi teologis membongkar dikotomi palsu.',
    defaultDurationMin: 140,
    modules: ['rounds', 'timer', 'teams'],
    phases: [
      { no: 1, title: 'Opening & nyanyian singkat', minutes: 10, owner: 'Main Speaker' },
      { no: 2, title: '5 ronde debat', minutes: 100, owner: 'Moderator' },
      { no: 3, title: 'Persembahan & transisi musik', minutes: 10, owner: 'Main Speaker' },
      { no: 4, title: 'Konklusi teologis (Ibrani 10:25)', minutes: 20, owner: 'Main Speaker' },
    ],
    playbook: DEBAT_PLAYBOOK,
    sortOrder: 30,
  },
  {
    code: 'BEDAH_FILM',
    name: 'Bedah Film',
    summary: 'Pemutaran film + pleno analisa + deep sharing identitas & topeng.',
    defaultDurationMin: 145,
    modules: ['screening', 'timer', 'notes'],
    phases: [
      { no: 1, title: 'Opening + praise + pengantar', minutes: 15, owner: 'Main Speaker' },
      { no: 2, title: 'Pemutaran film', minutes: 91, owner: 'Multimedia' },
      { no: 3, title: 'Pleno analisa film', minutes: 15, owner: 'MC' },
      { no: 4, title: 'Team discussion / deep sharing', minutes: 25, owner: 'Mentor' },
      { no: 5, title: 'Persembahan + konklusi + doa berkat', minutes: 15, owner: 'Main Speaker' },
    ],
    playbook: BEDAH_FILM_PLAYBOOK,
    sortOrder: 40,
  },
  {
    code: 'THREE_SEQUENCES',
    name: 'The 3 Sequences (Grand Finale)',
    summary: 'Gamifikasi misi tanpa jeda: Melayani → Bersekutu → Bersaksi, ditutup Commissioning.',
    defaultDurationMin: 120,
    modules: ['teams', 'timer', 'notes'],
    phases: [
      { no: 1, title: 'Opening & praise', minutes: 10, owner: 'Main Speaker' },
      { no: 2, title: 'Sequence 1 — Snack & Merge', minutes: 10, owner: 'Main Speaker' },
      { no: 3, title: 'Sequence 2 — Kode Alkitab', minutes: 15, owner: 'Mentor' },
      { no: 4, title: 'Sequence 3 — Mission Room (paralel)', minutes: 30, owner: 'Tim' },
      { no: 5, title: 'Presentasi hasil', minutes: 20, owner: 'MC' },
      { no: 6, title: 'Khotbah penutup & persembahan', minutes: 15, owner: 'Main Speaker' },
      { no: 7, title: 'Commissioning & Declaration', minutes: 15, owner: 'Mentor' },
    ],
    playbook: THREE_SEQUENCES_PLAYBOOK,
    sortOrder: 50,
  },
];

const TOPICS = [
  { code: 'HUBUNGAN', label: 'Hubungan (Romansa & Pertemanan)', pic: 'Putri, Jere' },
  { code: 'PEKERJAAN', label: 'Pekerjaan & Perkuliahan', pic: 'Ka Dif, Ka Michel' },
  { code: 'KELUARGA', label: 'Keluarga', pic: 'Ka Ais, Theo' },
];

const ITEMS = [
  {
    topic: 'HUBUNGAN',
    order: 1,
    text: "Saya sering merasa harus memakai 'topeng' atau menyembunyikan kelemahan saya supaya bisa diterima, disukai, atau tidak ditinggalkan oleh pasangan maupun teman-teman circle saya.",
    note: 'Kita dikasihi Kristus apa adanya; tidak perlu mencari validasi manusia.',
  },
  {
    topic: 'HUBUNGAN',
    order: 2,
    text: 'Ketika disakiti atau dikhianati oleh teman atau pasangan, saya merasa sangat sulit untuk memaafkan dan move on sebelum mereka merasakan kerugian atau pembalasan yang setimpal.',
    note: 'Anugerah pengampunan Tuhan memampukan kita mengampuni orang lain.',
  },
  {
    topic: 'HUBUNGAN',
    order: 3,
    text: 'Saya cenderung menilai hubungan saya sehat hanya dari perasaan nyaman, tanpa pernah membawanya dalam doa dan komitmen untuk saling menumbuhkan iman.',
    note: 'Hubungan yang berpusat pada Kristus bertumbuh lewat komitmen, bukan sekadar rasa nyaman.',
  },
  {
    topic: 'PEKERJAAN',
    order: 1,
    text: 'Saya merasa harga diri dan nilai saya sebagai manusia sangat ditentukan oleh pencapaian saya (seperti IPK tinggi di kampus, pujian atasan, atau besarnya gaji di tempat kerja).',
    note: "Identitas ditentukan oleh karya Kristus, membebaskan kita dari 'hustle culture'.",
  },
  {
    topic: 'PEKERJAAN',
    order: 2,
    text: 'Di lingkungan kerja atau kampus yang keras, saya merasa wajar jika sesekali kita harus mengorbankan kejujuran (misal: menyontek, memanipulasi data, menjilat atasan) demi bisa survive atau sukses.',
    note: 'Bekerja sebagai hamba Tuhan menjadikan integritas lebih utama dari kesuksesan instan.',
  },
  {
    topic: 'PEKERJAAN',
    order: 3,
    text: 'Saya sulit memandang pekerjaan/kuliah saya sebagai ibadah — saya mengerjakannya sekadar untuk memenuhi tuntutan, bukan sebagai pelayanan kepada Tuhan.',
    note: 'Coram Deo: seluruh kerja adalah mezbah penyembahan.',
  },
  {
    topic: 'KELUARGA',
    order: 1,
    text: "Saya sering merasa sangat tertekan atau burnout karena merasa harus selalu berjuang memenuhi tuntutan dan ekspektasi keluarga/orang tua, agar saya dianggap 'anak kebanggaan'.",
    note: 'Kasih Bapa di surga tidak berbasis target pencapaian.',
  },
  {
    topic: 'KELUARGA',
    order: 2,
    text: 'Saya merasa sangat kesulitan untuk tetap menunjukkan kasih kepada anggota keluarga yang memiliki sifat toxic, sering mengecewakan, atau pernah menorehkan luka batin pada saya.',
    note: 'Kasih Agape memampukan kita mengasihi yang sulit dikasihi, karena kita pun telah lebih dulu diampuni.',
  },
  {
    topic: 'KELUARGA',
    order: 3,
    text: 'Saya lebih nyaman membagikan pergumulan saya kepada teman atau media sosial daripada kepada keluarga sendiri, sehingga keluarga menjadi tempat yang paling asing bagi saya.',
    note: 'Keluarga adalah komunitas iman pertama tempat kita dipulihkan.',
  },
];

const CHIPS = [
  { code: 'KASIH_AGAPE', label: '#KasihAgape', topic: 'HUBUNGAN' },
  { code: 'BEBAS_VALIDASI', label: '#BebasValidasi', topic: 'HUBUNGAN' },
  { code: 'PENGAMPUNAN', label: '#Pengampunan', topic: 'HUBUNGAN' },
  { code: 'PEMULIHAN_LUKA', label: '#PemulihanLuka', topic: 'HUBUNGAN' },
  { code: 'INTEGRITAS', label: '#Integritas', topic: 'PEKERJAAN' },
  { code: 'BUKAN_HUSTLE_CULTURE', label: '#BukanHustleCulture', topic: 'PEKERJAAN' },
  { code: 'IDENTITAS_BARU', label: '#IdentitasBaru', topic: 'PEKERJAAN' },
  { code: 'KARYA_SALIB', label: '#KaryaSalib', topic: 'PEKERJAAN' },
  { code: 'BEBAS_TUNTUTAN', label: '#BebasTuntutan', topic: 'KELUARGA' },
  { code: 'HAMBA_TUHAN', label: '#HambaTuhan', topic: 'KELUARGA' },
  { code: 'RUMAH_BAPA', label: '#RumahBapa', topic: 'KELUARGA' },
  { code: 'CORAM_DEO', label: '#CoramDeo', topic: null },
];

const AFFIRMATIONS = {
  HUBUNGAN: [
    'Kamu tidak perlu topeng: kamu dikasihi Kristus apa adanya.',
    'Kamu sanggup mengampuni karena kamu sudah lebih dulu diampuni.',
    'Identitasmu bukan ditentukan siapa yang tinggal, tetapi siapa yang menebusmu.',
  ],
  PEKERJAAN: [
    'Nilaimu bukan angka di kampus atau pujian atasan, tetapi karya Kristus.',
    'Integritasmu adalah ibadah yang Tuhan lihat, bahkan saat tak ada yang menonton.',
    'Kerjamu adalah mezbah: dari 9-to-5 menjadi altar.',
  ],
  KELUARGA: [
    'Kasih Bapa tidak menuntut prestasi — kamu boleh pulang apa adanya.',
    'Rumah yang sulit pun bisa menjadi ladang kasih Agape.',
    'Keluarga adalah tempat pertama kamu belajar dikasihi dan mengasihi.',
  ],
};

async function upsertPattern(conn, p) {
  const [rows] = await conn.query('SELECT id FROM worship_patterns WHERE code = ? LIMIT 1', [p.code]);
  const payload = [
    p.name,
    p.summary,
    JSON.stringify(p.phases),
    JSON.stringify(p.modules),
    p.playbook,
    'ACTIVE',
    p.defaultDurationMin,
    p.sortOrder,
  ];
  if (rows.length) {
    await conn.query(
      'UPDATE worship_patterns SET name=?, summary=?, phases=?, modules=?, playbook=?, status=?, default_duration_min=?, sort_order=? WHERE code=?',
      [...payload, p.code],
    );
    return rows[0].id;
  }
  const id = uid('wp');
  await conn.query(
    'INSERT INTO worship_patterns (id, code, name, summary, phases, modules, playbook, status, default_duration_min, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, p.code, ...payload],
  );
  return id;
}

(async () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  const ids = {};
  for (const p of PATTERNS) {
    ids[p.code] = await upsertPattern(conn, p);
    console.log(`✓ pola ${p.code}`);
  }

  const SLUG = 'mentoring-2026-10-04';
  const [existing] = await conn.query('SELECT id FROM worship_sessions WHERE slug = ? LIMIT 1', [SLUG]);
  let sessionId = existing[0]?.id || null;

  if (!sessionId) {
    sessionId = uid('ws');
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const config = {
      timerSeconds: 1200,
      rankFloors: [2, 1, 3],
      floors: [
        { floor: 1, label: 'Lantai 1' },
        { floor: 2, label: 'Lantai 2' },
        { floor: 3, label: 'Lantai 3' },
      ],
      topics: TOPICS.map((t) => ({ code: t.code, label: t.label, pic: t.pic })),
      affirmations: AFFIRMATIONS,
      chipLimit: 3,
    };
    await conn.query(
      `INSERT INTO worship_sessions (id, pattern_id, slug, title, tenant_id, session_date, status, access_code, config)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        sessionId,
        ids.POST_TO_POST,
        SLUG,
        'Mentoring Day — More Than Good News',
        'tenant-youth',
        '2026-10-04',
        'DRAFT',
        code,
        JSON.stringify(config),
      ],
    );
    console.log(`✓ sesi ${SLUG} dibuat (kode akses: ${code})`);
  } else {
    console.log(`sesi ${SLUG} sudah ada — dilewati`);
  }

  const [items] = await conn.query('SELECT COUNT(*) n FROM worship_likert_items WHERE session_id = ?', [sessionId]);
  if (!items[0].n) {
    let order = 0;
    for (const t of TOPICS) {
      const topicItems = ITEMS.filter((i) => i.topic === t.code);
      for (const it of topicItems) {
        order += 1;
        await conn.query(
          'INSERT INTO worship_likert_items (id, session_id, topic_code, text, gospel_note, sort_order) VALUES (?,?,?,?,?,?)',
          [uid('wli'), sessionId, t.code, it.text, it.note, order],
        );
      }
    }
    console.log(`✓ ${ITEMS.length} pertanyaan Likert dibuat`);
  } else {
    console.log('pertanyaan Likert sudah ada — dilewati');
  }

  const [chips] = await conn.query('SELECT COUNT(*) n FROM worship_chips WHERE session_id = ?', [sessionId]);
  if (!chips[0].n) {
    let order = 0;
    for (const c of CHIPS) {
      order += 1;
      await conn.query(
        'INSERT INTO worship_chips (id, session_id, code, label, topic_code, sort_order, is_active) VALUES (?,?,?,?,?,?,?)',
        [uid('wc'), sessionId, c.code, c.label, c.topic, order, 1],
      );
    }
    console.log(`✓ ${CHIPS.length} chip words dibuat`);
  } else {
    console.log('chip words sudah ada — dilewati');
  }

  await conn.end();
  console.log('✓ Selesai (seed pola ibadah).');
})().catch((e) => {
  console.error('Gagal seed worship:', e?.message || e);
  process.exit(1);
});
