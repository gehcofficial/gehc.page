/**
 * Static CDN mirror untuk Website Visual [PUBLIK].
 * File di public/visuals/ — dilayani Vite/Vercel edge (bukan proxy Drive).
 * Manifest ditulis oleh npm run drive:pull-visuals.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VISUALS_DIR = join(ROOT, 'public', 'visuals');
export const MANIFEST_PATH = join(VISUALS_DIR, 'manifest.json');

export function emptySlots() {
  return {
    landing: {},
    brand: {},
    warta: {},
    kegiatan: {},
    benzar: {},
    kelompok: {},
    pengurus: {},
    testimoni: {},
  };
}

export function assignSlot(slots, key, url) {
  if (!url || !key) return;
  const [group, rest] = key.split('.');
  if (!rest) return;
  if (!slots[group]) slots[group] = {};
  slots[group][rest] = url;
}

export function slotsHasAny(slots) {
  return Object.values(slots).some((g) => Object.keys(g).length > 0);
}

export function staticUrl(relativePath, mtimeMs) {
  const clean = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const v = mtimeMs || Date.now();
  return `/visuals/${clean}?v=${v}`;
}

export function localPath(relativePath) {
  return join(VISUALS_DIR, relativePath);
}

export function writeManifest({ slots, syncedAt, rootFolderId }) {
  mkdirSync(VISUALS_DIR, { recursive: true });
  const payload = {
    syncedAt: syncedAt || new Date().toISOString(),
    rootFolderId: rootFolderId || null,
    slots,
  };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

export function loadStaticSlots() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const slots = manifest.slots || emptySlots();
    if (!slotsHasAny(slots)) return null;
    return {
      slots,
      source: 'static',
      syncedAt: manifest.syncedAt || null,
    };
  } catch {
    return null;
  }
}

/** Verifikasi file manifest masih ada di disk; buang URL orphan. */
export function validateStaticSlots(data) {
  if (!data?.slots) return null;
  const slots = emptySlots();
  for (const [group, entries] of Object.entries(data.slots)) {
    if (!entries || typeof entries !== 'object') continue;
    for (const [key, url] of Object.entries(entries)) {
      if (!url || typeof url !== 'string') continue;
      const pathPart = url.split('?')[0].replace(/^\/visuals\//, '');
      const full = localPath(pathPart);
      if (!existsSync(full)) continue;
      if (!slots[group]) slots[group] = {};
      const mtime = statSync(full).mtimeMs;
      slots[group][key] = staticUrl(pathPart, mtime);
    }
  }
  if (!slotsHasAny(slots)) return null;
  return { slots, source: 'static', syncedAt: data.syncedAt || null };
}
