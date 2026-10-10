/**
 * Seed preview V2 by-person 18 Okt 2026 — idempoten, data SIMULASI saja.
 * Membuat 3 election `pv2-*` (Pemuda + Kolom 3 Penatua/Diaken) + 2 kandidat
 * per election + DPT uji: 1 akun multi-surat (bila ada di DB) + 2 nama manual
 * tanpa akun (skenario paket token bilik berantai).
 *
 * 19 election DRAFT asli TIDAK disentuh (id pv2-* terpisah; prefix pv2- juga
 * di luar jangkauan bersih otomatis `npm run pelsus:sim` yang menghapus sim-*).
 * Preview V1: #/pelsus/pv2-pemuda — V2: #/pelsus2?sim
 *
 * Jalankan: npm run db:seed:pelsus:preview[:staging] [-- --open]
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { getPrisma } from './db.mjs';

const uid = (p) => `${p}-${crypto.randomUUID().slice(0, 12)}`;
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const OPEN = process.argv.includes('--open');

const ELECTIONS = [
  { id: 'pv2-pemuda', scope: 'BIPRA', bipra: 'PEMUDA', roleTarget: 'PENATUA', title: 'SIMULASI V2 — Penatua Pemuda' },
  { id: 'pv2-kol3-penatua', scope: 'KOLOM', kolomId: 'kol-3', roleTarget: 'PENATUA', title: 'SIMULASI V2 — Penatua Kolom 3' },
  { id: 'pv2-kol3-diaken', scope: 'KOLOM', kolomId: 'kol-3', roleTarget: 'DIAKEN', title: 'SIMULASI V2 — Diaken Kolom 3' },
];
// 1 orang = 3 surat suara (kasus Alvandi: Pemuda + Kolom 3).
const MULTI_NAMES = ['Uji Multi Surat'];
const MANUAL_ONLY = ['Tamu Tanpa Akun'];
const LINK_EMAILS = ['alvandi.saerang@gehc.demo'];

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  let elections = 0; let voters = 0; let candidates = 0;

  const linkUsers = [];
  for (const email of LINK_EMAILS) {
    const u = await prisma.user.findFirst({ where: { email }, select: { id: true, name: true } }).catch(() => null);
    if (u) linkUsers.push(u);
  }

  for (const e of ELECTIONS) {
    const existing = await prisma.pelsusElection.findUnique({ where: { id: e.id } }).catch(() => null);
    const row = existing || await prisma.pelsusElection.create({
      data: {
        id: e.id, scope: e.scope, bipra: e.bipra || null, kolomId: e.kolomId || null,
        roleTarget: e.roleTarget, title: e.title,
        description: 'SIMULASI preview V2 by-person — hapus setelah keputusan varian.',
        maxChoices: 1, quorumNum: 2, quorumDen: 3,
        accessCode: code(), status: OPEN ? 'OPEN' : 'DRAFT',
      },
    });
    if (!existing) elections += 1;
    if (OPEN && row.status !== 'OPEN') {
      await prisma.pelsusElection.update({ where: { id: e.id }, data: { status: 'OPEN' } }).catch(() => {});
    }
    for (const [i, name] of [`Calon A ${e.roleTarget}`, `Calon B ${e.roleTarget}`].entries()) {
      const dupe = await prisma.pelsusCandidate.findFirst({
        where: { electionId: e.id, nomor: i + 1 },
        select: { id: true },
      }).catch(() => null);
      if (dupe) continue;
      await prisma.pelsusCandidate.create({ data: { id: uid('pcd'), electionId: e.id, name, nomor: i + 1, roleTarget: e.roleTarget } });
      candidates += 1;
    }
    const addVoter = async (data) => {
      const dupe = await prisma.pelsusVoter.findFirst({
        where: { electionId: e.id, name: data.name },
        select: { id: true },
      }).catch(() => null);
      if (dupe) return;
      await prisma.pelsusVoter.create({ data: { id: uid('pvt'), electionId: e.id, ...data } });
      voters += 1;
    };
    for (const u of linkUsers) await addVoter({ userId: u.id, name: String(u.name || u.id).slice(0, 150), bipra: 'PEMUDA', kolomId: 'kol-3' });
    for (const n of MULTI_NAMES) await addVoter({ userId: null, name: n, bipra: 'PEMUDA', kolomId: 'kol-3' });
    for (const n of MANUAL_ONLY) await addVoter({ userId: null, name: n, bipra: null, kolomId: 'kol-3' });
  }

  console.log(`✓ Pelsus preview V2: ${elections} elections baru, +${candidates} kandidat, +${voters} DPT (akun tertaut: ${linkUsers.length}).`);
  console.log('  V1: #/pelsus/pv2-pemuda   V2: #/pelsus2?sim + #/pelsus2/panitia');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('Gagal seed preview V2:', e?.message || e); process.exit(1); });
