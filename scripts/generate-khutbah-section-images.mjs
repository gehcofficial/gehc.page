/**
 * Generate 4 gambar AI kontekstual per bagian khotbah literal W2 2026-10.
 *
 *   node scripts/generate-khutbah-section-images.mjs --target=production [--apply] [--force] [--reuse-json='{"pengantar":"id",...}']
 *
 * Tanpa --apply = dry-run (cek event, kuota, status). --reuse-json = lewati
 * generate, langsung simpan mapping (dipakai untuk staging memakai file prod).
 * Legacy `khutbah` per-slide-index dikosongkan (sudah tak dipakai deck literal;
 * tersimpan di snapshot history settlement).
 */
const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'production';
process.env.GEHC_ENV = targetArg;
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const reuseArg = args.find((a) => a.startsWith('--reuse-json='))?.slice('--reuse-json='.length);
const REUSE = reuseArg ? JSON.parse(reuseArg) : null;
const onlyArg = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const ONLY = onlyArg ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : null;

const { getPrisma, getDbLabel } = await import('../server/db.mjs');
const { getDriveMode, listFolders, createFolder, uploadFile } = await import('../server/gdrive.mjs');
const { generateImageBase64 } = await import('../server/ai-provider.mjs');
const { wibDateOnly } = await import('../server/lib/event-venue.mjs');

const SECTION_LABEL = { pengantar: 'Pengantar', bedahTeologis: 'Bedah Teologis', jembatan: 'Jembatan ke Tema Mingguan', kesimpulan: 'Kesimpulan' };
const SECTIONS = Object.keys(SECTION_LABEL);
const MAX_SLIDE_IMAGES = 8;
const IMAGE_SUBFOLDER = '04 Presentasi';

const prisma = getPrisma();
if (!prisma) { console.error('DATABASE_URL belum dikonfigurasi.'); process.exit(1); }
console.log('Target DB:', getDbLabel(), APPLY ? '(APPLY)' : '(dry-run)');
if (!getDriveMode() && !REUSE) { console.error('Google Drive belum dikonfigurasi.'); await prisma.$disconnect(); process.exit(1); }

const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth: '2026-10' } });
const weeks = plan.weeks.map((w) => ({ ...w }));
const idx = weeks.findIndex((w) => Number(w?.index) === 2);
const week = weeks[idx];
const studio = week.studio || {};
const sermon = studio.sermon || {};
const haveLiteral = studio.presentation?.khutbahLiteral && typeof studio.presentation.khutbahLiteral === 'object' ? { ...studio.presentation.khutbahLiteral } : {};
console.log('Literal existing:', Object.keys(haveLiteral));

const todo = SECTIONS.filter((s) => (!ONLY || ONLY.includes(s)) && (FORCE || !haveLiteral[s]));
console.log('Akan diproses:', todo.length ? todo.join(', ') : '(semua sudah ada)');
if (!todo.length) { await prisma.$disconnect(); process.exit(0); }
if (Object.keys(haveLiteral).length + todo.length > MAX_SLIDE_IMAGES && !REUSE) {
  console.error(`Kuota pekan terlampaui (maks ${MAX_SLIDE_IMAGES}) — batal.`);
  await prisma.$disconnect();
  process.exit(1);
}

let newIds = {};
if (REUSE) {
  newIds = REUSE;
  console.log('Mode reuse — tanpa generate baru.');
} else {
  // Resolve event seperti resolveEventId (tanpa override service).
  const day = new Date('2026-10-11T00:00:00.000Z');
  const rows = await prisma.eventProgram.findMany({
    where: { eventDate: { gte: new Date(day.getTime() - 86400000), lt: new Date(day.getTime() + 2 * 86400000) } },
    select: { id: true, name: true, serviceType: true, eventDate: true },
    orderBy: { eventDate: 'asc' },
  });
  const onDate = rows.filter((r) => { try { return wibDateOnly(r.eventDate) === '2026-10-11'; } catch { return false; } });
  const match = onDate.find((r) => r.serviceType === 'MENTORING_DAY' || r.serviceType === 'SERVING_DAY') || onDate[0];
  if (!match) { console.error('Event 2026-10-11 tidak ditemukan — batal.', JSON.stringify(rows.map((r) => ({ name: r.name, eventDate: r.eventDate, serviceType: r.serviceType })))); await prisma.$disconnect(); process.exit(1); }
  console.log('Event:', match.name, match.serviceType, match.id);

  let division = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId: match.id, division: 'DIDASKALIA' } }, select: { id: true, driveFolderId: true } });
  if (!division?.driveFolderId) {
    const { createEventFolder } = await import('../server/gdrive-events.mjs');
    const ev = await prisma.eventProgram.findUnique({ where: { id: match.id } });
    const fid = ev ? await createEventFolder(ev, 'DIDASKALIA') : null;
    if (fid && division) await prisma.eventDivision.update({ where: { id: division.id }, data: { driveFolderId: fid } }).catch(() => null);
    division = { id: division?.id || null, driveFolderId: fid };
  }
  if (!division?.driveFolderId) { console.error('Folder Drive Didaskalia belum siap — batal.'); await prisma.$disconnect(); process.exit(1); }
  const subs = await listFolders(division.driveFolderId, 100);
  let target = subs.find((f) => String(f.name || '').toLowerCase() === IMAGE_SUBFOLDER.toLowerCase());
  if (!target) target = await createFolder(division.driveFolderId, IMAGE_SUBFOLDER);
  const parentId = target?.id || division.driveFolderId;
  console.log('Folder gambar:', parentId);

  const theme = week.mentoringTheme || week.servingTheme || week.theme || '';
  const safeContext = (text) => String(text || '').replace(/[*_>#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const failures = [];
  for (const section of todo) {
    const sectionText = safeContext(sermon.outline?.[section]);
    const prompt = [
      'Ilustrasi sampul bagian khotbah pemuda Kristen. Komposisi sinematik, kualitas tinggi, artistik.',
      theme ? `Tema minggu: ${theme}. Bagian: ${SECTION_LABEL[section]}.` : `Bagian: ${SECTION_LABEL[section]}.`,
      sectionText ? `Konteks isi: ${sectionText}.` : '',
      'Gaya simbolis yang damai dan penuh harapan; hindari kekerasan, darah, dan figur manusia realistis.',
      'PENTING: JANGAN menulis teks/huruf/angka/watermark apa pun di dalam gambar (teks ditambahkan terpisah sebagai overlay).',
      'Sisakan ruang kosong (negative space) di bagian atas untuk overlay judul.',
      'Warna & suasana selaras tema; relevan untuk pemuda mahasiswa dan pekerja pabrik/kantor di Indonesia.',
    ].filter(Boolean).join(' ');
    if (!APPLY) { console.log(`[dry] ${section}: prompt ${prompt.length} char`); continue; }
    console.log(`Generate [${section}]…`);
    try {
      const img = await generateImageBase64({ prompt, size: '1536x1024', quality: 'medium' });
      const file = await uploadFile(parentId, {
        originalname: `ai-khutbah-2026-10-w2-${section}-${Date.now()}.jpg`,
        mimetype: img.mediaType,
        buffer: Buffer.from(img.base64, 'base64'),
      });
      newIds[section] = file.id;
      console.log(`  OK ${section} → ${file.id} (model ${img.model})`);
    } catch (e) {
      console.error(`  GAGAL ${section}: ${String(e?.message || e).slice(0, 200)}`);
      failures.push(section);
    }
  }
  if (failures.length) console.log('Gagal (tidak disimpan, bisa diulang via --only=):', failures.join(', '));
  console.log('REUSE-JSON:', JSON.stringify({ ...haveLiteral, ...newIds }));
}

if (APPLY) {
  weeks[idx] = {
    ...week,
    studio: {
      ...studio,
      presentation: { ...(studio.presentation || {}), khutbahLiteral: { ...haveLiteral, ...newIds } },
    },
  };
  await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });
  console.log('OK — khutbahLiteral tersimpan.');
} else {
  console.log('Dry-run selesai. Tambahkan --apply untuk menulis.');
}
await prisma.$disconnect();
