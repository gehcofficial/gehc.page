/**
 * Katalog peran penatalayan baku — satu sumber untuk seed DB, usulan pola,
 * label rundown, dan caption WA. Nama orang tidak menempel di label.
 */

/** @typedef {'LITURGIA'|'DIDASKALIA'|'KOINONIA'|'DIAKONIA'|'MARTURIA'} ServingDivision */
/** @typedef {'MONOLOG'|'BEDAH_FILM'|'CREATIVE_LAB'|'DEBAT'|'POST_TO_POST'|'THREE_SEQUENCES'} WorshipPatternCode */

export const WORSHIP_PATTERN_CODES = [
  'MONOLOG',
  'BEDAH_FILM',
  'CREATIVE_LAB',
  'DEBAT',
  'POST_TO_POST',
  'THREE_SEQUENCES',
];

/**
 * @type {Array<{
 *   key: string;
 *   labelId: string;
 *   division: ServingDivision;
 *   subDivision?: string;
 *   isRequired: boolean;
 *   serviceTypes?: string;
 *   description?: string;
 *   checklist?: string[];
 *   aliases: Array<string|RegExp>;
 * }>}
 */
export const SERVING_ROLE_CATALOG = [
  {
    key: 'liturgos',
    labelId: 'Liturgos',
    division: 'LITURGIA',
    subDivision: 'Liturgi & Ibadah',
    isRequired: true,
    description: 'Memimpin alur liturgi ibadah.',
    aliases: ['Pemimpin Liturgi', 'Liturgist', /^liturgist\s*[-–—]/i, /^liturgos\s*[-–—]/i],
  },
  {
    key: 'worship-leader',
    labelId: 'Pemimpin Pujian',
    division: 'LITURGIA',
    subDivision: 'Liturgi & Ibadah',
    isRequired: false,
    description: 'Memimpin pujian & penyembahan.',
    aliases: ['Worship Leader', 'Song Leader'],
  },
  {
    key: 'singer',
    labelId: 'Penyanyi',
    division: 'LITURGIA',
    subDivision: 'Musik & Vokal',
    isRequired: false,
    description: 'Vokal pengiring pujian.',
    aliases: ['Singer'],
  },
  {
    key: 'musician-keys',
    labelId: 'Pemusik — Keyboard',
    division: 'LITURGIA',
    subDivision: 'Musik & Vokal',
    isRequired: false,
    description: 'Pemain keyboard.',
    aliases: ['Pemusik Keyboard', 'Pemusik — Keys', /^pemusik\s*[-–—]?\s*keyboard/i],
  },
  {
    key: 'musician-guitar',
    labelId: 'Pemusik — Gitar',
    division: 'LITURGIA',
    subDivision: 'Musik & Vokal',
    isRequired: false,
    description: 'Pemain gitar.',
    aliases: ['Pemusik Gitar', /^pemusik\s*[-–—]?\s*gitar/i],
  },
  {
    key: 'musician-bass',
    labelId: 'Pemusik — Bass',
    division: 'LITURGIA',
    subDivision: 'Musik & Vokal',
    isRequired: false,
    description: 'Pemain bass.',
    aliases: ['Pemusik Bass', /^pemusik\s*[-–—]?\s*bass/i],
  },
  {
    key: 'musician-drum',
    labelId: 'Pemusik — Drum',
    division: 'LITURGIA',
    subDivision: 'Musik & Vokal',
    isRequired: false,
    description: 'Pemain drum.',
    aliases: ['Pemusik Drum', /^pemusik\s*[-–—]?\s*drum/i],
  },
  {
    key: 'choir',
    labelId: 'Paduan Suara',
    division: 'LITURGIA',
    subDivision: 'Musik & Vokal',
    isRequired: false,
    description: 'Paduan suara jemaat.',
    aliases: ['Kantoria', 'Koor'],
  },
  {
    key: 'rebana',
    labelId: 'Rebana',
    division: 'LITURGIA',
    subDivision: 'Musik & Vokal',
    isRequired: false,
    description: 'Musik tradisional rebana.',
    aliases: [],
  },
  {
    key: 'intercession',
    labelId: 'Doa Syafaat',
    division: 'LITURGIA',
    subDivision: 'Doa & Intercession',
    isRequired: true,
    description: 'Doa syafaat jemaat.',
    aliases: ['Pendoa', 'Doa Penutup'],
  },
  {
    key: 'offering-prayer',
    labelId: 'Doa Persembahan',
    division: 'LITURGIA',
    subDivision: 'Doa & Intercession',
    isRequired: true,
    description: 'Doa atas persembahan.',
    aliases: [],
  },
  {
    key: 'offering-collector',
    labelId: 'Pengumpul Persembahan',
    division: 'LITURGIA',
    subDivision: 'Liturgi & Ibadah',
    isRequired: true,
    description: 'Mengumpulkan persembahan.',
    aliases: ['Pengumpul', 'Kolektor'],
  },
  {
    key: 'mc',
    labelId: 'Pembawa Acara',
    division: 'LITURGIA',
    subDivision: 'Liturgi & Ibadah',
    isRequired: true,
    description: 'Pembawa acara event.',
    aliases: ['MC'],
  },
  {
    key: 'scripture-reader',
    labelId: 'Pembaca Firman',
    division: 'DIDASKALIA',
    subDivision: 'Penyampaian Firman',
    isRequired: true,
    description: 'Pembacaan Alkitab hari ibadah.',
    checklist: ['Baca teks & konteksnya', 'Latihan pembacaan', 'Konfirmasi ke Liturgos', 'Cek mikrofon sebelum ibadah'],
    aliases: ['Pembaca Firman 1', 'Pembaca Firman 2', 'Firman 1', 'Firman 2'],
  },
  {
    key: 'speaker',
    labelId: 'Pembicara Firman',
    division: 'DIDASKALIA',
    subDivision: 'Penyampaian Firman',
    isRequired: true,
    description: 'Pembicara utama firman / monolog.',
    aliases: ['Main Speaker', 'Pembicara Utama'],
  },
  {
    key: 'moderator',
    labelId: 'Moderator',
    division: 'DIDASKALIA',
    subDivision: 'Penyampaian Firman',
    isRequired: true,
    description: 'Moderator debat atau sesi interaktif.',
    aliases: [],
  },
  {
    key: 'station-pic',
    labelId: 'PIC Pos',
    division: 'DIDASKALIA',
    subDivision: 'Penyampaian Firman',
    isRequired: true,
    description: 'Penanggung jawab pos kunjungan / stasiun.',
    aliases: ['PIC pos', 'PIC Pos Kunjungan'],
  },
  {
    key: 'host-lead',
    labelId: 'Koordinator Tuan Rumah',
    division: 'KOINONIA',
    subDivision: 'Persekutuan & Integrasi',
    isRequired: true,
    serviceTypes: 'SERVING_DAY',
    description: 'Mengoordinasi seluruh kebutuhan tuan rumah saat ibadah.',
    checklist: ['Cek jadwal & kebutuhan ibadah', 'Bagi tugas tim tuan rumah', 'Pastikan ruangan siap sebelum ibadah', 'Sambut & arahkan tamu', 'Rapikan/bersihkan sesudah ibadah'],
    aliases: ['Tuan Rumah', 'Koordinator Tuan rumah'],
  },
  {
    key: 'guest-greeter',
    labelId: 'Penerima Tamu',
    division: 'KOINONIA',
    subDivision: 'Persekutuan & Integrasi',
    isRequired: true,
    serviceTypes: 'SERVING_DAY',
    description: 'Menyambut dan mengarahkan tamu/jemaat.',
    aliases: ['Usher'],
  },
  {
    key: 'guest-attendance',
    labelId: 'Absensi Tamu',
    division: 'KOINONIA',
    subDivision: 'Persekutuan & Integrasi',
    isRequired: true,
    serviceTypes: 'SERVING_DAY',
    description: 'Mengoperasikan absensi QR untuk tamu/jemaat.',
    aliases: [],
  },
  {
    key: 'decoration',
    labelId: 'Dekorasi',
    division: 'KOINONIA',
    subDivision: 'Program & Acara',
    isRequired: false,
    serviceTypes: 'SERVING_DAY',
    description: 'Menata dekorasi & suasana ruang ibadah.',
    aliases: [],
  },
  {
    key: 'venue-clean',
    labelId: 'Kebersihan & Penataan Ruang',
    division: 'DIAKONIA',
    subDivision: 'Logistik & Fasilitas',
    isRequired: true,
    serviceTypes: 'SERVING_DAY',
    description: 'Membersihkan & menata bangunan sebelum/sesudah ibadah.',
    aliases: [],
  },
  {
    key: 'consumption',
    labelId: 'Konsumsi',
    division: 'DIAKONIA',
    subDivision: 'Konsumsi & Keramahan',
    isRequired: false,
    serviceTypes: 'SERVING_DAY',
    description: 'Menyiapkan & mendistribusikan konsumsi.',
    aliases: [],
  },
  {
    key: 'multimedia',
    labelId: 'Operator Multimedia',
    division: 'MARTURIA',
    subDivision: 'Multimedia & Sound',
    isRequired: true,
    description: 'Slide, proyeksi, dan siaran langsung.',
    aliases: [
      'Operator Multimedia / Siaran Langsung',
      'Multimedia',
      'Siaran Langsung',
      'Live Streaming',
    ],
  },
  {
    key: 'sound',
    labelId: 'Operator Tata Suara',
    division: 'MARTURIA',
    subDivision: 'Multimedia & Sound',
    isRequired: true,
    description: 'Mengelola tata suara.',
    aliases: ['Tata Suara', 'Sound'],
  },
  {
    key: 'photographer',
    labelId: 'Fotografer',
    division: 'MARTURIA',
    subDivision: 'Dokumentasi Visual',
    isRequired: false,
    description: 'Dokumentasi foto.',
    aliases: [],
  },
  {
    key: 'videographer',
    labelId: 'Videografer',
    division: 'MARTURIA',
    subDivision: 'Dokumentasi Visual',
    isRequired: false,
    description: 'Pengambilan gambar/video.',
    aliases: ['Kameramen'],
  },
  {
    key: 'video-editor',
    labelId: 'Editor Video',
    division: 'MARTURIA',
    subDivision: 'Dokumentasi Visual',
    isRequired: false,
    description: 'Penyuntingan video.',
    aliases: [],
  },
  {
    key: 'design-publication',
    labelId: 'Desain & Publikasi',
    division: 'MARTURIA',
    subDivision: 'Desain & Publikasi',
    isRequired: false,
    description: 'Desain visual dan publikasi sosmed.',
    aliases: [],
  },
];

const catalogByKey = new Map(SERVING_ROLE_CATALOG.map((r) => [r.key, r]));

const HOST_DIVISIONS = new Set(['KOINONIA', 'DIAKONIA']);

/** Domain penatalayan: HOST (tuan rumah) vs RESPONSIBLE (penanggung jawab). */
export function ownerScopeForDivision(division) {
  return HOST_DIVISIONS.has(String(division || '').toUpperCase()) ? 'HOST' : 'RESPONSIBLE';
}

export function ownerScopeForRoleKey(roleKey) {
  const cat = catalogByKey.get(String(roleKey || ''));
  if (!cat) return 'RESPONSIBLE';
  if (cat.ownerScope === 'HOST' || cat.ownerScope === 'RESPONSIBLE') return cat.ownerScope;
  return ownerScopeForDivision(cat.division);
}

/** Lepas sufiks nama orang: "Liturgist - Shyllo" → "Liturgist". */
export function stripPersonSuffix(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(.+?)\s*[-–—]\s*[A-Za-z].+$/);
  return m ? m[1].trim() : s;
}

function aliasMatches(alias, normalized) {
  if (alias instanceof RegExp) return alias.test(normalized);
  return String(alias).trim().toLowerCase() === normalized.toLowerCase();
}

/**
 * Cocokkan nama bebas (DB / rundown) ke roleKey katalog.
 * @returns {string|null}
 */
export function resolveRoleKey(rawName) {
  const base = stripPersonSuffix(rawName);
  if (!base) return null;
  for (const row of SERVING_ROLE_CATALOG) {
    if (row.labelId.toLowerCase() === base.toLowerCase()) return row.key;
    for (const a of row.aliases) {
      if (aliasMatches(a, base)) return row.key;
    }
  }
  return null;
}

export function catalogEntry(roleKey) {
  return catalogByKey.get(String(roleKey || '')) || null;
}

export function canonicalLabel(roleKeyOrName) {
  const key = catalogByKey.has(roleKeyOrName) ? roleKeyOrName : resolveRoleKey(roleKeyOrName);
  if (key && catalogByKey.has(key)) return catalogByKey.get(key).labelId;
  return stripPersonSuffix(roleKeyOrName);
}

export function displayServiceRoleName(name) {
  const key = resolveRoleKey(name);
  if (key) return catalogByKey.get(key).labelId;
  return stripPersonSuffix(name);
}

/**
 * Baris usulan per pola: urutan segment × roleKey.
 * @type {Record<WorshipPatternCode, Array<{ segment: string; roleKey: string; optional?: boolean; note?: string }>>}
 */
const PATTERN_ROWS = {
  CREATIVE_LAB: [
    { segment: 'Kedatangan', roleKey: 'host-lead' },
    { segment: 'Kedatangan', roleKey: 'guest-greeter' },
    { segment: 'Kedatangan', roleKey: 'guest-attendance' },
    { segment: 'Kedatangan', roleKey: 'venue-clean' },
    { segment: 'Praise & Worship', roleKey: 'liturgos', note: 'Koordinasi pendekatan dan jadwal dengan Liturgia, termasuk anggota di luar kelompok yang bertugas.' },
    { segment: 'Praise & Worship', roleKey: 'worship-leader', optional: true, note: 'Musik tidak wajib; tergantung kesediaan.' },
    { segment: 'Praise & Worship', roleKey: 'singer', optional: true, note: 'Musik tidak wajib; tergantung kesediaan.' },
    { segment: 'Praise & Worship', roleKey: 'musician-keys', optional: true },
    { segment: 'Praise & Worship', roleKey: 'musician-guitar', optional: true },
    { segment: 'Praise & Worship', roleKey: 'musician-bass', optional: true },
    { segment: 'Praise & Worship', roleKey: 'musician-drum', optional: true },
    { segment: 'Firman & Briefing', roleKey: 'scripture-reader' },
    { segment: 'Firman & Briefing', roleKey: 'mc', note: 'Mengumumkan pencatat dan pengundian.' },
    { segment: 'Presentasi', roleKey: 'multimedia' },
    { segment: 'Presentasi', roleKey: 'sound' },
    { segment: 'Presentasi', roleKey: 'photographer', optional: true },
    { segment: 'Persembahan & Doa', roleKey: 'offering-collector' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-prayer' },
    { segment: 'Lagu & Doa Penutup', roleKey: 'intercession' },
  ],
  MONOLOG: [
    { segment: 'Kedatangan', roleKey: 'host-lead' },
    { segment: 'Kedatangan', roleKey: 'guest-greeter' },
    { segment: 'Kedatangan', roleKey: 'guest-attendance' },
    { segment: 'Kedatangan', roleKey: 'venue-clean' },
    { segment: 'Praise & Worship', roleKey: 'liturgos' },
    { segment: 'Praise & Worship', roleKey: 'worship-leader', optional: true },
    { segment: 'Praise & Worship', roleKey: 'singer', optional: true },
    { segment: 'Praise & Worship', roleKey: 'musician-keys', optional: true },
    { segment: 'Firman & Briefing', roleKey: 'speaker' },
    { segment: 'Firman & Briefing', roleKey: 'scripture-reader' },
    { segment: 'Firman & Briefing', roleKey: 'mc' },
    { segment: 'Sesi FGD', roleKey: 'mc' },
    { segment: 'Presentasi', roleKey: 'multimedia' },
    { segment: 'Presentasi', roleKey: 'sound' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-collector' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-prayer' },
    { segment: 'Lagu & Doa Penutup', roleKey: 'intercession' },
  ],
  POST_TO_POST: [
    { segment: 'Kedatangan', roleKey: 'host-lead' },
    { segment: 'Kedatangan', roleKey: 'guest-greeter' },
    { segment: 'Praise & Worship', roleKey: 'liturgos' },
    { segment: 'Praise & Worship', roleKey: 'worship-leader', optional: true },
    { segment: 'Monolog & Briefing', roleKey: 'speaker' },
    { segment: 'Sesi Kunjungan Pos', roleKey: 'station-pic' },
    { segment: 'Wrap-up', roleKey: 'mc' },
    { segment: 'Presentasi', roleKey: 'multimedia' },
    { segment: 'Presentasi', roleKey: 'sound' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-collector' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-prayer' },
    { segment: 'Lagu & Doa Penutup', roleKey: 'intercession' },
  ],
  DEBAT: [
    { segment: 'Kedatangan', roleKey: 'host-lead' },
    { segment: 'Praise & Worship', roleKey: 'liturgos' },
    { segment: 'Praise & Worship', roleKey: 'worship-leader', optional: true },
    { segment: 'Sesi Debat', roleKey: 'moderator' },
    { segment: 'Konklusi', roleKey: 'speaker' },
    { segment: 'Presentasi', roleKey: 'multimedia' },
    { segment: 'Presentasi', roleKey: 'sound' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-collector' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-prayer' },
    { segment: 'Lagu & Doa Penutup', roleKey: 'intercession' },
  ],
  BEDAH_FILM: [
    { segment: 'Registrasi Ulang', roleKey: 'host-lead' },
    { segment: 'Registrasi Ulang', roleKey: 'guest-greeter' },
    { segment: 'Registrasi Ulang', roleKey: 'guest-attendance' },
    { segment: 'Doa Petugas', roleKey: 'host-lead' },
    { segment: 'Praise & Worship', roleKey: 'worship-leader', optional: true },
    { segment: 'Praise & Worship', roleKey: 'liturgos' },
    { segment: 'Praise & Worship', roleKey: 'multimedia' },
    { segment: 'Firman & Briefing', roleKey: 'speaker' },
    { segment: 'Firman & Briefing', roleKey: 'mc' },
    { segment: 'Movie Breakdown', roleKey: 'multimedia' },
    { segment: 'Konklusi', roleKey: 'mc' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-collector' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-prayer' },
    { segment: 'Lagu & Doa Penutup', roleKey: 'intercession' },
    { segment: 'Terima Kasih', roleKey: 'mc' },
    { segment: 'Foto Bersama', roleKey: 'photographer', optional: true },
    { segment: 'Foto Bersama', roleKey: 'videographer', optional: true },
  ],
  THREE_SEQUENCES: [
    { segment: 'Kedatangan', roleKey: 'host-lead' },
    { segment: 'Kedatangan', roleKey: 'guest-greeter' },
    { segment: 'Praise & Worship', roleKey: 'liturgos' },
    { segment: 'Praise & Worship', roleKey: 'worship-leader', optional: true },
    { segment: 'Sesi 1', roleKey: 'speaker' },
    { segment: 'Sesi 2', roleKey: 'speaker' },
    { segment: 'Sesi 3', roleKey: 'speaker' },
    { segment: 'Presentasi', roleKey: 'multimedia' },
    { segment: 'Presentasi', roleKey: 'sound' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-collector' },
    { segment: 'Persembahan & Doa', roleKey: 'offering-prayer' },
    { segment: 'Lagu & Doa Penutup', roleKey: 'intercession' },
  ],
};

/**
 * Daftar usulan terurut untuk pola ibadah.
 * @param {string} patternCode
 */
export function rolesForPattern(patternCode) {
  const code = String(patternCode || 'CREATIVE_LAB').toUpperCase();
  const rows = PATTERN_ROWS[code] || PATTERN_ROWS.CREATIVE_LAB;
  let order = 0;
  return rows.map((row) => {
    order += 1;
    const cat = catalogByKey.get(row.roleKey);
    if (!cat) return null;
    const optional = row.optional !== undefined ? row.optional : !cat.isRequired;
    return {
      order,
      segment: row.segment,
      roleKey: row.roleKey,
      name: cat.labelId,
      division: cat.division,
      ownerScope: ownerScopeForRoleKey(row.roleKey),
      optional,
      note: row.note || '',
    };
  }).filter(Boolean);
}

/** Backward compat: Creative Lab default list. */
export const WORSHIP_ORDER_ROLES = rolesForPattern('CREATIVE_LAB');

function roleLinesForScope(roles, scope) {
  const lines = [];
  let segment = '';
  for (const role of roles.filter((r) => r.ownerScope === scope)) {
    if (role.segment !== segment) {
      lines.push(role.segment);
      segment = role.segment;
    }
    lines.push(`• ${role.name}${role.optional ? ' (opsional)' : ''} — ____`);
  }
  return lines;
}

function bodLinkAbsolute(publicBaseUrl, token, domain) {
  const base = String(publicBaseUrl || 'https://youth.gehc.page').replace(/\/$/, '');
  const q = `token=${encodeURIComponent(String(token || ''))}&domain=${domain}`;
  return `${base}/#/portal/mentor/penatalayan-tautan?${q}`;
}

/**
 * Caption WA Panel BOD — header + dua seksi domain + link kotak masuk divisi.
 */
export function buildResponsibleGroupCaption(opts) {
  const pattern = String(opts.patternCode || 'CREATIVE_LAB').toUpperCase();
  const roles = rolesForPattern(pattern);
  const hostGroup = opts.hostGroup || '—';
  const responsibleGroup = opts.responsibleGroup || '—';
  const eventName = opts.eventName ? String(opts.eventName) : '';
  const filled = Number(opts.progress?.filled) || 0;
  const total = Number(opts.progress?.required) || roles.filter((r) => !r.optional).length;

  const lines = [
    `Shalom! Penatalayan Ibadah ${opts.dateLabel || 'pekan ini'}${eventName ? ` — ${eventName}` : ''}`,
    `🏠 Tuan Rumah: ${hostGroup}   |   🎯 Penanggung Jawab: ${responsibleGroup}`,
    '',
  ];

  if (opts.token && opts.publicBaseUrl) {
    lines.push(
      `🎯 PENANGGUNG JAWAB — ${responsibleGroup} (mentor & co-mentor)`,
      'Isi peran Liturgia · Didaskalia · Marturia di sini:',
      bodLinkAbsolute(opts.publicBaseUrl, opts.token, 'RESPONSIBLE'),
      ...roleLinesForScope(roles, 'RESPONSIBLE'),
      '',
      `🏠 TUAN RUMAH — ${hostGroup} (mentor & co-mentor)`,
      'Isi peran Koinonia · Diakonia di sini:',
      bodLinkAbsolute(opts.publicBaseUrl, opts.token, 'HOST'),
      ...roleLinesForScope(roles, 'HOST'),
      '',
      `HOD Divisi: setujui usulan di Kotak Masuk Divisi: ${opts.divisionInboxUrl || `${String(opts.publicBaseUrl).replace(/\/$/, '')}/#/portal/mentor/division-inbox`}`,
      `Musik tidak wajib, tergantung kesediaan. Progres: ${filled}/${total} peran.`,
    );
  } else {
    lines.push(
      '🎯 PENANGGUNG JAWAB — peran Liturgia · Didaskalia · Marturia:',
      ...roleLinesForScope(roles, 'RESPONSIBLE'),
      '',
      '🏠 TUAN RUMAH — peran Koinonia · Diakonia:',
      ...roleLinesForScope(roles, 'HOST'),
      '',
      'Musik tidak wajib, tergantung kesediaan.',
      `Progres: ${filled}/${total} peran.`,
    );
  }

  return lines.join('\n').trim();
}

export function buildBodCaptionLinks(opts) {
  if (!opts?.token || !opts?.publicBaseUrl) return null;
  const base = String(opts.publicBaseUrl).replace(/\/$/, '');
  return {
    RESPONSIBLE: bodLinkAbsolute(base, opts.token, 'RESPONSIBLE'),
    HOST: bodLinkAbsolute(base, opts.token, 'HOST'),
    divisionInbox: opts.divisionInboxUrl || `${base}/#/portal/mentor/division-inbox`,
  };
}

/** Seed rows untuk service_roles (tanpa id). */
export function catalogSeedRows() {
  const BOTH = 'SERVING_DAY,MENTORING_DAY';
  return SERVING_ROLE_CATALOG.map((r) => ({
    roleKey: r.key,
    name: r.labelId,
    division: r.division,
    subDivision: r.subDivision || null,
    serviceTypes: r.serviceTypes || BOTH,
    description: r.description || '',
    checklist: r.checklist || null,
    isRequired: r.isRequired,
    ownerScope: ownerScopeForRoleKey(r.key),
  }));
}
