/**
 * Seed Pelsus 11 Okt 2026 — idempoten.
 * Membuat elections DRAFT (BIPRA × BIPRA, KOLOM × Penatua/Diaken, BPMJ × jabatan)
 * + sync DPT dari User aktif. Kandidat diinput panitia (DRAFT).
 *
 * Jalankan: npm run db:seed:pelsus[:staging|:prod]
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { getPrisma } from './db.mjs';

const uid = (p) => `${p}-${crypto.randomUUID().slice(0, 12)}`;
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();

const BIPRAS = ['BAPAK', 'IBU', 'PEMUDA', 'REMAJA', 'ANAK'];
const BPMJ_SEATS = [
  { role: 'WAKIL_KETUA', title: 'BPMJ — Wakil Ketua' },
  { role: 'SEKRETARIS', title: 'BPMJ — Sekretaris' },
  { role: 'BENDAHARA', title: 'BPMJ — Bendahara (Diaken)' },
  { role: 'ANGGOTA', title: 'BPMJ — Anggota' },
];

async function ensureElection(prisma, data) {
  const existing = await prisma.pelsusElection.findUnique({ where: { id: data.id } }).catch(() => null);
  if (existing) return { row: existing, created: false };
  const row = await prisma.pelsusElection.create({ data: { ...data, accessCode: code(), status: 'DRAFT' } });
  return { row, created: true };
}

async function syncDpt(prisma, election) {
  if (election.scope === 'BPMJ') return { created: 0, scanned: 0 };
  const where = { accountStatus: 'ACTIVE' };
  if (election.scope === 'BIPRA' && election.bipra) where.bipra = election.bipra;
  if (election.scope === 'KOLOM' && election.kolomId) where.kolomId = election.kolomId;
  const users = await prisma.user.findMany({
    where, select: { id: true, name: true, bipra: true, kolomId: true }, take: 5000,
  }).catch(() => []);
  let created = 0;
  for (const u of users) {
    try {
      await prisma.pelsusVoter.create({
        data: { id: uid('pvt'), electionId: election.id, userId: u.id, name: String(u.name || u.id).slice(0, 150), bipra: u.bipra || null, kolomId: u.kolomId || null },
      });
      created += 1;
    } catch { /* sudah ada */ }
  }
  return { created, scanned: users.length };
}

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  let elections = 0; let voters = 0;

  for (const b of BIPRAS) {
    const { row } = await ensureElection(prisma, {
      id: `pel-bipra-${b.toLowerCase()}`, scope: 'BIPRA', bipra: b, roleTarget: 'PENATUA',
      title: `Penatua ${b.charAt(0) + b.slice(1).toLowerCase()} — 11 Okt 2026`,
      description: 'Pemilihan Calon Penatua BIPRA dalam Rapat Sidi Jemaat.',
      maxChoices: 1, quorumNum: 2, quorumDen: 3,
    });
    elections += 1;
    voters += (await syncDpt(prisma, row)).created;
  }

  const koloms = await prisma.kolom.findMany({ orderBy: { number: 'asc' } }).catch(() => []);
  const kolList = koloms.length ? koloms : [{ id: 'kol-1', number: 1 }, { id: 'kol-2', number: 2 }, { id: 'kol-3', number: 3 }, { id: 'kol-4', number: 4 }, { id: 'kol-5', number: 5 }];
  for (const k of kolList) {
    const label = k.number ? `Kolom ${k.number}` : k.id;
    for (const role of ['PENATUA', 'DIAKEN']) {
      const { row } = await ensureElection(prisma, {
        id: `pel-${k.id.toLowerCase()}-${role.toLowerCase()}`, scope: 'KOLOM', kolomId: k.id, roleTarget: role,
        title: `Calon ${role.charAt(0) + role.slice(1).toLowerCase()} ${label} — 11 Okt 2026`,
        description: `Pemungutan suara Rapat Sidi Jemaat di ${label}.`,
        maxChoices: 1, quorumNum: 2, quorumDen: 3,
      });
      elections += 1;
      voters += (await syncDpt(prisma, row)).created;
    }
  }

  for (const s of BPMJ_SEATS) {
    await ensureElection(prisma, {
      id: `pel-bpmj-${s.role.toLowerCase()}`, scope: 'BPMJ', roleTarget: s.role,
      title: `${s.title} — 11 Okt 2026`,
      description: 'Dipilih dalam Sidang Majelis Jemaat oleh Pelsus terpilih (fase-2 via promote). DPT via promote/import.',
      maxChoices: 1, quorumNum: 2, quorumDen: 3,
    });
    elections += 1;
  }

  console.log(`✓ Pelsus seed: ${elections} elections, +${voters} DPT baru (idempoten).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('Gagal seed pelsus:', e?.message || e); process.exit(1); });
