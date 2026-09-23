/**
 * Selaraskan STAGING dengan main dalam satu perintah.
 *
 *   npm run staging:sync                 # branch + deploy + alias + verifikasi
 *   npm run staging:sync -- --branch-only  # hanya push main → staging
 *   npm run staging:sync -- --no-deploy    # branch + verifikasi saja
 *   npm run staging:sync -- --no-verify
 *
 * Latar belakang: `deploy:staging` memasang alias ke hasil `vercel deploy`
 * dari ISI WORKING TREE (bukan git otomatis), jadi staging mudah tertinggal.
 * Skrip ini mengurutkan: (1) fast-forward branch `staging` = main,
 * (2) deploy preview + pasang alias (dengan retry — jaringan sering gagal),
 * (3) bandingkan /api/version staging vs main.
 */
import { execSync } from 'node:child_process';

const ALIAS = 'staging-gehcpage.vercel.app';
const SCOPE = 'gehc';
const STAGING_URL = `https://${ALIAS}`;
const MAIN_URL = 'https://youth.gehc.page';

const args = process.argv.slice(2);
const BRANCH_ONLY = args.includes('--branch-only');
const NO_DEPLOY = args.includes('--no-deploy') || BRANCH_ONLY;
const NO_VERIFY = args.includes('--no-verify');

function run(cmd, { capture = true } = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
}

function tryRun(cmd, attempts = 1, label = cmd) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return run(cmd);
    } catch (e) {
      console.warn(`  ${label} — percobaan ${i}/${attempts} gagal: ${String(e.message || e).slice(0, 140)}`);
      if (i < attempts) execSync('node -e "setTimeout(()=>{}, 4000)"');
    }
  }
  return '';
}

async function fetchCommit(base) {
  try {
    const r = await fetch(`${base}/api/version`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.commit || null;
  } catch {
    return null;
  }
}

console.log('─'.repeat(60));
console.log('1) Sinkronkan branch git  main → staging');
console.log('─'.repeat(60));
const dirty = run('git status --porcelain', { capture: true }).trim();
if (dirty) console.warn('  ! Working tree belum bersih — commit dulu agar staging = main.');
const ahead = run('git rev-list --count staging..main', { capture: true }).trim();
console.log(`  commit main yang belum ada di staging: ${ahead}`);
const pushOut = tryRun('git push origin main:staging', 2, 'git push');
console.log(pushOut.trim() || '  (tidak ada output)');

if (BRANCH_ONLY) {
  console.log('\nSelesai (--branch-only).');
  process.exit(0);
}

console.log('\n' + '─'.repeat(60));
console.log('2) Deploy preview + pasang alias staging');
console.log('─'.repeat(60));
if (NO_DEPLOY) {
  console.log('  dilewati (--no-deploy)');
} else {
  let url = '';
  for (let i = 1; i <= 5 && !url; i += 1) {
    console.log(`  vercel deploy — percobaan ${i}/5…`);
    try {
      const out = run('vercel.cmd deploy --yes');
      const urls = [...out.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/g)].map((m) => m[0]);
      url = urls[urls.length - 1] || '';
    } catch (e) {
      console.warn(`    gagal: ${String(e.message || e).slice(0, 120)}`);
    }
    if (!url) execSync('node -e "setTimeout(()=>{}, 5000)"');
  }
  if (!url) {
    console.error('  Deploy gagal setelah 5 percobaan. Coba lagi nanti (jaringan), atau deploy dari dashboard Vercel.');
    process.exit(1);
  }
  console.log(`  deployment: ${url}`);
  tryRun(`vercel.cmd alias set ${url} ${ALIAS} --scope ${SCOPE}`, 2, 'vercel alias set');
  console.log(`  alias → https://${ALIAS}`);
}

if (NO_VERIFY) {
  console.log('\nSelesai (--no-verify).');
  process.exit(0);
}

console.log('\n' + '─'.repeat(60));
console.log('3) Verifikasi /api/version staging vs main');
console.log('─'.repeat(60));
const mainCommit = await fetchCommit(MAIN_URL);
console.log(`  main   : ${mainCommit || '(tidak terbaca)'}`);
let ok = false;
for (let i = 1; i <= 12; i += 1) {
  const stagingCommit = await fetchCommit(STAGING_URL);
  const match = Boolean(stagingCommit && mainCommit && stagingCommit.startsWith(mainCommit.slice(0, 7)));
  console.log(`  staging: ${stagingCommit || '(tidak terbaca)'}${match ? '  ✓ sama' : ''}`);
  if (match) { ok = true; break; }
  await new Promise((r) => setTimeout(r, 10000));
}
console.log(ok ? '\n✓ Staging selaras dengan main.' : '\n! Staging belum sama dengan main (periksa deploy/alias).');
process.exit(ok ? 0 : 1);
