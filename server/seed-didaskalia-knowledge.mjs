/**
 * Seed knowledge base Didaskalia — panduan format khotbah tim.
 * Idempotent: upsert berdasarkan id tetap. Aman dijalankan berulang.
 *
 *   npm run db:seed:didaskalia-knowledge[:staging|:prod]
 */
import { getPrisma, getDbLabel } from './db.mjs';

const DOCS = [
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
