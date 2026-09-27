/**
 * P8 — Renderer PDF laporan (pdfkit) + penyusun section (murni).
 */
import PDFDocument from 'pdfkit';

export const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const BIPRA_LABEL = { BAPAK: 'Kaum Bapa', IBU: 'Kaum Ibu', PEMUDA: 'Pemuda', REMAJA: 'Remaja', ANAK: 'Anak' };
const d10 = (v) => (v ? String(v).slice(0, 10) : '');

// ---------- Penyusun section (murni, mudah diuji) ----------
export function kasSections(d) {
  return [
    { heading: 'Ringkasan', fields: [['Total Masuk', rupiah(d.totals.in)], ['Total Keluar', rupiah(d.totals.out)], ['Saldo', rupiah(d.totals.balance)]] },
    { heading: 'Saldo per Akun', table: { columns: ['Akun', 'Unit', 'Masuk', 'Keluar', 'Saldo'], rows: d.accounts.map((a) => [a.name, a.unit, rupiah(a.in), rupiah(a.out), rupiah(a.balance)]) } },
    { heading: 'Transaksi', table: { columns: ['Tanggal', 'Akun', 'Arah', 'Jumlah', 'Kategori'], rows: d.transactions.slice(0, 60).map((t) => [d10(t.occurredAt), t.accountName, t.direction === 'IN' ? 'Masuk' : 'Keluar', rupiah(t.amount), t.category]) } },
    { heading: 'Pengesahan', fields: [['Bendahara', '________________'], ['Ketua BPMJ', '________________']] },
  ];
}

export function facilitySections(d) {
  return [
    { heading: 'Ringkasan', fields: [['Pendapatan Sewa', rupiah(d.revenue)], ['Jumlah Booking', String(d.bookings.length)]] },
    { heading: 'Booking per Status', table: { columns: ['Status', 'Jumlah'], rows: d.counts.map((c) => [c.status, String(c.count)]) } },
    { heading: 'Fasilitas Terpopuler', table: { columns: ['Fasilitas', 'Booking'], rows: d.topFacilities.map((f) => [f.name, String(f.count)]) } },
    { heading: 'Daftar Booking', table: { columns: ['Mulai', 'Fasilitas', 'Keperluan', 'Unit', 'Status'], rows: d.bookings.slice(0, 60).map((b) => [d10(b.startAt), b.facility || '', b.title, b.unit, b.status]) } },
  ];
}

export function bpmjSections(d) {
  return [
    { heading: 'Anggota Jemaat', fields: [['Total', String(d.members.total)], ['Kolom terisi', String(d.members.byKolom)]], bullets: d.members.byBipra.map((b) => `${BIPRA_LABEL[b.bipra || ''] || b.bipra || 'Belum ditempatkan'}: ${b.count}`) },
    { heading: 'Keuangan & BZP', fields: [['Saldo kas', rupiah(d.finance.cashTotal)], ['BZP lunas', rupiah(d.finance.bzpPaid)], ['Booking aktif', String(d.finance.openBookings)], ['Pengajuan aktif', String(d.finance.openFunding)]] },
    { heading: 'Operasional', fields: [['Insiden terbuka', String(d.security.openIncidents)], ['Petugas mendatang', String(d.duties.upcoming)], ['Campaign aktif', String(d.campaigns.length)]] },
    { heading: 'Info & Peluang Terbaru', bullets: d.recentWarta.length ? d.recentWarta.map((w) => `${w.title} (${w.status})`) : ['Belum ada warta.'] },
  ];
}

export function unitSections(d) {
  return [
    { heading: 'Profil Unit', fields: [['Unit', d.unitLabel], ['Anggota', String(d.memberCount)]] },
    { heading: 'Kas Unit', table: { columns: ['Akun', 'Saldo'], rows: d.cash.map((c) => [c.name, rupiah(c.balance)]) } },
    { heading: 'Kegiatan', table: { columns: ['Tanggal', 'Kegiatan', 'Status'], rows: d.events.map((e) => [d10(e.startDate), e.name, e.status]) } },
    { heading: 'Petugas Mendatang', table: { columns: ['Tanggal', 'Peran', 'Petugas', 'Status'], rows: d.duties.map((x) => [d10(x.date), x.role || '', x.user || '', x.status]) } },
  ];
}

// ---------- Renderer ----------
function drawTable(doc, table) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = width / table.columns.length;
  const bottom = doc.page.height - doc.page.margins.bottom;
  doc.font('Helvetica-Bold').fontSize(9);
  table.columns.forEach((c, i) => doc.text(String(c), left + i * colW, doc.y, { width: colW - 6 }));
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9);
  for (const row of table.rows) {
    const cells = table.columns.map((_, i) => (row[i] == null ? '' : String(row[i])));
    const heights = cells.map((c) => doc.heightOfString(c, { width: colW - 6 }));
    const rowH = Math.max(12, ...heights);
    if (doc.y + rowH > bottom) {
      doc.addPage();
      doc.font('Helvetica').fontSize(9);
    }
    const y = doc.y;
    cells.forEach((c, i) => doc.text(c, left + i * colW, y, { width: colW - 6 }));
    doc.y = y + rowH + 4;
  }
}

/** Tulis laporan sebagai PDF ke response. */
export function streamReportPdf(res, { title, subtitle, sections, filename }) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: title } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(20).text(title);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor('#555').text('GMIM Eben Haezer Cikarang');
  if (subtitle) doc.text(subtitle);
  doc.fillColor('#000').moveDown(0.6);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#999').stroke();
  doc.moveDown(0.6);

  for (const s of sections || []) {
    if (s.heading) {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111').text(s.heading);
      doc.moveDown(0.3);
    }
    for (const [label, value] of s.fields || []) {
      doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(String(value));
    }
    for (const b of s.bullets || []) {
      doc.font('Helvetica').fontSize(10).text(`• ${b}`);
    }
    if (s.table) drawTable(doc, s.table);
    doc.moveDown(0.8);
  }

  doc.font('Helvetica').fontSize(8).fillColor('#888');
  doc.text(`Dicetak ${new Date().toISOString().slice(0, 10)} · gehc.page`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 8, { align: 'right', width: doc.page.width - doc.page.margins.left - doc.page.margins.right });

  doc.end();
}
