/**
 * Vercel GC — hapus deployment yatim dengan aman (default dry-run).
 *
 * Kebijakan hapus (KETAT — semua harus lolos):
 *   1. Umur > --older-than hari (default 14).
 *   2. URL deployment TIDAK muncul di daftar alias mana pun
 *      (sebagai source maupun target) — melindungi branch aktif,
 *      staging, dan production.
 *   3. `vercel remove --safe` sebagai jaring pengaman kedua
 *      (melewati deployment ber-alias penting).
 *   4. UID di --keep selalu dikecualikan.
 *
 * Jalankan:
 *   npm run vercel:gc                        # dry-run (tidak menghapus)
 *   npm run vercel:gc -- --apply              # hapus yang lolos saringan
 *   npm run vercel:gc -- --apply --older-than=30
 *
 * Latar: 5 Okt 2026 storage 9.69/10GB karena 110+ deployment menumpuk
 * (dihapus manual 5 batch). Skrip ini membuat pengecekan jadi rutin.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  if (next === undefined || next.startsWith('--')) return true;
  return next;
};
const APPLY = flag('apply', false) === true || args.includes('--apply');
const OLDER_THAN_DAYS = Number(flag('older-than', 14)) || 14;
const LIMIT = Number(flag('limit', 200)) || 200;
const KEEP = String(flag('keep', '') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

async function vercel(...a) {
  const { stdout } = await execFileAsync(NPX, ['vercel', ...a], {
    maxBuffer: 16 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  return stdout;
}

/** Sama, tapi gabung stdout + stderr (Vercel menulis petunjuk paginasi ke stderr). */
async function vercelFull(...a) {
  const { stdout, stderr } = await execFileAsync(NPX, ['vercel', ...a], {
    maxBuffer: 16 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  return `${stdout}\n${stderr}`;
}

async function listDeployments() {
  const out = await vercel('api', `/v2/deployments?limit=${LIMIT}`);
  const d = JSON.parse(out);
  return d.deployments || [];
}

/** Kumpulkan SEMUA alias (ikuti paginasi --next). Kembalikan set URL yang dirujuk. */
async function referencedUrls() {
  const urls = new Set();
  let next = null;
  for (let page = 0; page < 20; page += 1) {
    // Catatan: paginasi hanya jalan via `alias ls --next` (bukan `alias list --next`
    // yang mengembalikan halaman kosong), dan petunjuknya ada di stderr.
    const out = await vercelFull('alias', 'ls', ...(next ? ['--next', next] : []));
    for (const line of out.split('\n')) {
      for (const m of line.matchAll(/([a-z0-9-]+\.(?:vercel\.app|gehc\.page))/gi)) {
        urls.add(m[1].toLowerCase());
      }
    }
    const nx = out.match(/--next (\d+)/);
    if (!nx) break;
    next = nx[1];
  }
  return urls;
}

const hostOf = (u) => {
  try {
    return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
};

(async () => {
  console.log(`Vercel GC — ambang umur > ${OLDER_THAN_DAYS} hari, mode: ${APPLY ? 'APPLY (menghapus!)' : 'dry-run'}`);
  const [deployments, refs] = await Promise.all([listDeployments(), referencedUrls()]);
  console.log(`Deployment total: ${deployments.length} · URL terproteksi alias: ${refs.size}`);
  const cutoff = Date.now() - OLDER_THAN_DAYS * 24 * 3600 * 1000;
  const candidates = [];
  for (const d of deployments) {
    const ageDays = Math.floor((Date.now() - (d.created || 0)) / 86400000);
    const url = d.url || '';
    const reasons = [];
    if (d.readyState !== 'READY') reasons.push(`state=${d.readyState}`);
    if ((d.created || 0) >= cutoff) reasons.push(`umur ${ageDays}h < ${OLDER_THAN_DAYS}h`);
    if (refs.has(hostOf(url))) reasons.push('dirujuk alias');
    if (KEEP.includes(d.uid)) reasons.push('daftar --keep');
    if (!reasons.length) candidates.push({ uid: d.uid, url, ageDays, created: d.created });
  }
  console.log(`Kandidat hapus: ${candidates.length}`);
  for (const c of candidates) {
    console.log(`  - ${c.uid} ${c.url} (${c.ageDays}h)`);
  }
  if (!candidates.length) {
    console.log('✓ Tidak ada yang perlu dihapus.');
    return;
  }
  if (!APPLY) {
    console.log('Dry-run selesai. Ulangi dengan --apply untuk menghapus.');
    return;
  }
  let ok = 0;
  let fail = 0;
  for (const c of candidates) {
    try {
      await vercel('remove', c.uid, '--safe', '--yes');
      ok += 1;
      console.log(`  ✓ dihapus ${c.uid}`);
    } catch (e) {
      fail += 1;
      console.log(`  ✗ gagal ${c.uid}: ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  console.log(`Selesai: ${ok} dihapus, ${fail} gagal.`);
})().catch((e) => {
  console.error(`Gagal: ${e?.message || e}`);
  process.exit(1);
});
