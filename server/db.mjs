import { PrismaClient } from '@prisma/client';

/**
 * TiDB Cloud via Prisma.
 *
 * Pemilihan target:
 *   Vercel Production (git main)  → production  (DATABASE_URL_PRODUCTION)
 *   Vercel Preview + local dev    → staging     (DATABASE_URL_STAGING)
 *   GEHC_ENV / DB_TARGET          → override manual
 *
 * Format: mysql://USER:PASSWORD@HOST:4000/DBNAME?sslaccept=strict
 */

let _prisma = null;
let _applied = false;

function envTarget() {
  const vercelEnv = String(process.env.VERCEL_ENV || '').toLowerCase();
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview' || vercelEnv === 'development') return 'staging';

  const raw = String(process.env.GEHC_ENV || process.env.DB_TARGET || 'staging').toLowerCase();
  if (raw === 'production' || raw === 'prod' || raw === 'main') return 'production';
  return 'staging';
}

function withPrismaParams(url) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('sslaccept')) u.searchParams.set('sslaccept', 'strict');
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '10');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '60');
    if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '60');
    return u.toString();
  } catch {
    return url;
  }
}

export function resolveDatabaseUrl() {
  const target = envTarget();
  const staging = process.env.DATABASE_URL_STAGING || '';
  const production = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL_MAIN || '';
  const fallback = process.env.DATABASE_URL || '';
  const picked = target === 'production' ? (production || fallback) : (staging || fallback);
  return picked ? withPrismaParams(picked) : '';
}

export function getDbTarget() {
  return envTarget();
}

export function getDbLabel() {
  const url = resolveDatabaseUrl();
  if (!url) return 'tidak dikonfigurasi';
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '').split('?')[0];
    return `${envTarget()} · ${u.hostname}/${db}`;
  } catch {
    return envTarget();
  }
}

export function applyDatabaseUrl() {
  if (_applied) return process.env.DATABASE_URL || '';
  const url = resolveDatabaseUrl();
  if (url) process.env.DATABASE_URL = url;
  _applied = true;
  return url;
}

export function isDbConfigured() {
  return Boolean(applyDatabaseUrl());
}

export function isTransientDbError(err) {
  const msg = String(err?.message || err || '');
  return /P1001|P1017|P2024|connection pool|Timed out fetching|Can't reach database|Server has gone away|Connection lost|ECONNRESET|ECONNREFUSED|ETIMEDOUT|closed the connection/i.test(msg);
}

export async function resetPrisma() {
  if (!_prisma) return;
  const prev = _prisma;
  _prisma = null;
  try {
    await prev.$disconnect();
  } catch {
    /* ignore */
  }
}

export function getPrisma() {
  const url = applyDatabaseUrl();
  if (!url) return null;
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: { db: { url } },
      log: ['error'],
    });
  }
  return _prisma;
}

export async function testConnection() {
  const p = getPrisma();
  if (!p) return false;
  try {
    await p.$queryRawUnsafe('SELECT 1');
    return true;
  } catch (err) {
    if (isTransientDbError(err)) await resetPrisma();
    throw err;
  }
}

applyDatabaseUrl();
