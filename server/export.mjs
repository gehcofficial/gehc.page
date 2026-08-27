// Warta Publik Export: Generate PDF & PNG from warta content
// Uses puppeteer for PDF/PNG generation (server-side)

import puppeteer from 'puppeteer';

// HTML template for Warta PDF
function generateWartaHTML(warta, options = {}) {
  const { includeStyles = true } = options;
  const weekDate = new Date(warta.weekDate).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  
  const content = warta.contentJson || {};
  const sections = [
    { key: 'khotbah', label: 'Khotbah', icon: '📖' },
    { key: 'pelayanan', label: 'Pelayanan', icon: '🙏' },
    { key: 'sharing', label: 'Sharing & Testimoni', icon: '💬' },
    { key: 'doa', label: 'Doa Penutup', icon: '🕊️' },
    { key: 'pengumuman', label: 'Pengumuman', icon: '📢' },
    { key: 'jadwal', label: 'Jadwal Minggu Depan', icon: '📅' },
  ];

  const style = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #FAF9F5; color: #1B1B1B; line-height: 1.6; }
      .page { max-width: 700px; margin: 0 auto; padding: 40px 30px; background: white; }
      .header { text-align: center; border-bottom: 3px solid #F6AE4A; padding-bottom: 20px; margin-bottom: 30px; }
      .logo { width: 60px; height: 60px; border-radius: 12px; background: linear-gradient(135deg, #F6AE4A, #E89B3A); display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 28px; margin-bottom: 12px; }
      .title { font-size: 28px; font-weight: 800; color: #1B1B1B; margin-bottom: 4px; }
      .subtitle { color: #8C8880; font-size: 14px; }
      .week-info { display: inline-flex; align-items: center; gap: 8px; background: #FFF3E0; color: #E65100; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 12px; }
      .section { margin-bottom: 24px; page-break-inside: avoid; }
      .section-title { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; color: #1B1B1B; border-bottom: 1px solid #E8E5DD; padding-bottom: 8px; margin-bottom: 12px; }
      .section-icon { font-size: 20px; color: #F6AE4A; }
      .content-text { font-size: 14px; color: #3D3A35; white-space: pre-wrap; line-height: 1.7; }
      .empty-section { color: #D9D7D0; font-style: italic; font-size: 13px; text-align: center; padding: 20px; background: #FAF9F5; border-radius: 8px; }
      .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E8E5DD; text-align: center; font-size: 11px; color: #8C8880; }
      .footer-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
      .footer-item { display: flex; flex-direction: column; gap: 2px; }
      .footer-label { font-weight: 700; text-transform: uppercase; font-size: 9px; color: #D9D7D0; }
      .footer-value { font-size: 10px; }
      @media print { .page { box-shadow: none; } }
      @media screen and (max-width: 768px) { .page { padding: 20px 16px; } }
    </style>
  `;

  const sectionHtml = sections.map(s => {
    const text = content[s.key];
    if (!text || !text.trim()) return '';
    return `
      <div class="section">
        <div class="section-title"><span class="section-icon">${s.icon}</span>${s.label}</div>
        <div class="content-text">${escapeHtml(text)}</div>
      </div>
    `;
  }).filter(Boolean).join('');

  const footerHtml = `
    <div class="footer-grid">
      <div class="footer-item"><span class="footer-label">Warta</span><span class="footer-value">${warta.title}</span></div>
      <div class="footer-item"><span class="footer-label">Tanggal</span><span class="footer-value">${weekDate}</span></div>
      <div class="footer-item"><span class="footer-label">Status</span><span class="footer-value">${warta.status}</span></div>
    </div>
    <div>GEHC Youth Portal • Generated ${new Date().toLocaleDateString('id-ID')}</div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${warta.title}</title>
      ${style}
    </head>
    <body>
      <div class="page">
        <header class="header">
          <div class="logo">G</div>
          <h1 class="title">${warta.title}</h1>
          <p class="subtitle">GMIM Eben Haezer Cikarang Youth</p>
          <div class="week-info">${weekDate}</div>
        </header>
        <main>
          ${sectionHtml || '<div class="empty-section">Konten warta belum diisi</div>'}
        </main>
        <footer class="footer">${footerHtml}</footer>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// Generate PDF buffer
export async function generateWartaPDF(warta) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(generateWartaHTML(warta), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });
    return pdf;
  } finally {
    if (browser) await browser.close();
  }
}

// Generate PNG buffer (for social media)
export async function generateWartaPNG(warta, options = {}) {
  const { width = 1080, height = 1920 } = options; // Instagram story ratio
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(generateWartaHTML(warta, { includeStyles: true }), { waitUntil: 'networkidle0' });
    const png = await page.screenshot({ type: 'png', fullPage: true });
    return png;
  } finally {
    if (browser) await browser.close();
  }
}

// API handler: GET /api/warta/:id/export?format=pdf|png
export async function handleWartaExport(req, res, prisma) {
  const { id } = req.params;
  const { format = 'pdf' } = req.query;

  const warta = await prisma.wartaPublik.findUnique({ where: { id } });
  if (!warta) return res.status(404).json({ error: 'Warta tidak ditemukan' });

  try {
    if (format === 'png') {
      const png = await generateWartaPNG(warta);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="warta-${id}.png"`);
      return res.send(png);
    } else {
      const pdf = await generateWartaPDF(warta);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="warta-${id}.pdf"`);
      return res.send(pdf);
    }
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: 'Gagal generate export', detail: err.message });
  }
}

// API handler: GET /api/warta/:id/preview - returns HTML for iframe preview
export async function handleWartaPreview(req, res, prisma) {
  const { id } = req.params;
  const warta = await prisma.wartaPublik.findUnique({ where: { id } });
  if (!warta) return res.status(404).json({ error: 'Warta tidak ditemukan' });
  res.setHeader('Content-Type', 'text/html');
  res.send(generateWartaHTML(warta));
}