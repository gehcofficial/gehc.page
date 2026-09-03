/**
 * One-shot migrasi nama sub-divisi panca tugas v2 (full rename DB).
 * Jalankan sekali setelah deploy kode baru, lalu:
 *   npm run db:seed-users:staging  (replace-all dari INITIAL_STRUKTUR)
 *   npm run db:seed:org-tree:staging
 *   npm run drive:provision  (folder baru)
 *
 * Usage: node server/migrate-pancatugas-subdivisions.cjs
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SUBDIVISION_MIGRATION = {
  LITURGIA: {
    'Liturgi & Musik': 'Musik & Vokal',
    Pendoa: 'Doa & Intercession',
    Intercessor: 'Doa & Intercession',
  },
  DIDASKALIA: {
    'Kurikulum & Pembekalan': 'Kurikulum Pemuridan',
  },
  KOINONIA: {
    'Program Persekutuan': 'Program & Acara',
    'Public Relations (PR)': 'Hubungan & Komunikasi',
  },
  DIAKONIA: {
    'Logistik & Akomodasi': 'Logistik & Fasilitas',
    Konsumsi: 'Konsumsi & Keramahan',
    'Medis & First Aid': 'Kesehatan & Keselamatan',
  },
  MARTURIA: {
    Dokumentasi: 'Dokumentasi Visual',
    'Penginjilan Praktis': 'Penginjilan & Misi',
  },
  BENZARPR: {
    Merchandise: 'Merchandise & Produk',
    Fundraising: 'Penggalangan Dana',
    Donation: 'Persembahan & Donasi',
  },
};

const POSITION_MIGRATION = {
  'Kepala Benzarpreneurship (BZP)': 'Koordinator Penggalangan Dana',
  'Main Speaker — Pembekal Mentor & Comentor': 'Lead Equipper — Pembekal Mentor & Comentor',
  'PIC Ibadah — Worship & Personel Liturgi': 'Kepala Divisi',
  'PIC MTDD — Multimedia, Dokumentasi & Publikasi': 'PIC Desain & Publikasi',
  'PIC Logistik — Akomodasi & Peralatan': 'PIC Logistik & Fasilitas',
  'PIC Konsumsi — Vendor & Self-Made': 'PIC Konsumsi & Keramahan',
  'First Aid & Kesehatan': 'Koordinator Kesehatan & Keselamatan',
  'Foto & Video': 'Koordinator Dokumentasi Visual',
  'Perlengkapan & Pelatihan Injili': 'Koordinator Penginjilan & Misi',
  'Produksi & Penjualan Merchandise': 'Koordinator Merchandise & Produk',
  'Usaha Dana & Penggalangan Dana': 'Koordinator Penggalangan Dana',
  'Pengelolaan Persembahan & Donasi': 'Koordinator Persembahan & Donasi',
  'Follow-up, MC & Media Sosial': 'Koordinator Hubungan & Komunikasi',
  'Games & Bonding': 'Koordinator Persekutuan & Integrasi',
  'Penyusun Modul & Kurikulum': 'Penyusun Modul & Kurikulum',
  'Koordinator Doa': 'Koordinator Doa & Intercession',
  'Intercessor Pra-During-Pasca': 'Koordinator Doa & Intercession',
};

async function main() {
  const members = await prisma.strukturMember.findMany({
    where: {
      division: { in: Object.keys(SUBDIVISION_MIGRATION) },
    },
  });

  let subUpdated = 0;
  let posUpdated = 0;

  for (const m of members) {
    const div = (m.division || '').toUpperCase();
    const map = SUBDIVISION_MIGRATION[div];
    const data = {};

    if (m.subdivision && map?.[m.subdivision]) {
      data.subdivision = map[m.subdivision];
      subUpdated += 1;
    }

    if (m.position && POSITION_MIGRATION[m.position]) {
      data.position = POSITION_MIGRATION[m.position];
      posUpdated += 1;
    }

    if (m.position === 'Kepala Benzarpreneurship (BZP)' && !data.subdivision) {
      data.subdivision = 'Penggalangan Dana';
    }

    if (Object.keys(data).length) {
      await prisma.strukturMember.update({ where: { id: m.id }, data });
    }
  }

  console.log(`✓ migrate-pancatugas: ${subUpdated} subdivision, ${posUpdated} position updates (${members.length} rows scanned)`);
  console.log('  Rekomendasi: npm run db:seed-users:staging untuk replace-all dari INITIAL_STRUKTUR');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
