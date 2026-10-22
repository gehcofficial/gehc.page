/**
 * Rapikan naskah tim ke markdown standar + koreksi ejaan + usulan bahasa inklusif.
 * Ayat dan makna teologis tidak boleh ditambah atau diubah. Hasil = usulan untuk ditinjau.
 */
import { z } from 'zod';
import { jethroGenerateObject } from '../ai-provider.mjs';
import { guardNormalized, prepareSourceText } from './didaskalia-md.mjs';

const ChangeSchema = z.object({
  kind: z.enum(['format', 'ejaan', 'inklusi']),
  location: z.string(),
  before: z.string(),
  after: z.string(),
  note: z.string(),
});

const NormalizeSchema = z.object({
  normalized: z.string(),
  changes: z.array(ChangeSchema).max(30),
});

const SYSTEM = [
  'Kamu menyunting naskah kurikulum pemuda gereja supaya rapi dan mudah dibaca.',
  'Tiga tugas saja: (1) susun ke format markdown yang diminta, (2) perbaiki ejaan dan tanda baca, (3) usulkan perbaikan bahasa yang bias atau tidak inklusif (gender, suku, kemampuan, kelas, merendahkan) tanpa mengubah makna teologis.',
  'Jangan menambah ayat, ilustrasi, doktrin, atau contoh yang tidak ada di sumber.',
  'Pengecualian hanya pada Pertanyaan untuk Refleksi Pribadi: pertahankan setiap pertanyaan asli apa adanya, lalu tambahkan varian pelajar, mahasiswa, dan pekerja. Jangan mengubah pertanyaan asli menjadi varian itu.',
  'Referensi kitab + pasal:ayat HARUS sama persis dengan sumber: jangan menerjemahkan nama kitab, jangan mengubah nomor.',
  'Setiap perubahan ejaan atau inklusi dicatat di changes (before = cuplikan sumber, after = cuplikan hasil, note singkat).',
  'Perubahan format boleh diringkas menjadi satu butir kind "format".',
  'normalized berisi naskah utuh hasil suntingan, bukan ringkasan.',
].join(' ');

export const RHB_FORMAT = [
  'Format wajib satu Path:',
  '# PATH N — Hari',
  '## Judul (boleh tetap bahasa Indonesia)',
  '**Nats Pembimbing: <ref persis sumber>**',
  '### Pengantar',
  '### Pembahasan Tematis',
  '### Makna dan Implikasi bagi Beyonders',
  '### Pertanyaan untuk Refleksi Pribadi',
  'Di bagian ini, tiap pertanyaan asli tetap utuh. Di bawahnya tambahkan tiga varian dengan pola pekan sebelumnya:',
  '1. <pertanyaan asli, jangan diubah maknanya>',
  '   🎒 Pelajar — <situasi sekolah>',
  '   🎓 Mahasiswa — <situasi kuliah>',
  '   💼 Pekerja — <situasi kerja>',
  'Varian hanya memindahkan pertanyaan yang sama ke situasi pelajar, mahasiswa, atau pekerja. Jangan menambah pertanyaan baru.',
  '### Pertanyaan untuk Diskusi Kelompok',
  '### Jembatan',
].join('\n');

const SERVICE_FORMAT = [
  'Format wajib:',
  '## A. Informasi Sesi',
  '* **Tema Minggu Ini:** ...',
  '* **Teks Utama (Serving Day / Sermon):** ...',
  '* **Kitab Bagian Fokus (Tema Mingguan / RHB 7 Path):** ...',
  '### 1. Pengantar',
  '### 2. Bedah Teologis',
  '### 3. Jembatan Menuju Tema Mingguan',
  '### 4. Kesimpulan',
  'Fondasi Teologis pada sumber = bagian Pengantar. Kitab Fundamental = Teks Utama. Jangan memindahkan ayat ke field yang lain.',
].join('\n');

function clipChanges(list, locationPrefix) {
  return (Array.isArray(list) ? list : []).slice(0, 30).map((c) => ({
    kind: c.kind || 'format',
    location: [locationPrefix, String(c.location || '').trim()].filter(Boolean).join(' · ').slice(0, 160),
    before: String(c.before || '').slice(0, 400),
    after: String(c.after || '').slice(0, 400),
    note: String(c.note || '').slice(0, 400),
  }));
}

async function tidyChunk(prompt) {
  const { object } = await jethroGenerateObject({
    system: SYSTEM,
    prompt,
    schema: NormalizeSchema,
    maxOutputTokens: 6000,
    timeoutMs: 70000,
  });
  return {
    normalized: String(object?.normalized || '').trim(),
    changes: clipChanges(object?.changes),
  };
}

export function splitRhbChunks(raw) {
  const lines = prepareSourceText(raw).split('\n');
  const chunks = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^(?:#{1,3}\s+)?path\s+(\d+)\b/i);
    if (m) {
      if (cur) chunks.push(cur);
      cur = { pathIndex: Number(m[1]), lines: [line] };
    } else if (cur) cur.lines.push(line);
  }
  if (cur) chunks.push(cur);
  return chunks.map((c) => ({ pathIndex: c.pathIndex, text: c.lines.join('\n').trim() })).filter((c) => c.text);
}

async function normalizeRhb(content) {
  const chunks = splitRhbChunks(content);
  const targets = chunks.length ? chunks : [{ pathIndex: 0, text: prepareSourceText(content) }];
  const parts = new Array(targets.length);
  const changes = [];
  const failures = [];
  const runOne = async (i) => {
    const chunk = targets[i];
    const where = chunk.pathIndex ? `Path ${chunk.pathIndex}` : 'RHB';
    try {
      const out = await tidyChunk([
        RHB_FORMAT,
        '',
        `Sunting ${where}. Pertahankan semua ayat.`,
        '',
        'NASKAH:',
        chunk.text.slice(0, 14000),
      ].join('\n'));
      if (!out.normalized) throw new Error('Hasil kosong');
      parts[i] = out.normalized;
      changes.push(...clipChanges(out.changes, where));
    } catch (err) {
      parts[i] = chunk.text;
      failures.push({ kind: 'format', location: where, note: `Gagal dirapikan (${String(err?.message || err).slice(0, 160)}). Teks sumber path ini dipertahankan.` });
    }
  };
  for (let i = 0; i < targets.length; i += 3) {
    await Promise.all([0, 1, 2].map((k) => (i + k < targets.length ? runOne(i + k) : null)));
  }
  const joined = parts.filter(Boolean).join('\n\n');
  const guarded = guardNormalized('rhb', content, joined);
  return {
    normalized: guarded.normalized,
    changes: [...changes, ...failures, ...guardWarnings(guarded.warnings)].slice(0, 60),
    preview: summarizePreview('rhb', guarded.preview),
  };
}

async function normalizeService(content) {
  let changes = [];
  let normalized = '';
  try {
    const out = await tidyChunk([
      SERVICE_FORMAT,
      '',
      'Sunting naskah Serving Day / Service berikut.',
      '',
      'NASKAH:',
      prepareSourceText(content).slice(0, 20000),
    ].join('\n'));
    normalized = out.normalized;
    changes = out.changes;
    if (!normalized) throw new Error('Hasil kosong');
  } catch (err) {
    const guarded = guardNormalized('service', content, content);
    return {
      normalized: guarded.normalized,
      changes: [{ kind: 'format', location: 'Service', before: '', after: '', note: `AI gagal (${String(err?.message || err).slice(0, 160)}). Parser menyusun format standar dari teks sumber tanpa koreksi ejaan.` }],
      preview: summarizePreview('service', guarded.preview),
    };
  }
  const guarded = guardNormalized('service', content, normalized);
  return {
    normalized: guarded.normalized,
    changes: [...changes, ...guardWarnings(guarded.warnings)].slice(0, 60),
    preview: summarizePreview('service', guarded.preview),
  };
}

function guardWarnings(list) {
  return (list || []).map((w) => ({
    kind: 'format',
    location: w.location || '',
    before: '',
    after: '',
    note: w.note || '',
  }));
}

function summarizePreview(kind, preview) {
  if (!preview) return null;
  if (kind === 'service') {
    return {
      ok: Boolean(preview.ok),
      missing: preview.missing || [],
      info: preview.info || {},
    };
  }
  return {
    ok: Boolean(preview.ok),
    missing: preview.missing || [],
    warnings: preview.warnings || [],
    paths: (preview.paths || []).map((p) => ({
      pathIndex: p.pathIndex,
      title: p.title,
      scriptureRef: p.scriptureRef,
    })),
  };
}

export async function normalizeMaterial({ kind, content }) {
  const text = String(content || '');
  if (!text.trim()) throw new Error('Naskah kosong.');
  if (kind === 'service') return normalizeService(text);
  if (kind === 'rhb' || kind === 'rhb-full') return normalizeRhb(text);
  throw new Error('kind harus rhb atau service.');
}

const PathEnSchema = z.object({
  titleEn: z.string(),
  summaryEn: z.string(),
});

const SermonEnSchema = z.object({
  bigIdeaEn: z.string(),
  summaryEn: z.string(),
});

const TRANSLATE_SYSTEM = [
  'Kamu menerjemahkan naskah kurikulum pemuda gereja dari Bahasa Indonesia ke English yang alami.',
  'Jangan menambah teologi atau ilustrasi.',
  'Referensi ayat dibiarkan persis seperti sumber (nama kitab dan nomor tidak diubah).',
  'Ini usulan. Jangan menyalin ulang teks Indonesia sebagai jawaban.',
].join(' ');

/** Usulan terjemahan. Tidak menulis ke database. */
export async function translateProposal({ target, path, sermon }) {
  if (target === 'path') {
    const title = String(path?.title || '').trim();
    const summary = String(path?.summary || path?.bridge || '').trim();
    if (!title && !summary) throw new Error('Path ini belum punya judul atau ringkasan.');
    const { object } = await jethroGenerateObject({
      system: TRANSLATE_SYSTEM,
      prompt: `Terjemahkan ke English.\nJudul:\n${title.slice(0, 200)}\n\nRingkasan:\n${summary.slice(0, 800)}`,
      schema: PathEnSchema,
      maxOutputTokens: 800,
      timeoutMs: 40000,
    });
    return {
      target: 'path',
      pathIndex: path?.pathIndex || null,
      proposal: {
        titleEn: String(object?.titleEn || '').trim().slice(0, 160),
        summaryEn: String(object?.summaryEn || '').trim().slice(0, 600),
      },
    };
  }
  const bigIdea = String(sermon?.bigIdea || '').trim();
  const summary = String(sermon?.summary || '').trim();
  if (!bigIdea && !summary) throw new Error('Khotbah belum punya inti pesan atau ringkasan.');
  const { object } = await jethroGenerateObject({
    system: TRANSLATE_SYSTEM,
    prompt: `Terjemahkan ke English.\nInti pesan:\n${bigIdea.slice(0, 500)}\n\nRingkasan:\n${summary.slice(0, 6000)}`,
    schema: SermonEnSchema,
    maxOutputTokens: 2500,
    timeoutMs: 60000,
  });
  return {
    target: 'sermon',
    proposal: {
      bigIdeaEn: String(object?.bigIdeaEn || '').trim().slice(0, 500),
      summaryEn: String(object?.summaryEn || '').trim().slice(0, 8000),
    },
  };
}
