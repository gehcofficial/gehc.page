/**
 * Set password untuk semua akun dummy staging (@gehc.demo).
 *
 * Pola mengikuti scripts/create-demo-user.ts dari AISIGHT WEBSITE:
 * - Idempotent: aman dijalankan berulang.
 * - Hanya mengisi passwordHash yang KOSONG (tidak menimpa password existing).
 * - Format hash konsisten dengan server/auth.mjs (scrypt "salt:hash" hex).
 *   Bisa juga dipakai bcrypt — verifyPassword() mendukung keduanya? Tidak.
 *   auth.mjs verifyPassword hanya membaca format "salt:hash", jadi kita
 *   wajib pakai scrypt format yang sama.
 *
 * Jalankan: node server/set-demo-passwords.mjs
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DOMAIN = '@gehc.demo';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password123';

/** Hash scrypt "salt:hash" hex — identik dengan hashPassword() di server/auth.mjs */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Verifikasi ulang untuk sanity check — identik dengan verifyPassword() */
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === test.length && crypto.timingSafeEqual(expected, test);
}

async function main() {
  console.log(`Menyetel password demo untuk akun *${DOMAIN} …`);

  const users = await prisma.user.findMany({
    where: { email: { endsWith: DOMAIN } },
    select: { id: true, email: true, passwordHash: true },
  });

  let created = 0;
  let skipped = 0;
  const sampleEmails = [];

  for (const u of users) {
    if (u.passwordHash) {
      skipped++;
      continue; // sudah punya password — jangan timpa
    }
    const hash = hashPassword(DEMO_PASSWORD);
    if (!verifyPassword(DEMO_PASSWORD, hash)) {
      throw new Error(`Sanity check gagal untuk ${u.email}`);
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: hash },
    });
    created++;
    if (sampleEmails.length < 5) sampleEmails.push(u.email);
  }

  console.log(`✓ password dibuat : ${created}`);
  console.log(`✓ sudah ada       : ${skipped} (dilewati, tidak ditimpa)`);
  if (sampleEmails.length) {
    console.log(`  contoh: ${sampleEmails.join(', ')}`);
  }
  console.log(`\nLogin: <nama>.<akhir>@${DOMAIN} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Gagal:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
