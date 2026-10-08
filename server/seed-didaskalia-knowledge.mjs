/**
 * Seed knowledge base Didaskalia — panduan format khotbah tim.
 * Idempotent: upsert berdasarkan id tetap. Aman dijalankan berulang.
 *
 *   npm run db:seed:didaskalia-knowledge[:staging|:prod]
 */
import { getPrisma, getDbLabel } from './db.mjs';

const DOCS = [
  {
    id: 'dk-format-rhb',
    title: 'Standar Pola RHB Beyonders',
    category: 'FORMAT',
    source: 'MANUAL',
    sortOrder: 11,
    content: `# STANDAR POLA RHB BEYONDERS — TIM DIDASKALIA

Standar penyusunan Renungan Harian Beyonders (7 Path/hari). AI WAJIB mengikuti struktur, proporsi, dan nada di bawah ini. Keluaran AI adalah usulan — tim menyunting sebelum rilis.

## 1. Struktur tiap hari (urutan tetap)

1. **Pengantar** — konteks "renungan hari ini tentang apa" (boleh panjang) + **1–2 ilustrasi konkret dunia anak muda** (kuliah: KRS/tugas/skripsi; kerja: shift/lembur/atasan; kos, gaji pertama, relasi, keluarga jauh) yang memperjelas inti dan kontekstual dengan materi. Ilustrasi membuka, bukan tempelan.
2. **Pembahasan Tematis** — kupas nats pembimbing + bacaan harian, 1 paragraf padat.
3. **Makna & Implikasi bagi Beyonders** — "jadi apa buatku minggu ini", respons syukur (bukan usaha memperoleh keselamatan).
4. **Refleksi Pribadi — tepat 3 pertanyaan**, masing-masing 1 kalimat, masing-masing berlabel konteks:
   - 🎒 Pelajar — …?
   - 🎓 Mahasiswa — …?
   - 💼 Pekerja — …?

   Menohok tapi tidak menghakimi. Awalan yang disukai: "Kapan terakhir…?", "Apa yang berubah… jika…?", "Siapa/apa yang paling…?"
5. **Diskusi Kelompok — 2–3 pertanyaan** beralur observasi → interpretasi → aplikasi.

## 2. Nada (skala yang disepakati)

Hangat, bahasa anak muda, hormat. Tidak baku-kaku, tidak kasual-berlebihan.

- CONTOH BAIK: "Pernah nggak sih merasa sudah sibuk pelayanan tapi hati kering? Itu sinyal, bukan vonis."
- CONTOH BAIK: "Skripsi nggak kelar-kelar bisa bikin kita mempertanyakan penyertaan Tuhan — padahal justru di sanalah Dia bekerja."
- JANGAN: "Saudara-saudara yang dikasihi Tuhan, marilah kita merenungkan…" (terlalu baku).
- JANGAN: nada meremehkan kekudusan atau menjadikan Tuhan "chill".

## 3. Rambu teologi (tetap)

Reformed: Sola Scriptura/Gratia/Fide, Solus Christus, Soli Deo Gloria. Pemuridan = respons syukur, bukan syarat keselamatan. Jangan menyiratkan "Allah + usahamu".`,
  },
  {
    id: 'dk-format-khotbah-service',
    title: 'Pola Ringkasan Khotbah Panjang (For Service)',
    category: 'FORMAT',
    source: 'MANUAL',
    sortOrder: 9,
    content: `# POLA RINGKASAN KHOTBAH PANJANG (FOR SERVICE) — TIM DIDASKALIA

STANDAR LITERAL-MD: isi ringkasan khotbah = 4 bagian MD Service VERBATIM
(Pengantar, Bedah Teologis, Jembatan, Kesimpulan — salin kata-per-kata, tanpa
parafrase). Bagian yang panjang dipecah otomatis menjadi beberapa slide yang
rapi (maks ±700 karakter / 2 paragraf per slide, tidak memotong kalimat).
Setiap bagian memakai 1 gambar AI kontekstual sebagai background dengan teks
overlay (tulisan di atas gambar, kontras terjaga).

Pola baku tiap bagian (untuk penulis MD Service):

## 1. Pengantar — reframing masalah nyata
Buka dengan realita pemuda (finansial, patah hati, masa depan), lalu bongkar asumsinya:
masalah terbesar bukan keadaan hidup, melainkan dosa yang memisahkan dari Allah yang kudus.
Tegaskan manusia tak bisa menyelamatkan diri (contoh pola: "kain kotor", Yesaya 64:6).

## 2. Bedah Teologis — 2–4 poin dari teks utama
Tiap poin: kutip frasa ayat + makna teologisnya (doktrin eksplisit, mis. imputasi/pembenaran) +
luruskan SATU salah paham umum + tutup dengan 1 kalimat key-takeaway untuk anak muda
("Poin Utama bagi Anak Muda: ...").

## 3. Jembatan — kaitkan ke ayat jangkar mingguan
Tunjukkan teks utama bukan akhir cerita: sambungkan 2–3 poin ke Fundamental Firman/tema
mingguan (mis. pelepasan → kewarganegaraan baru → pengampunan mutlak).

## 4. Kesimpulan panggung — NASKAH SIAP-BACA
Satu blok direct speech yang hangat: pertukaran besar, status baru, dan panggilan merespons
hari ini ("Anda tidak butuh sekadar perbaikan nasib sementara..."). Siap diucapkan apa adanya.

## Rambu
- Reformed dan kontekstual Beyonders (kuliah/kerja/kos/relasi Cikarang), seperti standar lain.
- Kutip ayat akurat; jangan mengarang referensi.
- AI DILARANG memparafrase outline bila MD acuan tersedia (lihat aturan prompt SERMON_RULES).`,
  },
  {
    id: 'dk-format-khotbah',
    title: 'Panduan Format Khotbah — Tim Didaskalia',
    category: 'FORMAT',
    source: 'MANUAL',
    sortOrder: 10,
    content: `# PANDUAN FORMAT KHOTBAH — TIM DIDASKALIA

Panduan pola penyusunan khotbah/pembekalan yang dipakai tim Didaskalia. AI WAJIB mengikuti komposisi, alur, dan penekanan di bawah ini (disesuaikan dengan tema minggu & Fundamental Firman), bukan sekadar merangkum.

## Komposisi berbobot (acuan proporsi)
1. **Pendahuluan Tematis (20%) — The Hook & Transition**
   - Transisi eksplisit dari minggu sebelumnya (menyambung Path terakhir pekan lalu: tema, kitab fokus, judul Path).
   - Bawa **realita pemuda**: kondisi hidup nyata mahasiswa/anak rantau (kuliah, kerja, kos, keuangan, relasi).
   - Rumuskan **akar masalah** (bukan sekadar "menolak Tuhan", tetapi berat/susah taat pada area tertentu).
   - Tunjuk **titik kritis** ketika panggilan menuntut pengorbanan (waktu, tenaga, kenyamanan, ego).
2. **Peninjauan Historis (30%) — Teladan Tokoh**
   - Bawa satu tokoh Alkitab sebagai teladan (mis. Rasul Paulus) dengan latar singkat penderitaan/perjuangannya.
   - Sorot **level ketaatan** tokoh tersebut dan kaitkan dengan pemahaman yang benar tentang anugerah.
   - Ajukan **pertanyaan reflektif** ("Apa yang membuat tokoh ini sanggup bertahan?").
3. **Eksposisi Biblika (50%) — Puncak Pesan**
   - **Pusat Firman**: bedah ayat kunci (Fundamental Firman) dengan latar beberapa ayat di sekitarnya.
   - Jelaskan **esensi pelayanan/panggilan sejati** dari teks (mis. kontras kemuliaan sementara vs kemuliaan kekal oleh Roh).
   - **Redefining Greatness**: bongkar standar "hebat" versi dunia; kembalikan ke standar Kerajaan Allah.

## Catatan gaya
- Setiap bagian harus mengalir: Realita → Akar Masalah → Pusat Firman → Penerapan/Komitmen.
- Kontekstual untuk pemuda & anak rantau di Cikarang; hangat, tidak menggurui.
- Bertumpu pada tradisi Reformed (Protestan Kalvinis): anugerah Allah, kedaulatan, Alkitab sebagai otoritas tertinggi.
- Isi RHB harian mengikuti 5 section baku; judul Path Bahasa Inggris yang menarik, isi lain Bahasa Indonesia.`,
  },
];

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('DATABASE_URL belum dikonfigurasi.');
    process.exit(1);
  }
  console.log(`Seed knowledge Didaskalia → ${getDbLabel()}`);
  let created = 0;
  let updated = 0;
  for (const d of DOCS) {
    const existing = await prisma.didaskaliaKnowledge.findUnique({ where: { id: d.id } }).catch(() => null);
    if (existing) {
      await prisma.didaskaliaKnowledge.update({
        where: { id: d.id },
        data: { title: d.title, content: d.content, category: d.category, source: d.source, sortOrder: d.sortOrder, isActive: true },
      });
      updated += 1;
    } else {
      await prisma.didaskaliaKnowledge.create({
        data: { id: d.id, title: d.title, content: d.content, category: d.category, source: d.source, sortOrder: d.sortOrder, createdById: 'seed' },
      });
      created += 1;
    }
  }
  console.log(`✓ Selesai — ${created} dibuat, ${updated} diselaraskan.`);
}

main()
  .catch((e) => {
    console.error('Gagal seed knowledge:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    if (prisma) await prisma.$disconnect().catch(() => {});
  });
