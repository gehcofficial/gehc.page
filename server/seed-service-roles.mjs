/**
 * Seed komponen penatalayan baku (LITURGIA · DIDASKALIA · KOINONIA · DIAKONIA · MARTURIA).
 *
 * Idempotent: upsert per nama. Aman dijalankan berulang; tidak menghapus
 * komponen yang sudah diubah/ditambah manual dari portal.
 * Catatan: "Pembaca Firman 1/2" dipindah dari LITURGIA ke DIDASKALIA.
 *
 *   npm run db:seed:service-roles
 *   npm run db:seed:service-roles:staging
 *   npm run db:seed:service-roles:prod
 */
import { getPrisma, getDbLabel } from './db.mjs';

const BOTH = 'SERVING_DAY,MENTORING_DAY';
const SERVING = 'SERVING_DAY';

/** @type {Array<{name:string;division:string;subDivision?:string;serviceTypes?:string;description:string;checklist?:string[]}>} */
const ROLES = [
  // ---- LITURGIA ----
  { name: 'Liturgist', division: 'LITURGIA', subDivision: 'Liturgi & Ibadah', serviceTypes: BOTH, description: 'Memimpin alur liturgi ibadah.' },
  { name: 'Worship Leader', division: 'LITURGIA', subDivision: 'Liturgi & Ibadah', serviceTypes: BOTH, description: 'Memimpin pujian & penyembahan.' },
  { name: 'Song Leader', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Memandu lagu jemaat.' },
  { name: 'Singer', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Vokal pengiring pujian.' },
  { name: 'Pemusik — Keyboard', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Pemain keyboard.' },
  { name: 'Pemusik — Gitar', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Pemain gitar.' },
  { name: 'Pemusik — Bass', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Pemain bass.' },
  { name: 'Pemusik — Drum', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Pemain drum.' },
  { name: 'Kantoria / Paduan Suara', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Paduan suara / kantoria.' },
  { name: 'Rebana', division: 'LITURGIA', subDivision: 'Musik & Vokal', serviceTypes: BOTH, description: 'Musik tradisional rebana.' },
  { name: 'Doa Syafaat', division: 'LITURGIA', subDivision: 'Doa & Intercession', serviceTypes: BOTH, description: 'Doa syafaat jemaat.' },
  { name: 'Doa Persembahan', division: 'LITURGIA', subDivision: 'Doa & Intercession', serviceTypes: BOTH, description: 'Doa atas persembahan.' },
  { name: 'Kolektor Persembahan', division: 'LITURGIA', subDivision: 'Liturgi & Ibadah', serviceTypes: BOTH, description: 'Mengumpulkan persembahan.' },
  { name: 'MC / Pembawa Acara', division: 'LITURGIA', subDivision: 'Liturgi & Ibadah', serviceTypes: BOTH, description: 'Pembawa acara event.' },

  // ---- DIDASKALIA (pembaca firman; ada pembinaan khusus saat Serving) ----
  { name: 'Pembaca Firman 1', division: 'DIDASKALIA', subDivision: 'Kurikulum', serviceTypes: BOTH, description: 'Pembacaan Alkitab pertama.', checklist: ['Baca teks & konteksnya', 'Latihan pembacaan', 'Konfirmasi ke Liturgist', 'Cek mikrofon sebelum ibadah'] },
  { name: 'Pembaca Firman 2', division: 'DIDASKALIA', subDivision: 'Kurikulum', serviceTypes: BOTH, description: 'Pembacaan Alkitab kedua.', checklist: ['Baca teks & konteksnya', 'Latihan pembacaan', 'Konfirmasi ke Liturgist', 'Cek mikrofon sebelum ibadah'] },

  // ---- MARTURIA ----
  { name: 'Operator Sound', division: 'MARTURIA', subDivision: 'Multimedia & Sound', serviceTypes: BOTH, description: 'Mengelola tata suara.' },
  { name: 'Operator Multimedia / Live Streaming', division: 'MARTURIA', subDivision: 'Multimedia & Sound', serviceTypes: BOTH, description: 'Slide, proyeksi, dan live streaming.' },
  { name: 'Kameramen', division: 'MARTURIA', subDivision: 'Dokumentasi Visual', serviceTypes: BOTH, description: 'Pengambilan gambar/video.' },
  { name: 'Fotografer', division: 'MARTURIA', subDivision: 'Dokumentasi Visual', serviceTypes: BOTH, description: 'Dokumentasi foto.' },
  { name: 'Editor Video', division: 'MARTURIA', subDivision: 'Dokumentasi Visual', serviceTypes: BOTH, description: 'Penyuntingan video.' },
  { name: 'Desain & Publikasi', division: 'MARTURIA', subDivision: 'Desain & Publikasi', serviceTypes: BOTH, description: 'Desain visual dan publikasi sosmed.' },

  // ---- KOINONIA (Tuan Rumah: penerima tamu, absensi, dekorasi) ----
  { name: 'Koordinator Tuan Rumah', division: 'KOINONIA', subDivision: 'Persekutuan & Integrasi', serviceTypes: SERVING, description: 'Mengoordinasi seluruh kebutuhan tuan rumah saat ibadah.' , checklist: ['Cek jadwal & kebutuhan ibadah', 'Bagi tugas tim tuan rumah', 'Pastikan ruangan siap sebelum ibadah', 'Sambut & arahkan tamu', 'Rapikan/bersihkan sesudah ibadah'] },
  { name: 'Penerima Tamu / Usher', division: 'KOINONIA', subDivision: 'Persekutuan & Integrasi', serviceTypes: SERVING, description: 'Menyambut dan mengarahkan tamu/jemaat.', checklist: ['Siapkan meja sambut', 'Sambut tamu di pintu', 'Arahkan tempat duduk', 'Catat newcomer untuk follow-up'] },
  { name: 'Absensi Tamu', division: 'KOINONIA', subDivision: 'Persekutuan & Integrasi', serviceTypes: SERVING, description: 'Mengoperasikan absensi QR untuk tamu/jemaat.', checklist: ['Buka menu Check-in', 'Scan QR peserta', 'Input walk-in (tamu tanpa QR)', 'Rekap kehadiran'] },
  { name: 'Dekorasi', division: 'KOINONIA', subDivision: 'Program & Acara', serviceTypes: SERVING, description: 'Menata dekorasi & suasana ruang ibadah.', checklist: ['Siapkan bahan dekorasi', 'Tata ruang & panggung', 'Rapikan sesudah ibadah'] },

  // ---- DIAKONIA (kebersihan & konsumsi) ----
  { name: 'Kebersihan & Penataan Ruang', division: 'DIAKONIA', subDivision: 'Logistik & Fasilitas', serviceTypes: SERVING, description: 'Membersihkan & menata bangunan sebelum/sesudah ibadah.', checklist: ['Bersihkan ruang sebelum ibadah', 'Tata kursi & meja', 'Cek kebersihan toilet', 'Bersihkan & rapikan sesudah ibadah'] },
  { name: 'Konsumsi', division: 'DIAKONIA', subDivision: 'Konsumsi & Keramahan', serviceTypes: SERVING, description: 'Menyiapkan & mendistribusikan konsumsi.', checklist: ['Konfirmasi menu & jumlah', 'Siapkan konsumsi', 'Distribusikan', 'Bersihkan area makan'] },
];

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('DATABASE_URL belum dikonfigurasi.');
    process.exit(1);
  }
  console.log(`Seed komponen penatalayan → ${getDbLabel()}`);
  let created = 0;
  let updated = 0;
  const orderByDivision = {};
  for (const r of ROLES) {
    orderByDivision[r.division] = (orderByDivision[r.division] || 0) + 10;
    const data = {
      division: r.division,
      subDivision: r.subDivision || null,
      serviceTypes: r.serviceTypes || BOTH,
      checklistTemplate: r.checklist && r.checklist.length ? r.checklist : null,
      description: r.description,
      sortOrder: orderByDivision[r.division],
      isActive: true,
    };
    const existing = await prisma.serviceRole.findUnique({ where: { name: r.name } });
    if (existing) {
      await prisma.serviceRole.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      const id = 'sr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await prisma.serviceRole.create({ data: { id, name: r.name, ...data } });
      created += 1;
    }
  }
  console.log(`✓ Selesai — ${created} dibuat, ${updated} diselaraskan.`);
}

main()
  .catch((e) => {
    console.error('Gagal seed service roles:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    if (prisma) await prisma.$disconnect().catch(() => {});
  });
