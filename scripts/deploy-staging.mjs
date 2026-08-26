/**
 * Deploy PREVIEW ke Vercel + pasang alias permanen staging-gehcpage.vercel.app.
 * Jalankan: npm run deploy:staging   (harus sudah `vercel link` & login)
 */
import { execSync } from 'node:child_process';

const ALIAS = 'staging-gehcpage.vercel.app';
const SCOPE = 'gehc';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

console.log('> vercel deploy (preview)…');
let out = '';
for (let attempt = 1; attempt <= 2 && !out; attempt++) {
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
console.log(`> alias → https://${ALIAS} …`);
try {
  run(`vercel alias set ${url} ${ALIAS} --scope ${SCOPE}`);
} catch (e) {
  // Retry sekali — kadang transient (network / token refresh)
  console.warn('  percobaan pertama gagal, mengulang…');
  run(`vercel alias set ${url} ${ALIAS} --scope ${SCOPE}`);
}
console.log(`\n✓ Staging siap : https://${ALIAS}`);