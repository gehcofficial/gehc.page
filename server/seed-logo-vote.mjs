/**
 * Seed voting logo kelompok: sesi + 20 opsi (10 grup x 2) + filosofi.
 * Gambar diambil dari folder Drive bersama (aksen gehcofficial).
 *
 *   npm run db:seed:logo-vote[:staging|:prod]
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { getPrisma, getDbLabel } from './db.mjs';
import { listFolders, listFiles, getDriveMode } from './gdrive.mjs';

const SOURCE_FOLDER_ID = process.env.LOGO_VOTE_FOLDER_ID || '1mCRRWO0QmPR5qR4YUzgRmgjFT1DJoSoQ';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const PHILOSOPHY = {
  Agape: 'Sometimes, sebagai pemuda, kita merasa harus menghadapi semuanya sendiri. Agape mengingatkan bahwa kasih Tuhan selalu menerima dan merangkul kita. Garis lengkung yang melindungi api di pusat logo melambangkan kasih tanpa syarat, serta komunitas yang menjaga dan menumbuhkan iman setiap anggotanya dalam kasih Kristus.',
  Avodah: 'Sometimes, kita menganggap pelayanan dan tanggung jawab sebagai beban yang melelahkan. Avodah mengajak kita melihat setiap karya sebagai bentuk ibadah kepada Tuhan. Pilar-pilar kokoh dan struktur yang terbuka melambangkan iman, dedikasi, dan pelayanan yang terus membangun serta menguatkan sesama.',
  Dunamis: 'Sometimes, kita merasa kecil di tengah tantangan dan panggilan hidup yang besar. Dunamis mengingatkan bahwa kekuatan sejati bersumber dari kuasa Tuhan. Kilatan petir dan garis-garis tajam yang memancar melambangkan keberanian, kebangkitan iman, dan kuasa Roh yang menggerakkan kita untuk membawa dampak bagi sekitar.',
  Echad: 'Sometimes, perbedaan membuat kita merasa jauh satu sama lain. Echad mengingatkan bahwa kita dapat tetap menjadi diri sendiri, namun bertumbuh dalam satu kesatuan di dalam Tuhan. Garis-garis yang saling menganyam dan bertemu di satu pusat melambangkan persaudaraan yang utuh, harmonis, dan saling melengkapi.',
  Hesed: 'Sometimes, kita merasa tidak layak untuk diterima atau sulit untuk kembali setelah jatuh. Hesed menggambarkan kasih setia Tuhan yang tidak meninggalkan kita. Garis-garis lengkung yang merangkul ruang terbuka di tengah logo melambangkan kasih karunia, perlindungan, dan komunitas yang menjadi ruang aman bagi setiap individu untuk dipulihkan dan bertumbuh.',
  Kairos: 'Sometimes, kita merasa tertinggal ketika hidup orang lain tampak berjalan lebih cepat. Kairos mengingatkan bahwa setiap orang memiliki musim dan prosesnya sendiri dalam rencana Tuhan. Garis pusat yang menembus celah berlian, dikelilingi lintasan asimetris, melambangkan waktu ilahi dan setiap perjumpaan mentoring sebagai kesempatan berharga untuk bertumbuh dalam kehendak-Nya.',
  Logos: 'Sometimes, kita dihadapkan pada banyak suara yang membuat kita sulit membedakan kebenaran. Logos mengingatkan bahwa Firman Tuhan adalah landasan bagi hidup dan hikmat kita. Garis vertikal yang tegas serta struktur berlapis melambangkan kebenaran ilahi dan perjalanan mentoring untuk terus menggali Firman serta bertumbuh dalam pengenalan akan Tuhan.',
  Metanoia: 'Sometimes, kita sadar bahwa ada bagian dari diri kita yang perlu diubah, tetapi melangkah keluar dari kebiasaan lama tidaklah mudah. Metanoia melambangkan titik balik pertobatan dan pembaruan hidup di dalam Tuhan. Garis-garis menyerupai sayap yang merekah ke atas merepresentasikan transformasi batin, pemulihan, dan keberanian untuk melangkah sebagai ciptaan baru.',
  Ruach: 'Sometimes, kita merasa kehilangan arah, semangat, bahkan kekuatan untuk terus melangkah. Ruach mengingatkan bahwa Roh Tuhan senantiasa hadir untuk menghidupkan dan menggerakkan kita. Garis-garis dinamis yang berputar dan menjulang ke atas melambangkan nafas kehidupan, kebebasan rohani, dan kuasa Roh Kudus yang menopang perjalanan iman setiap anggota.',
  Shalom: 'Sometimes, dunia yang begitu bising membuat kita lelah dan kehilangan ketenangan. Shalom mengingatkan bahwa damai Tuhan bukan sekadar ketenangan, melainkan pemulihan yang membawa keutuhan. Dua garis lengkung yang saling merangkul dan ruang terbuka di pusat logo melambangkan harmoni, peristirahatan jiwa, dan harapan untuk kembali melangkah dalam damai Tuhan.',
};

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('DATABASE_URL belum dikonfigurasi.');
    process.exit(1);
  }
  console.log(`Seed voting logo → ${getDbLabel()}`);
  if (!getDriveMode()) { console.error('Google Drive belum dikonfigurasi (GDRIVE_*).'); process.exit(1); }

  // Sesi
  let session = await prisma.groupLogoVote.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!session) {
    session = await prisma.groupLogoVote.create({
      data: { id: 'glv-logo-kelompok', title: 'Pemilihan Logo Kelompok', description: 'Pilih satu dari dua opsi logo untuk kelompok Anda.', status: 'DRAFT' },
    });
    console.log('Sesi dibuat:', session.id);
  } else {
    console.log('Sesi ada:', session.id, '(' + session.status + ')');
  }

  // Drive: subfolder grup
  const subs = await listFolders(SOURCE_FOLDER_ID, 100);
  console.log(`Drive subfolder: ${subs.length}`);

  let created = 0;
  let updated = 0;
  for (const sub of subs) {
    const group = await prisma.group.findFirst({ where: { name: sub.name } }).catch(() => null);
    if (!group) { console.log(`  lewat ${sub.name} (grup tidak ditemukan)`); continue; }
    const files = await listFiles({ folderId: sub.id, pageSize: 50, fresh: true }).catch(() => []);
    const pick = (n) => files.find((f) => new RegExp(`-${n}\\.(jpe?g|png)$`, 'i').test(f.name))?.id || null;
    for (const n of [1, 2]) {
      const driveId = pick(n);
      if (!driveId) { console.log(`  lewat ${sub.name} opsi ${n} (file tidak ada)`); continue; }
      // Pakai aset statis bila tersedia (cepat & tak bergantung akses Drive di produksi).
      const relPath = `/logo-grup/${slug(sub.name)}-${n}.jpg`;
      const imageFileId = existsSync(`public${relPath}`) ? relPath : driveId;
      const existing = await prisma.groupLogoOption.findUnique({
        where: { sessionId_groupId_optionNo: { sessionId: session.id, groupId: group.id, optionNo: n } },
      }).catch(() => null);
      const data = { label: `Logo ${n}`, imageFileId, philosophy: PHILOSOPHY[sub.name] || null };
      if (existing) {
        await prisma.groupLogoOption.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.groupLogoOption.create({
          data: { id: `glo-${group.id}-${n}`, sessionId: session.id, groupId: group.id, optionNo: n, ...data },
        });
        created += 1;
      }
    }
    console.log(`  ✓ ${sub.name} (${group.id})`);
  }
  console.log(`✓ Selesai — ${created} opsi dibuat, ${updated} diselaraskan.`);
}

main()
  .catch((e) => { console.error('Gagal seed voting:', e?.message || e); process.exit(1); })
  .finally(async () => { const p = getPrisma(); if (p) await p.$disconnect().catch(() => {}); });
