/**
 * Rename folder sub-divisi pillar (best-effort, dipakai migrasi istilah baku).
 * Auth service account — sama seperti server/drive-provision.mjs.
 */
import { readFileSync } from 'node:fs';
import { google } from 'googleapis';

const PILLAR_MATCH = {
  LITURGIA: /^liturgia/i,
  DIDASKALIA: /^didaskalia/i,
  KOINONIA: /^koinonia/i,
  DIAKONIA: /^diakonia/i,
  MARTURIA: /^marturia/i,
  BENZARPR: /benzar/i,
};

function parseInlineJson(raw) {
  const cleaned = String(raw).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return JSON.parse(cleaned);
}

function getDrive() {
  let credentials;
  const errs = [];
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = parseInlineJson(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) { errs.push(`inline: ${e.message}`); }
  }
  if (!credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    } catch (e) { errs.push(`file: ${e.message}`); }
  }
  if (!credentials) {
    throw new Error(`Kredensial service account tidak terbaca (${errs.join('; ') || 'tidak dikonfigurasi'})`);
  }
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GDRIVE_IMPERSONATE || undefined,
  });
  return google.drive({ version: 'v3', auth });
}

async function listFolders(drive, parentId) {
  const out = [];
  let pageToken = null;
  do {
    const r = await drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name),nextPageToken',
      pageSize: 100,
      pageToken,
    });
    out.push(...(r.data.files || []));
    pageToken = r.data.nextPageToken || null;
  } while (pageToken);
  return out;
}

/** Rename subfolder pillar yang bernama tepat oldName → newName. Return jumlah. */
export async function findPillarFolders(renameMap) {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID belum diisi.');
  const drive = getDrive();
  let renamed = 0;
  const roots = await listFolders(drive, rootId);
  const seen = new Set();
  const tryRename = async (siblings, s) => {
    const target = renameMap[s.name];
    if (!target || target === s.name || seen.has(s.id)) return 0;
    seen.add(s.id);
    if (siblings.some((x) => x.name === target)) {
      console.warn(`  ! lewati "${s.name}" — "${target}" sudah ada`);
      return 0;
    }
    await drive.files.update({ fileId: s.id, requestBody: { name: target } });
    console.log(`  ✓ folder "${s.name}" → "${target}"`);
    return 1;
  };
  for (const [, match] of Object.entries(PILLAR_MATCH)) {
    const pillar = roots.find((f) => match.test(f.name || ''));
    if (!pillar) continue;
    // Cari 2 tingkat (subdivisi bisa di bawah folder operasional).
    const level1 = await listFolders(drive, pillar.id);
    for (const s of level1) renamed += await tryRename(level1, s);
    for (const l1 of level1) {
      const level2 = await listFolders(drive, l1.id).catch(() => []);
      for (const s of level2) renamed += await tryRename(level2, s);
    }
  }
  return renamed;
}
