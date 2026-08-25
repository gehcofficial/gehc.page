/**
 * Seed TiDB Cloud dari data seed aplikasi.
 * Jalankan: npm run db:seed   (butuh DATABASE_URL di .env)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  INITIAL_TENANTS,
  INITIAL_GROUPS,
  INITIAL_GROUP_BATCHES,
  INITIAL_STRUKTUR,
} from '../src/data/initialData';

const prisma = new PrismaClient();

async function main() {
  console.log('Menyemai data GEHC Youth ke TiDB Cloud…');

  for (const t of INITIAL_TENANTS) {
    await prisma.tenant.upsert({
      where: { id: t.id },
      create: {
        id: t.id, name: t.name, slug: t.slug, domain: t.domain,
        description: t.description, isActive: t.is_active,
      },
      update: { name: t.name, isActive: t.is_active },
    });
  }
  console.log(`✓ tenants: ${INITIAL_TENANTS.length}`);

  for (const g of INITIAL_GROUPS) {
    await prisma.group.upsert({
      where: { id: g.id },
      create: {
        id: g.id, tenantId: g.tenant_id, name: g.name, meaning: g.meaning,
        scripture: g.scripture, meetingSchedule: g.meetingSchedule,
        meetingLocation: g.meetingLocation, color: g.color, icon: g.icon,
        description: g.description, memberCount: g.memberCount,
      },
      update: { memberCount: g.memberCount, meetingSchedule: g.meetingSchedule },
    });
  }
  console.log(`✓ groups: ${INITIAL_GROUPS.length}`);

  for (const b of INITIAL_GROUP_BATCHES) {
    await prisma.groupBatch.upsert({
      where: { id: b.id },
      create: {
        id: b.id, groupId: b.group_id, period: b.period, batchLabel: b.batchLabel,
        mentorName: b.mentor, comentorName: b.comentor, theme: b.theme,
        isCurrent: Boolean(b.isCurrent),
      },
      update: { mentorName: b.mentor, comentorName: b.comentor, isCurrent: Boolean(b.isCurrent) },
    });

    // Mentee sebagai anggota per batch
    for (let i = 0; i < b.mentees.length; i++) {
      const m = b.mentees[i];
      await prisma.groupMember.upsert({
        where: { id: `${b.id}-m${i + 1}` },
        create: {
          id: `${b.id}-m${i + 1}`,
          groupId: b.group_id,
          batchPeriod: b.period,
          name: m.name,
          familyRole: 'MENTEE',
          notes: m.note,
        },
        update: { name: m.name },
      });
    }
  }
  console.log(`✓ group_batches: ${INITIAL_GROUP_BATCHES.length} (+ mentee per batch)`);

  for (const s of INITIAL_STRUKTUR) {
    await prisma.strukturMember.upsert({
      where: { id: s.id },
      create: {
        id: s.id, name: s.name, position: s.position, division: s.division,
        period: s.period, photoUrl: s.photoUrl, bio: s.bio,
        phone: s.phone, email: s.email, sortOrder: s.order,
      },
      update: { position: s.position, bio: s.bio },
    });
  }
  console.log(`✓ struktur_members: ${INITIAL_STRUKTUR.length}`);

  console.log('Selesai — data Beyonders tersimpan di TiDB Cloud.');
}

main()
  .catch((e) => {
    console.error('Seed gagal:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
