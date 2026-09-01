import { google } from 'googleapis';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_WRITE_SCOPE   = 'https://www.googleapis.com/auth/drive';

function getDriveScope() {
  return process.env.GDRIVE_WRITE === '1' ? DRIVE_WRITE_SCOPE : DRIVE_READONLY_SCOPE;
}

/**
 * Dua mode koneksi Google Drive:
 * 1. Service Account (rekomendasi) — share folder Drive GEHC ke email service account.
 *    Env: GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON) atau GOOGLE_APPLICATION_CREDENTIALS (path file),
 *         opsional GDRIVE_IMPERSONATE untuk domain-wide delegation.
 * 2. API Key — hanya untuk folder publik.
 *    Env: GDRIVE_API_KEY
 */
export function getDriveMode() {
  if (
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  ) {
    return 'service-account';
  }
  if (process.env.GDRIVE_API_KEY) {
    return 'api-key';
  }
  return null;
}

let cachedClient = null;

async function getDrive() {
  if (cachedClient) return cachedClient;

  const mode = getDriveMode();
  if (!mode) throw new Error('Google Drive belum dikonfigurasi pada environment server.');

  if (mode === 'service-account') {
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else {
      const { readFileSync } = await import('node:fs');
      credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [getDriveScope()],
      subject: process.env.GDRIVE_IMPERSONATE || undefined,
    });
    cachedClient = google.drive({ version: 'v3', auth });
  } else {
    // API key string dipakai langsung sebagai auth sederhana
    cachedClient = google.drive({ version: 'v3', auth: process.env.GDRIVE_API_KEY });
  }

  return cachedClient;
}

function mapFile(file) {
  // Drive memberi thumbnail ±220px (=s220) → buram bila diregangkan.
  // lh3.googleusercontent.com mendukung parameter ukuran: naikkan ke 1200px
  // (tetap disajikan CDN Google — cepat & tanpa biaya bandwidth kita).
  const hiRes = (file.thumbnailLink || '').replace(/=s\d+.*$/, '=s1200');
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    thumbnailLink: file.thumbnailLink,
    thumbnailUrl: file.thumbnailLink ? hiRes : undefined,
    webViewLink: file.webViewLink,
    iconLink: file.iconLink,
    createdTime: file.createdTime,
  };
}

// ---------- Cache TTL in-memory utk listing (hemat kuota & latensi) ----------
// Serverless instance hidup beberapa menit — kunjungan berulang instan.
// Redis/Upstash baru dipertimbangkan bila trafik multi-instance naik (roadmap 27).
const LIST_TTL_MS = 90_000;
const listCache = new Map(); // key -> { at, data }
function withCache(key, fn) {
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_TTL_MS) return Promise.resolve(hit.data);
  return Promise.resolve()
    .then(fn)
    .then((data) => {
      listCache.set(key, { at: Date.now(), data });
      if (listCache.size > 100) {
        // buang entri tertua agar memori tetap ramping
        const oldest = listCache.keys().next().value;
        listCache.delete(oldest);
      }
      return data;
    });
}
export function clearListCache() {
  listCache.clear();
}

export async function listFolders(parentId, pageSize = 50) {
  const drive = await getDrive();
  const target = parentId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root';
  const key = `folders:${target}:${pageSize}`;
  return withCache(key, async () => {
    const res = await drive.files.list({
      q: `'${target}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      pageSize: Math.min(pageSize, 100),
      orderBy: 'name',
      fields: 'nextPageToken, files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return res.data.files || [];
  });
}

export async function listFiles({ folderId, query, pageSize = 24 } = {}) {
  const drive = await getDrive();
  const target = folderId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

  let q = `'${target}' in parents and trashed = false`;
  if (query) q += ` and name contains '${query.replace(/'/g, "\\'")}'`;

  const key = `files:${target}:${pageSize}:${query || ''}`;
  return withCache(key, async () => {
    const res = await drive.files.list({
      q,
      pageSize: Math.min(pageSize, 50),
      orderBy: 'createdTime desc',
      fields:
        'nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, iconLink, createdTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return (res.data.files || []).map(mapFile);
  });
}

export async function getFileStream(fileId) {
  const drive = await getDrive();
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  });
  const content = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return { meta: meta.data, stream: content.data };
}

// ---------- Policy support: rantai folder & audit ----------

const ROOT_ID = () => process.env.GDRIVE_ROOT_FOLDER_ID || 'root';
const chainCache = new Map(); // id → [{id,name}] (anak root → folder tsb)
const CHAIN_TTL = 5 * 60 * 1000;

/**
 * Rantai folder dari anak-root hingga folderId (inklusif).
 * Berhenti saat mencapai root Drive GEHC (tidak naik di atasnya).
 */
export async function getFolderChain(folderId) {
  const cached = chainCache.get(folderId);
  if (cached && Date.now() - cached.at < CHAIN_TTL) return cached.chain;

  const drive = await getDrive();
  const root = ROOT_ID();
  const chain = [];
  let cur = folderId;
  for (let i = 0; i < 12; i++) {
    if (!cur || cur === root) break;
    const res = await drive.files.get({
      fileId: cur,
      fields: 'id, name, parents',
      supportsAllDrives: true,
    });
    chain.unshift({ id: res.data.id, name: res.data.name });
    cur = res.data.parents?.[0];
  }
  chainCache.set(folderId, { at: Date.now(), chain });
  return chain;
}

/** BFS terbatas untuk audit: semua folder sampai kedalaman tertentu. */
export async function listFolderTree(maxDepth = 3) {
  const drive = await getDrive();
  const out = []; // {id,name,parentId,depth}
  let frontier = [{ id: ROOT_ID(), depth: 0 }];
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      if (node.depth >= maxDepth) continue;
      try {
        const folders = await listFolders(node.id, 100);
        for (const f of folders) {
          const entry = { id: f.id, name: f.name, parentId: node.id === ROOT_ID() ? null : node.id, depth: node.depth + 1 };
          out.push(entry);
          next.push({ id: f.id, depth: entry.depth });
        }
      } catch {
        // folder tak terlihat oleh SA — lewati
      }
    }
    frontier = next;
  }
  return out;
}

export async function testConnection() {
  const drive = await getDrive();
  await drive.files.list({ pageSize: 1, fields: 'files(id)' });
  return true;
}

// ---------- Write operations (requires GDRIVE_WRITE=1) ----------

/**
 * Create a new folder under parentId.
 */
export async function createFolder(parentId, name) {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root'],
    },
    fields: 'id, name, mimeType, createdTime',
    supportsAllDrives: true,
  });
  clearListCache();
  return res.data;
}

/**
 * Upload a file to a folder.
 * @param {string} parentId - Target folder ID
 * @param {object} file - { filename, mimetype, buffer } (from multer/memoryStorage)
 * @returns {object} Created file metadata
 */
export async function uploadFile(parentId, file) {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: {
      name: file.originalname || file.filename,
      parents: [parentId || process.env.GDRIVE_ROOT_FOLDER_ID || 'root'],
    },
    media: {
      mimeType: file.mimetype || 'application/octet-stream',
      body: file.buffer ? require('stream').Readable.from(file.buffer) : file.stream,
    },
    fields: 'id, name, mimeType, thumbnailLink, webViewLink, createdTime, size',
    supportsAllDrives: true,
  });
  clearListCache();
  return mapFile(res.data);
}

/**
 * Delete a file/folder by ID.
 */
export async function deleteFile(fileId) {
  const drive = await getDrive();
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
  clearListCache();
  return true;
}

/**
 * Get file metadata by ID.
 */
export async function getFileInfo(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink, parents',
    supportsAllDrives: true,
  });
  return res.data;
}
