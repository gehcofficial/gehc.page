/**
 * Idempotent: chip Lesson Learned untuk sesi Creative Lab (default: 25 Okt 2026).
 * Lokal: DATABASE_URL · Produksi: npm run db:seed:creative-lab-chips:prod
 */
import { getPrisma } from '../server/db.mjs';

const DEFAULT_SLUG = 'sesi-2026-10-25-creative-lab';

/** Our Roots & DNA · 2 Timotius 1:3–18 — pekan 4 Okt 2026 */
const CHIPS = [
  { code: 'AKAR_IMAN', label: '#AkarIman' },
  { code: 'IDENTITAS_KRISTEN', label: '#IdentitasKristen' },
  { code: 'WARISAN_ROHANI', label: '#WarisanRohani' },
  { code: 'KETAATAN', label: '#Ketaatan' },
  { code: 'KASIH_BAPA', label: '#KasihBapa' },
  { code: 'BERANI_BERSAKSI', label: '#BeraniBersaksi' },
  { code: 'ANUGERAH', label: '#Anugerah' },
  { code: 'HARAP_BARU', label: '#HarapBaru' },
  { code: 'MEMORI_IMAN', label: '#MemoriIman' },
  { code: 'MENJAGA_API', label: '#MenjagaApi' },
].map((c) => ({
  code: String(c.code).replace(/[^A-Z0-9_]/g, '_').slice(0, 40),
  label: c.label.startsWith('#') ? c.label : `#${c.label}`,
}));

async function main() {
  const slug = String(process.argv[2] || process.env.CREATIVE_LAB_SESSION_SLUG || DEFAULT_SLUG).trim();
  const prisma = getPrisma();
  if (!prisma) {
    console.error('[seed-creative-lab-chips] DATABASE_URL belum dikonfigurasi.');
    process.exit(1);
  }
  const session = await prisma.worshipSession.findFirst({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!session) {
    console.error(`[seed-creative-lab-chips] Sesi tidak ditemukan: ${slug}`);
    process.exit(1);
  }
  let sort = 0;
  let upserted = 0;
  for (const chip of CHIPS) {
    sort += 1;
    const existing = await prisma.worshipChip.findFirst({
      where: { sessionId: session.id, code: chip.code },
    });
    if (existing) {
      await prisma.worshipChip.update({
        where: { id: existing.id },
        data: { label: chip.label, sortOrder: sort, isActive: true },
      });
    } else {
      await prisma.worshipChip.create({
        data: {
          id: `wc-${chip.code.toLowerCase()}`,
          sessionId: session.id,
          code: chip.code,
          label: chip.label,
          sortOrder: sort,
          isActive: true,
        },
      });
    }
    upserted += 1;
  }
  console.log(`[seed-creative-lab-chips] OK ${session.slug}: ${upserted} chip.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    if (prisma) await prisma.$disconnect().catch(() => {});
  });
