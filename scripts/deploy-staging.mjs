/**
 * Deploy PREVIEW ke Vercel + pasang alias staging (hub + unit).
 * Jalankan: npm run deploy:staging   (harus sudah `vercel link` & login)
 *
 * Alias: staging.gehc.page + staging-<unit>.gehc.page (+ legacy vercel.app).
 * Daftar host ada di scripts/staging-hosts.mjs.
 */
import { execSync } from 'node:child_process';
import { ALL_STAGING_ALIASES, STAGING_HUB_HOST } from './staging-hosts.mjs';

const SCOPE = 'gehc';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

console.log('> vercel deploy (preview)…');
let out = '';
for (let attempt = 1; attempt <= 5 && !out; attempt++) {
  try {
    out = run('vercel.cmd deploy');
  } catch (e) {
    console.warn(`  percobaan ${attempt} gagal:`, e.message?.slice(0, 120));
  }
}
if (!out) process.exit(1);
const urls = [...out.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/g)].map((m) => m[0]);
const url = urls[urls.length - 1];
if (!url) {
  console.error('URL deployment tidak ditemukan di output vercel.');
  process.exit(1);
}
console.log(`> deployment : ${url}`);

for (const alias of ALL_STAGING_ALIASES) {
  console.log(`> alias → https://${alias} …`);
  try {
    run(`vercel alias set ${url} ${alias} --scope ${SCOPE}`);
  } catch (e) {
    // Retry sekali — kadang transient (network / token refresh)
    console.warn(`  ${alias} gagal, mengulang… (${e.message?.slice(0, 80)})`);
    try {
      run(`vercel alias set ${url} ${alias} --scope ${SCOPE}`);
    } catch (e2) {
      console.warn(`  ! ${alias} gagal: ${e2.message?.slice(0, 120)}`);
    }
  }
}

console.log(`\n✓ Staging siap : https://${STAGING_HUB_HOST}`);
console.log(`  Unit: ${ALL_STAGING_ALIASES.filter((h) => h !== STAGING_HUB_HOST).join(', ')}`);
