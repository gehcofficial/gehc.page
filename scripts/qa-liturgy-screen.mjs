/**
 * QA visual rute layar/kontrol tata ibadah (anti-regresi React #306).
 * Buka kedua rute tanpa login → harus tampil (form kode / panel kontrol),
 * bukan "Portal gagal dimuat".
 *
 * Jalankan (dev server dulu: npm run dev:all):
 *   node scripts/qa-liturgy-screen.mjs --base http://localhost:3000
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const BASE = String(flag('base', 'http://localhost:3000')).replace(/\/+$/, '');
const KEY = String(flag('key', 'qa-event-dummy'));

let pass = 0;
const ok = (label, cond) => {
  pass += cond ? 1 : 0;
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) throw new Error(`GAGAL: ${label}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message || e)));

  // 1. Layar tanpa login → form kode proyektor (bukan boundary error).
  await page.goto(`${BASE}/#/ibadah/${KEY}/layar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const layarText = await page.content();
  ok('layar: tanpa React #306', !layarText.includes('Minified React error'));
  ok('layar: tanpa "Portal gagal dimuat"', !layarText.includes('Portal gagal dimuat'));
  ok('layar: form kode proyektor tampil', layarText.includes('Layar Tata Ibadah'));
  ok('layar: tombol Portal Liturgia ada', layarText.includes('Portal Liturgia'));

  // 2. Kontrol tanpa login → panel kontrol + pesan login (bukan boundary).
  await page.goto(`${BASE}/#/ibadah/${KEY}/kontrol`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const kontrolText = await page.content();
  ok('kontrol: tanpa React #306', !kontrolText.includes('Minified React error'));
  ok('kontrol: tanpa "Portal gagal dimuat"', !kontrolText.includes('Portal gagal dimuat'));
  ok('kontrol: panel kontrol tampil', kontrolText.includes('Kontrol Tata Ibadah'));
  ok('kontrol: tombol Portal Liturgia ada', kontrolText.includes('Portal Liturgia'));

  await browser.close();
  console.log(`\n✓ QA LAYAR LULUS (${pass} cek).`);
})().catch((e) => {
  console.error(`\n✗ QA GAGAL: ${e.message}`);
  process.exit(1);
});
