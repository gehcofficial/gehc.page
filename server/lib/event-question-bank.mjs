/** Katalog v1 — Tim Kerja centang per event; tidak auto-assign. */

export const QUESTION_TYPES = [
  'SHORT_TEXT',
  'TEXT', // alias lawas SHORT_TEXT
  'LONG_TEXT',
  'BOOLEAN',
  'DROPDOWN',
  'SELECT', // alias lawas DROPDOWN
  'SINGLE',
  'MULTI',
  'DATE',
  'NUMBER',
];

/** Normalisasi alias lawas ke tipe kanonik. */
export function normQuestionType(raw) {
  const t = String(raw || 'SHORT_TEXT').toUpperCase();
  if (t === 'TEXT') return 'SHORT_TEXT';
  if (t === 'SELECT') return 'DROPDOWN';
  return QUESTION_TYPES.includes(t) ? t : 'SHORT_TEXT';
}

/** Tipe yang butuh daftar opsi. */
export function typeNeedsOptions(type) {
  return ['DROPDOWN', 'SELECT', 'SINGLE', 'MULTI'].includes(String(type || '').toUpperCase());
}

/**
 * Logika tampil-bersyarat: { key, equals } atau { key, in: [...] }.
 * - key: kunci soal bank lain (mis. 'status_kerja'), wajib ada.
 * - equals: nilai tunggal (string/boolean/number).
 * - in: daftar nilai (minimal 1).
 * Kembalikan { ok, rule } atau { ok: false, error }.
 */
export function validateShowIf(raw, { bankKeys = [], selfKey = null } = {}) {
  if (raw == null || raw === '') return { ok: true, rule: null };
  let rule = raw;
  if (typeof rule === 'string') {
    try {
      rule = JSON.parse(rule);
    } catch {
      return { ok: false, error: 'Logika tampil harus JSON valid.' };
    }
  }
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return { ok: false, error: 'Logika tampil harus objek { key, equals/in }.' };
  }
  const key = String(rule.key || '').trim();
  if (!key) return { ok: false, error: 'Logika tampil butuh kunci soal (key).' };
  if (selfKey && key === selfKey) {
    return { ok: false, error: 'Soal tidak bisa bersyarat pada dirinya sendiri.' };
  }
  if (bankKeys.length && !bankKeys.includes(key)) {
    return { ok: false, error: `Soal acuan "${key}" tidak ada di bank.` };
  }
  const hasEquals = Object.prototype.hasOwnProperty.call(rule, 'equals');
  const hasIn = Object.prototype.hasOwnProperty.call(rule, 'in');
  if (!hasEquals && !hasIn) {
    return { ok: false, error: 'Logika tampil butuh "equals" atau "in".' };
  }
  const clean = { key };
  if (hasEquals) {
    const v = rule.equals;
    if (!['string', 'boolean', 'number'].includes(typeof v)) {
      return { ok: false, error: '"equals" harus teks, angka, atau ya/tidak.' };
    }
    clean.equals = typeof v === 'string' ? v.slice(0, 190) : v;
  }
  if (hasIn) {
    const arr = Array.isArray(rule.in) ? rule.in : [rule.in];
    const vals = arr
      .filter((v) => ['string', 'boolean', 'number'].includes(typeof v))
      .map((v) => (typeof v === 'string' ? v.slice(0, 190) : v));
    if (!vals.length) return { ok: false, error: '"in" butuh minimal 1 nilai.' };
    clean.in = vals;
  }
  return { ok: true, rule: clean };
}

export const SEED_QUESTIONS = [
  {
    key: 'ikut_makan',
    label: 'Ikut makan bersama?',
    hint: 'Untuk hitungan porsi konsumsi.',
    type: 'BOOLEAN',
    options: null,
    ownerDivision: 'DIAKONIA',
    ownerSubdivision: 'Konsumsi & Keramahan',
    showIf: null,
    sortOrder: 10,
  },
  {
    key: 'alergi_makanan',
    label: 'Alergi makanan',
    hint: 'Tuliskan bahan yang harus dihindari.',
    type: 'TEXT',
    options: null,
    ownerDivision: 'DIAKONIA',
    ownerSubdivision: 'Konsumsi & Keramahan',
    showIf: { key: 'ikut_makan', equals: true },
    sortOrder: 20,
  },
  {
    key: 'diet_khusus',
    label: 'Diet khusus',
    hint: null,
    type: 'SELECT',
    options: ['Tidak ada', 'Halal ketat', 'Vegetarian'],
    ownerDivision: 'DIAKONIA',
    ownerSubdivision: 'Konsumsi & Keramahan',
    showIf: null,
    sortOrder: 30,
  },
  {
    key: 'kebutuhan_akses',
    label: 'Kebutuhan akses / pendampingan',
    hint: 'Kursi roda, pendampingan, atau catatan kesehatan yang panitia perlu tahu.',
    type: 'TEXT',
    options: null,
    ownerDivision: 'DIAKONIA',
    ownerSubdivision: 'Kesehatan & Keselamatan',
    showIf: null,
    sortOrder: 40,
  },
  {
    key: 'asal_jemaat',
    label: 'Asal jemaat',
    hint: 'Gereja, bukan kota asal.',
    type: 'SELECT',
    options: ['GEHC Cikarang', 'GMIM lain', 'Gereja non-GMIM', 'Belum berjemaat'],
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: null,
    sortOrder: 50,
  },
  {
    key: 'asal_jemaat_nama',
    label: 'Nama jemaat / gereja',
    hint: 'Jika GMIM lain atau gereja non-GMIM.',
    type: 'TEXT',
    options: null,
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: { key: 'asal_jemaat', in: ['GMIM lain', 'Gereja non-GMIM'] },
    sortOrder: 60,
  },
  {
    key: 'pertama_kali',
    label: 'Pertama kali hadir di acara ini?',
    hint: null,
    type: 'BOOLEAN',
    options: null,
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: null,
    sortOrder: 70,
  },
  {
    key: 'diundang_oleh',
    label: 'Diundang oleh',
    hint: 'Nama teman atau pelayan yang mengajak (opsional).',
    type: 'TEXT',
    options: null,
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: null,
    sortOrder: 80,
  },
  {
    key: 'relasi_hamba_tuhan',
    label: 'Ada relasi dengan hamba Tuhan / pelayan GEHC?',
    hint: null,
    type: 'BOOLEAN',
    options: null,
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: null,
    sortOrder: 90,
  },
  {
    key: 'relasi_hamba_tuhan_ket',
    label: 'Keterangan relasi hamba Tuhan',
    hint: 'Nama dan hubungan (mis. anak, keponakan).',
    type: 'TEXT',
    options: null,
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: { key: 'relasi_hamba_tuhan', equals: true },
    sortOrder: 100,
  },
  {
    key: 'pelayan_khusus',
    label: 'Pelayan khusus (penatua / syamas / pelayan lain)?',
    hint: null,
    type: 'BOOLEAN',
    options: null,
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: null,
    sortOrder: 110,
  },
  {
    key: 'izin_dokumentasi',
    label: 'Boleh difoto / video panitia?',
    hint: 'Untuk arsip dan publikasi gereja.',
    type: 'BOOLEAN',
    options: null,
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Hubungan & Komunikasi',
    showIf: null,
    sortOrder: 120,
  },
  {
    key: 'moda_datang',
    label: 'Moda datang',
    hint: null,
    type: 'SELECT',
    options: ['Kendaraan sendiri', 'Diantar', 'Ojek/taksi', 'Carpool', 'Butuh jemput'],
    ownerDivision: 'DIAKONIA',
    ownerSubdivision: 'Logistik & Fasilitas',
    showIf: null,
    sortOrder: 130,
  },
  {
    key: 'butuh_info_kost',
    label: 'Butuh info kost / tempat tinggal?',
    hint: 'Untuk newcomer rantau di Cikarang.',
    type: 'BOOLEAN',
    options: null,
    ownerDivision: 'DIAKONIA',
    ownerSubdivision: 'Konsumsi & Keramahan',
    showIf: null,
    sortOrder: 140,
  },
  {
    key: 'ukuran_kaos',
    label: 'Ukuran kaos',
    hint: 'Jika event membagikan kaos.',
    type: 'SELECT',
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    ownerDivision: 'KOINONIA',
    ownerSubdivision: 'Program & Acara',
    showIf: null,
    sortOrder: 150,
  },
];

export const SEED_QUESTION_KEYS = SEED_QUESTIONS.map((q) => q.key);

export function bankId(key) {
  return `eqb-${key}`;
}
