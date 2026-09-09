import { getPrisma } from '../db.mjs';
import { listFiles, listFolderTree } from '../gdrive.mjs';

/**
 * Audit sinkronisasi DB ↔ Drive: grup & subdivisi pantatugas vs folder aktual.
 * Dipakai route /api/drive/audit dan cron digest (sumber tunggal).
 */
export async function runDriveAudit() {
  const prisma = getPrisma();
  const tree = await listFolderTree(3);
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const byId = new Map(tree.map((f) => [f.id, f]));
  const inheritedTag = (f) => {
    const own = f.name.match(/\[([A-Z][^\]]*)\]/i)?.[1];
    if (own) return own.toUpperCase();
    let p = f.parentId ? byId.get(f.parentId) : null;
    while (p) {
      const t = p.name.match(/\[([A-Z][^\]]*)\]/i)?.[1];
      if (t) return t.toUpperCase();
      p = p.parentId ? byId.get(p.parentId) : null;
    }
    return null;
  };

  // (a) Grup aktif → folder [GROUP:<nama>]
  const groups = await prisma.group.findMany({ where: { status: 'ACTIVE' }, select: { name: true } });
  const groupFolders = tree.filter((f) => /\[GROUP:[^\]]+\]/i.test(f.name));
  const matchedGroupTokens = new Set(
    groupFolders.map((f) => (f.name.match(/\[GROUP:([^\]]+)\]/i)?.[1] || '').trim().toLowerCase())
  );
  const groupAudit = groups.map((g) => ({
    name: g.name,
    ok: matchedGroupTokens.has(g.name.toLowerCase()),
    hint: `[GROUP:${g.name.toUpperCase()}]`,
  }));
  const extraGroups = groupFolders.filter((f) => {
    const tok = (f.name.match(/\[GROUP:([^\]]+)\]/i)?.[1] || '').trim().toLowerCase();
    return !groups.some((g) => g.name.toLowerCase() === tok);
  }).map((f) => f.name);

  // (b) Subdivisi pantatugas → folder di bawah folder induk bernama <Pillar>
  const subs = await prisma.strukturMember.findMany({
    where: { division: { in: ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'] }, NOT: { subdivision: null } },
    select: { division: true, subdivision: true },
  });
  const pillarParents = new Map();
  for (const f of tree) {
    const m = f.name.match(/^(.*?)\s*\[[^\]]+\]$/);
    if (!m) continue;
    const base = norm(m[1]);
    for (const p of ['liturgia', 'didaskalia', 'koinonia', 'diakonia', 'marturia']) {
      if (base === p) {
        if (!pillarParents.has(p)) pillarParents.set(p, new Set());
        break;
      }
    }
  }
  for (const f of tree) {
    if (!f.parentId) continue;
    const parent = tree.find((t) => t.id === f.parentId);
    if (!parent) continue;
    const pm = parent.name.match(/^(.*?)\s*\[[^\]]+\]$/);
    if (!pm) continue;
    const key = norm(pm[1]);
    if (pillarParents.has(key)) pillarParents.get(key).add(norm(f.name.replace(/\[[^\]]+\]/g, '').trim()));
  }
  const seen = new Map();
  for (const s of subs) {
    const key = s.division.toLowerCase();
    const set = seen.get(key) || new Set();
    set.add(norm(s.subdivision));
    seen.set(key, set);
  }
  const pillarAudit = [];
  for (const [pillar, expectedSet] of seen.entries()) {
    const actual = pillarParents.get(pillar) || new Set();
    for (const sub of expectedSet) {
      pillarAudit.push({ pillar, name: sub, ok: actual.has(sub) });
    }
  }

  const untagged = tree.filter((f) => !inheritedTag(f)).map((f) => f.name);

  return {
    totalFoldersScanned: tree.length,
    groups: { items: groupAudit, missing: groupAudit.filter((g) => !g.ok).length },
    pillars: { items: pillarAudit, missing: pillarAudit.filter((p) => !p.ok).length },
    extraGroupFolders: extraGroups,
    untaggedFolders: untagged.slice(0, 30),
  };
}

/** Folder publik = nama mengandung tag [PUBLIK]. */
export async function listPublicFolders() {
  const tree = await listFolderTree(3);
  return tree.filter((f) => /\[PUBLIK\]/i.test(f.name)).map((f) => ({ id: f.id, name: f.name }));
}

/** File di folder publik (id + nama + waktu) untuk deteksi file baru. */
export async function listPublicFiles() {
  const folders = await listPublicFolders();
  const out = [];
  for (const f of folders) {
    try {
      const files = await listFiles({ folderId: f.id, pageSize: 50 });
      out.push({
        folderId: f.id,
        folderName: f.name,
        files: (files || []).map((x) => ({ id: x.id, name: x.name })),
      });
    } catch {
      out.push({ folderId: f.id, folderName: f.name, files: [], error: true });
    }
  }
  return out;
}

/**
 * Bandingkan snapshot drift (murni, teruji unit).
 * prev: snapshot dari digest sebelumnya (atau null). curr: {missing[], extra[], untagged[], publicNew[], tokenOk}.
 * Return item baru saja.
 */
export function diffDrift(prev, curr) {
  const items = [];
  const has = (arr, v) => (arr || []).includes(v);
  for (const m of curr.missing || []) {
    if (!prev || !has(prev.missing, m)) items.push({ kind: 'missing', label: `Folder hilang: ${m}` });
  }
  for (const e of curr.extra || []) {
    if (!prev || !has(prev.extra, e)) items.push({ kind: 'extra', label: `Folder asing/baru: ${e}` });
  }
  for (const u of curr.untagged || []) {
    if (!prev || !has(prev.untagged, u)) items.push({ kind: 'untagged', label: `Tanpa tag zona: ${u}` });
  }
  for (const f of curr.publicNew || []) {
    const seenIds = new Set(((prev && prev.publicFiles) || []).flatMap((x) => (x.files || []).map((y) => y.id)));
    if (!seenIds.has(f.id)) items.push({ kind: 'public-file', label: `File publik baru: ${f.folderName} / ${f.name}` });
  }
  if (prev && prev.tokenOk && curr.tokenOk === false) {
    items.push({ kind: 'token', label: 'Token unggah pemilik terputus (perlu consent ulang).' });
  }
  if (!prev && curr.tokenOk === false) {
    items.push({ kind: 'token', label: 'Token unggah pemilik terputus (perlu consent ulang).' });
  }
  return items;
}
