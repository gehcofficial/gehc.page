/**
 * Seed komponen penatalayan baku (LITURGIA + MARTURIA).
 *
 * Idempotent: upsert per nama. Aman dijalankan berulang; tidak menghapus
 * komponen yang sudah diubah/ditambah manual dari portal.
 *
 *   npm run db:seed:service-roles
 *   npm run db:seed:service-roles:staging
 *   npm run db:seed:service-roles:prod
 */
import { getPrisma, getDbLabel } from './db.mjs';

const ROLES = {
  LITURGIA: [
    ['Liturgist', 'Memimpin alur liturgi ibadah.'],
    ['Worship Leader', 'Memimpin pujian & penyembahan.'],
    ['Song Leader', 'Memandu lagu jemaat.'],
    ['Singer', 'Vokal pengiring pujian.'],
    ['Pemusik — Keyboard', 'Pemain keyboard.'],
    ['Pemusik — Gitar', 'Pemain gitar.'],
    ['Pemusik — Bass', 'Pemain bass.'],
    ['Pemusik — Drum', 'Pemain drum.'],
    ['Kantoria / Paduan Suara', 'Paduan suara / kantoria.'],
    ['Rebana', 'Musik tradisional rebana.'],
    ['Pembaca Firman 1', 'Pembacaan Alkitab pertama.'],
    ['Pembaca Firman 2', 'Pembacaan Alkitab kedua.'],
    ['Doa Syafaat', 'Doa syafaat jemaat.'],
    ['Doa Persembahan', 'Doa atas persembahan.'],
    ['Kolektor Persembahan', 'Mengumpulkan persembahan.'],
    ['MC / Pembawa Acara', 'Pembawa acara event.'],
  ],
  MARTURIA: [
    ['Operator Sound', 'Mengelola tata suara.'],
    ['Operator Multimedia / Live Streaming', 'Slide, proyeksi, dan live streaming.'],
    ['Kameramen', 'Pengambilan gambar/video.'],
    ['Fotografer', 'Dokumentasi foto.'],
    ['Editor Video', 'Penyuntingan video.'],
    ['Desain & Publikasi', 'Desain visual dan publikasi sosmed.'],
  ],
};

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('DATABASE_URL belum dikonfigurasi.');
    process.exit(1);
  }
  console.log(`Seed komponen penatalayan → ${getDbLabel()}`);
  let created = 0;
  let updated = 0;
  for (const [division, roles] of Object.entries(ROLES)) {
    let order = 0;
    for (const [name, description] of roles) {
      order += 10;
      const existing = await prisma.serviceRole.findUnique({ where: { name } });
      if (existing) {
        await prisma.serviceRole.update({
          where: { id: existing.id },
          data: { division, description, sortOrder: order, isActive: true },
        });
        updated += 1;
      } else {
        const id = 'sr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await prisma.serviceRole.create({ data: { id, name, division, description, sortOrder: order } });
        created += 1;
      }
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
