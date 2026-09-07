export const CHURCH_TITLE_ABBR = {
  PDT: 'Pdt',
  PNT: 'Pnt',
  DKN: 'Dkn',
  KR: 'Kr',
};

export const CHURCH_TITLE_VALUES = Object.keys(CHURCH_TITLE_ABBR);

const PREFIX_ACADEMIC = new Set(['Prof.', 'Dr.', 'Drs.', 'Dra.', 'Ir.']);

let extraChurchAbbr = { ...CHURCH_TITLE_ABBR };
let extraPrefixAcademic = new Set(PREFIX_ACADEMIC);

function rowField(raw, key) {
  return raw?.[key] ?? raw?.[String(key).toUpperCase()] ?? raw?.[String(key).toLowerCase()];
}

export function setTitleCatalogLookups(rows) {
  extraChurchAbbr = { ...CHURCH_TITLE_ABBR };
  extraPrefixAcademic = new Set(PREFIX_ACADEMIC);
  for (const raw of rows || []) {
    const active = rowField(raw, 'active');
    if (active === 0 || active === false) continue;
    const kind = String(rowField(raw, 'kind') || '');
    const code = String(rowField(raw, 'code') || '').toUpperCase();
    const abbr = String(rowField(raw, 'abbr') || '');
    const position = String(rowField(raw, 'position') || '');
    if (kind === 'CHURCH' && code && abbr) extraChurchAbbr[code] = abbr;
    if (kind === 'ACADEMIC' && position === 'prefix' && abbr) extraPrefixAcademic.add(abbr);
  }
}

export function parseDisplayName(raw) {
  const empty = { churchTitle: '', givenName: '', middleName: '', familyName: '', academicTitles: [] };
  let s = String(raw || '').trim().replace(/,+\s*$/, '');
  if (!s) return empty;
  for (const [value, abbr] of Object.entries(extraChurchAbbr)) {
    const re = new RegExp(`^${abbr.replace('.', '\\.')}\\.?\\s+`, 'i');
    if (re.test(s)) {
      empty.churchTitle = value;
      s = s.replace(re, '').trim();
      break;
    }
  }
  const tokens = s.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  const academics = [];
  const nameTokens = [];
  for (const tok of tokens) {
    const abbr = normalizeAcademicAbbr(tok);
    const looksDegree = /^[A-Za-z]{1,8}(\.[A-Za-z]{1,8})+\.?$/.test(tok) || extraPrefixAcademic.has(abbr);
    if (looksDegree && tok.includes('.')) academics.push(abbr);
    else nameTokens.push(tok);
  }
  empty.academicTitles = [...new Set(academics)];
  if (nameTokens.length === 1) empty.givenName = titleCaseName(nameTokens[0]);
  else if (nameTokens.length === 2) {
    empty.givenName = titleCaseName(nameTokens[0]);
    empty.familyName = titleCaseName(nameTokens[1]);
  } else if (nameTokens.length > 2) {
    empty.givenName = titleCaseName(nameTokens[0]);
    empty.familyName = titleCaseName(nameTokens[nameTokens.length - 1]);
    empty.middleName = titleCaseName(nameTokens.slice(1, -1).join(' '));
  }
  return empty;
}

export function titleCaseName(input) {
  return String(input || '').replace(/\S+/g, (w) => {
    if (!w) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

export function normalizeAcademicAbbr(raw) {
  let s = String(raw || '').trim().replace(/\s+/g, '');
  if (!s) return '';
  if (!s.endsWith('.')) s += '.';
  return s.slice(0, 24);
}

export function composeOfficialName(parts) {
  const churchRaw = String(parts?.churchTitle || '').toUpperCase();
  const church = extraChurchAbbr[churchRaw] || '';
  const given = titleCaseName(parts?.givenName).trim();
  const middle = titleCaseName(parts?.middleName).trim();
  const family = titleCaseName(parts?.familyName).trim();
  const academics = (Array.isArray(parts?.academicTitles) ? parts.academicTitles : [])
    .map(normalizeAcademicAbbr)
    .filter(Boolean);
  const prefixes = academics.filter((a) => extraPrefixAcademic.has(a));
  const suffixes = academics.filter((a) => !PREFIX_ACADEMIC.has(a));
  const person = [given, middle, family].filter(Boolean).join(' ');
  const head = [church, ...prefixes, person].filter(Boolean).join(' ');
  if (!suffixes.length) return head.slice(0, 150);
  const tail = suffixes.join(', ');
  const withComma = tail.endsWith(',') ? tail : `${tail},`;
  return `${head} ${withComma}`.trim().slice(0, 150);
}

export function validatePersonName(parts) {
  if (!titleCaseName(parts?.givenName).trim()) return 'Nama depan wajib diisi.';
  if (!titleCaseName(parts?.familyName).trim()) return 'Nama belakang wajib diisi.';
  const title = String(parts?.churchTitle || '').toUpperCase();
  if (title && !extraChurchAbbr[title] && !/^[A-Z][A-Z0-9]{1,15}$/.test(title)) {
    return 'Gelar jabatan gereja tidak valid.';
  }
  return null;
}

export function sanitizeAcademicTitles(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw.slice(0, 8)) {
    const abbr = normalizeAcademicAbbr(item);
    if (!abbr || seen.has(abbr.toLowerCase())) continue;
    seen.add(abbr.toLowerCase());
    out.push(abbr);
  }
  return out;
}

/** Terapkan field nama terstruktur ke objek Prisma `data`. Return error string atau null. */
export function applyPersonNameFields(body, data) {
  const hasParts =
    body.givenName !== undefined ||
    body.familyName !== undefined ||
    body.middleName !== undefined ||
    body.churchTitle !== undefined ||
    body.academicTitles !== undefined;
  if (!hasParts) return null;

  const churchTitle = body.churchTitle ? String(body.churchTitle).toUpperCase() : '';
  const parts = {
    churchTitle: churchTitle || '',
    givenName: body.givenName != null ? String(body.givenName) : '',
    middleName: body.middleName != null ? String(body.middleName) : '',
    familyName: body.familyName != null ? String(body.familyName) : '',
    academicTitles: sanitizeAcademicTitles(body.academicTitles),
  };
  const err = validatePersonName(parts);
  if (err) return err;
  const name = composeOfficialName(parts);
  if (!name) return 'Nama wajib diisi.';
  data.givenName = titleCaseName(parts.givenName).trim().slice(0, 80);
  data.middleName = titleCaseName(parts.middleName).trim().slice(0, 80) || null;
  data.familyName = titleCaseName(parts.familyName).trim().slice(0, 80);
  data.churchTitle = parts.churchTitle || null;
  data.academicTitles = parts.academicTitles;
  data.name = name;
  return null;
}
