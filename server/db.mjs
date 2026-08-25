import { PrismaClient } from '@prisma/client';

/**
 * TiDB Cloud via Prisma — cukup satu variabel env:
 *   DATABASE_URL="mysql://USER:PASSWORD@HOST:4000/DBNAME?sslaccept=strict"
 *
 * Client dibuat lazy: server tetap bisa boot (mode Drive-only)
 * walau DATABASE_URL belum dikonfigurasi.
 */
let _prisma = null;

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma() {
  if (!isDbConfigured()) return null;
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

export async function testConnection() {
  const p = getPrisma();
  if (!p) return false;
  await p.$queryRaw`SELECT 1`;
  return true;
}
