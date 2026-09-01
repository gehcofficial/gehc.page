import { DriveMediaItem } from '../types';

/**
 * Klien API backend GEHC (Express) — jembatan Google Drive & TiDB Cloud.
 * Base URL dikonfigurasi via VITE_API_BASE_URL (default: /api → proxy Vite ke localhost:8787).
 */
export const API_BASE: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api';

async function getJson<T>(url: string, timeoutMs = 6000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // credentials:'include' — sesi SSO/demo menentukan zona Drive yang boleh diakses
    const res = await fetch(`${API_BASE}${url}`, { signal: ctrl.signal, credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(
        (body as { error?: string }).error || `API ${res.status}`
      ) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface ApiStatus {
  ok: boolean;
  driveConfigured: boolean;
  driveMode: 'service-account' | 'api-key' | null;
  dbConfigured: boolean;
}

export const fetchApiStatus = () =>
  getJson<{ driveConfigured: boolean; driveMode: ApiStatus['driveMode']; dbConnected: boolean }>(
    '/config'
  ).then((r): ApiStatus => ({
    ok: true,
    driveConfigured: r.driveConfigured,
    driveMode: r.driveMode,
    dbConfigured: r.dbConnected,
  }));

export const fetchDriveFiles = (opts: { folderId?: string; pageSize?: number; query?: string } = {}) => {
  const params = new URLSearchParams();
  if (opts.folderId) params.set('folderId', opts.folderId);
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts.query) params.set('q', opts.query);
  return getJson<{ files: DriveMediaItem[] }>(`/drive/files?${params.toString()}`).then((r) => r.files);
};

export const fetchDriveFolders = (parentId?: string) =>
  getJson<{
    folders: {
      id: string;
      name: string;
      mimeType: string;
      filesCount?: number;
      /** false bila zona folder di luar role pengguna (dari gdrive-policy) */
      accessAllowed?: boolean;
      zoneTag?: string | null;
      displayName?: string;
    }[];
  }>(`/drive/folders${parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''}`).then((r) => r.folders);

/** Konten file langsung dari Drive (proxy stream oleh server). */
export const driveFileContentUrl = (fileId: string) => `${API_BASE}/drive/file/${encodeURIComponent(fileId)}/content`;

/** Fallback galeri saat API/backend belum dikonfigurasi — mode demo. */
export const DEMO_MEDIA: DriveMediaItem[] = [
  {
    id: 'demo-1',
    name: 'Ibadah Kreatif Pemuda — Sabtu Malam',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'demo-2',
    name: 'Youth Creative Night "Light in the Valley"',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'demo-3',
    name: 'Retret Pemuda UNSHAKABLE 2026 — Highland Camp',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'demo-4',
    name: 'Sports Cup Antar Kelompok — Futsal Fellowship',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'demo-5',
    name: 'Bakti Sosial Diakonia Cikarang Peduli',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'demo-6',
    name: 'Persekutuan Small Groups — Home Fellowship',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'demo-7',
    name: 'Tim Musik & Worship Ruach',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 'demo-8',
    name: 'Bible Study Intensive — Ruang Multimedia',
    mimeType: 'image/jpeg',
    thumbnailLink:
      'https://images.unsplash.com/photo-1507692049790-de58290a4334?q=80&w=800&auto=format&fit=crop',
  },
];
