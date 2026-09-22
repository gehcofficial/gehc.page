/**
 * Render slide presentasi GEHC.page untuk ProPresenter.
 *
 * Menghasilkan 4 PNG 1920×1080 di `public/presenter/`:
 *   01-hub-depan.png   02-hub-qr.png   03-youth-depan.png   04-youth-qr.png
 *
 * Langkah:
 *   1. Siapkan aset: screenshot live gehc.page & youth.gehc.page (opsional refresh)
 *   2. Perbesar QR (nearest-neighbor + quiet zone) dengan sharp
 *   3. Render tiap template HTML pada viewport 1920×1080
 *   4. Verifikasi QR hasil perbesaran masih bisa di-decode (jsqr)
 *
 * Pemakaian:
 *   node scripts/render-slides.mjs              # pakai screenshot yang ada
 *   node scripts/render-slides.mjs --refresh    # ambil ulang screenshot live
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const jsQR = require('jsqr');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SLIDES_DIR = path.join(ROOT, 'scripts', 'slides');
const ASSETS_DIR = path.join(SLIDES_DIR, 'assets');
const OUT_DIR = path.join(ROOT, 'public', 'presenter');

const WIDTH = 1920;
const HEIGHT = 1080;
const REFRESH = process.argv.includes('--refresh');

const QR_SOURCES = [
  { src: path.join(ROOT, 'public', 'media', 'qr-hub.png'), out: 'qr-hub-large.png', label: 'gehc.page' },
  { src: path.join(ROOT, 'public', 'media', 'qr-daftar-youth.png'), out: 'qr-youth-large.png', label: 'youth.gehc.page' },
];

const SHOTS = [
  { url: 'https://gehc.page', out: 'hub-desktop.png', label: 'gehc.page' },
  { url: 'https://youth.gehc.page', out: 'youth-desktop.png', label: 'youth.gehc.page' },
];

const TEMPLATES = [
  { html: '01-hub-depan.html', out: '01-hub-depan.png' },
  { html: '02-hub-qr.html', out: '02-hub-qr.png' },
  { html: '03-youth-depan.html', out: '03-youth-depan.png' },
  { html: '04-youth-qr.html', out: '04-youth-qr.png' },
];

function ensureDirs() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function loadData() {
  return JSON.parse(fs.readFileSync(path.join(SLIDES_DIR, 'slides-data.json'), 'utf8'));
}

/** Ganti token {{a.b.0}} dari data JSON. */
function renderTokens(html, data) {
  return html.replace(/\{\{([^}]+)\}\}/g, (_m, expr) => {
    const value = expr
      .trim()
      .split('.')
      .reduce((acc, key) => (acc == null ? acc : acc[key]), data);
    if (value == null) throw new Error(`Token tidak ditemukan di slides-data.json: {{${expr}}}`);
    return String(value);
  });
}

/** Screenshot halaman live pada viewport laptop (dipakai di mockup). */
async function captureScreenshots(browser) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const shot of SHOTS) {
    const target = path.join(ASSETS_DIR, shot.out);
    if (fs.existsSync(target) && !REFRESH) {
      console.log(`• screenshot ${shot.out} sudah ada (lewati; pakai --refresh untuk ambil ulang)`);
      continue;
    }
    console.log(`• mengambil screenshot ${shot.url} …`);
    await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.addStyleTag({
      content: `
        *, *::before, *::after { animation: none !important; transition: none !important; }
        html { scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
      `,
    });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: target, type: 'png' });
    console.log(`  ✓ ${shot.out}`);
  }

  await page.close();
}

/** Perbesar QR (nearest-neighbor agar modul tetap tajam) + quiet zone. */
async function buildQrAssets() {
  for (const qr of QR_SOURCES) {
    const outPath = path.join(ASSETS_DIR, qr.out);
    const meta = await sharp(qr.src).metadata();
    const size = 1100;
    const quiet = Math.round(size * 0.08);
    await sharp(qr.src)
      .resize(size, size, { kernel: 'nearest' })
      .extend({ top: quiet, bottom: quiet, left: quiet, right: quiet, background: '#FFFFFF' })
      .png()
      .toFile(outPath);
    console.log(`• QR ${qr.label}: ${meta.width}px → ${size}px + quiet zone ${quiet}px`);

    const { data, info } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (!code) throw new Error(`QR ${qr.out} tidak terbaca setelah diperbesar — periksa quiet zone.`);
    console.log(`  ✓ terverifikasi → ${code.data}`);
  }
}

/** Render setiap template HTML → PNG 1920×1080. */
async function renderSlides(browser, data) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  for (const tpl of TEMPLATES) {
    const htmlPath = path.join(SLIDES_DIR, tpl.html);
    const raw = fs.readFileSync(htmlPath, 'utf8');
    const html = renderTokens(raw, data);

    // Token sudah diganti → tulis ke file sementara agar aset relatif tetap valid.
    const tmpPath = path.join(SLIDES_DIR, `.build-${tpl.html}`);
    fs.writeFileSync(tmpPath, html, 'utf8');

    await page.goto(`file://${tmpPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(600);

    const outPath = path.join(OUT_DIR, tpl.out);
    await page.screenshot({ path: outPath, type: 'png' });
    fs.unlinkSync(tmpPath);

    const { width, height } = await sharp(outPath).metadata();
    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`  ✓ ${tpl.out} (${width}×${height}, ${kb} KB)`);
  }

  await page.close();
}

async function main() {
  ensureDirs();
  const data = loadData();
  console.log('▸ Menyiapkan aset slide…');

  const browser = await chromium.launch();
  try {
    await captureScreenshots(browser);
    await buildQrAssets();
    console.log('▸ Merender slide 1920×1080…');
    await renderSlides(browser, data);
  } finally {
    await browser.close();
  }

  console.log(`\n✓ Selesai — 4 PNG di public/presenter/ (data per ${data.snapshotDate})`);
}

main().catch((err) => {
  console.error('\n✗ Gagal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
