/** Gelar jabatan struktur gereja GMIM — prefix nama. */
export const CHURCH_TITLES = [
  { value: 'PDT', abbr: 'Pdt', label: 'Pendeta (Pdt)' },
  { value: 'PNT', abbr: 'Pnt', label: 'Penatua (Pnt)' },
  { value: 'DKN', abbr: 'Dkn', label: 'Diaken (Dkn)' },
  { value: 'KR', abbr: 'Kr', label: 'Kostor (Kr)' },
] as const;

export type ChurchTitleValue = string;

export type AcademicTitle = {
  abbr: string;
  nameId: string;
  nameEn: string;
  locale: 'ID' | 'EN' | 'BOTH';
  position: 'prefix' | 'suffix';
};

export const ACADEMIC_TITLES: AcademicTitle[] = [
  { abbr: 'Prof.', nameId: 'Profesor', nameEn: 'Professor', locale: 'BOTH', position: 'prefix' },
  { abbr: 'Dr.', nameId: 'Doktor', nameEn: 'Doctor', locale: 'BOTH', position: 'prefix' },
  { abbr: 'Drs.', nameId: 'Doktorandus', nameEn: 'Drs.', locale: 'ID', position: 'prefix' },
  { abbr: 'Dra.', nameId: 'Doktoranda', nameEn: 'Dra.', locale: 'ID', position: 'prefix' },
  { abbr: 'Ir.', nameId: 'Insinyur', nameEn: 'Engineer (Ir.)', locale: 'ID', position: 'prefix' },
  { abbr: 'A.Md.', nameId: 'Ahli Madya', nameEn: 'Associate degree', locale: 'ID', position: 'suffix' },
  { abbr: 'A.Md.Kom.', nameId: 'Ahli Madya Komputer', nameEn: 'Associate in Computing', locale: 'ID', position: 'suffix' },
  { abbr: 'A.Md.Kes.', nameId: 'Ahli Madya Kesehatan', nameEn: 'Associate in Health', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Th.', nameId: 'Sarjana Teologi', nameEn: 'Bachelor of Theology', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Th.M.', nameId: 'Sarjana Teologi Muda', nameEn: 'Junior Bachelor of Theology', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Pth.', nameId: 'Sarjana Pendidikan Teologi', nameEn: 'Bachelor of Theological Education', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Pd.', nameId: 'Sarjana Pendidikan', nameEn: 'Bachelor of Education', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Pd.K.', nameId: 'Sarjana Pendidikan Kristen', nameEn: 'Bachelor of Christian Education', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Ag.', nameId: 'Sarjana Agama', nameEn: 'Bachelor of Religion', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Fil.', nameId: 'Sarjana Filsafat', nameEn: 'Bachelor of Philosophy', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Kom.', nameId: 'Sarjana Komputer', nameEn: 'Bachelor of Computer Science', locale: 'ID', position: 'suffix' },
  { abbr: 'S.T.', nameId: 'Sarjana Teknik', nameEn: 'Bachelor of Engineering', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Si.', nameId: 'Sarjana Sains', nameEn: 'Bachelor of Science', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Sos.', nameId: 'Sarjana Sosial', nameEn: 'Bachelor of Social Science', locale: 'ID', position: 'suffix' },
  { abbr: 'S.H.', nameId: 'Sarjana Hukum', nameEn: 'Bachelor of Law', locale: 'ID', position: 'suffix' },
  { abbr: 'S.E.', nameId: 'Sarjana Ekonomi', nameEn: 'Bachelor of Economics', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Ak.', nameId: 'Sarjana Akuntansi', nameEn: 'Bachelor of Accounting', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Psi.', nameId: 'Sarjana Psikologi', nameEn: 'Bachelor of Psychology', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Kep.', nameId: 'Sarjana Keperawatan', nameEn: 'Bachelor of Nursing', locale: 'ID', position: 'suffix' },
  { abbr: 'Ns.', nameId: 'Ners', nameEn: 'Nurse professional', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Ked.', nameId: 'Sarjana Kedokteran', nameEn: 'Bachelor of Medicine', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Farm.', nameId: 'Sarjana Farmasi', nameEn: 'Bachelor of Pharmacy', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Gz.', nameId: 'Sarjana Gizi', nameEn: 'Bachelor of Nutrition', locale: 'ID', position: 'suffix' },
  { abbr: 'S.I.Kom.', nameId: 'Sarjana Ilmu Komunikasi', nameEn: 'Bachelor of Communication', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Hub.Int.', nameId: 'Sarjana Hubungan Internasional', nameEn: 'Bachelor of International Relations', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Sn.', nameId: 'Sarjana Seni', nameEn: 'Bachelor of Arts (fine arts)', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Ds.', nameId: 'Sarjana Desain', nameEn: 'Bachelor of Design', locale: 'ID', position: 'suffix' },
  { abbr: 'S.P.', nameId: 'Sarjana Pertanian', nameEn: 'Bachelor of Agriculture', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Pt.', nameId: 'Sarjana Peternakan', nameEn: 'Bachelor of Animal Science', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Hut.', nameId: 'Sarjana Kehutanan', nameEn: 'Bachelor of Forestry', locale: 'ID', position: 'suffix' },
  { abbr: 'S.Pi.', nameId: 'Sarjana Perikanan', nameEn: 'Bachelor of Fisheries', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Th.', nameId: 'Magister Teologi', nameEn: 'Master of Theology', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Pth.', nameId: 'Magister Pendidikan Teologi', nameEn: 'Master of Theological Education', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Pd.', nameId: 'Magister Pendidikan', nameEn: 'Master of Education', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Si.', nameId: 'Magister Sains', nameEn: 'Master of Science (ID)', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Kom.', nameId: 'Magister Komputer', nameEn: 'Master of Computer Science', locale: 'ID', position: 'suffix' },
  { abbr: 'M.T.', nameId: 'Magister Teknik', nameEn: 'Master of Engineering', locale: 'ID', position: 'suffix' },
  { abbr: 'M.M.', nameId: 'Magister Manajemen', nameEn: 'Master of Management', locale: 'ID', position: 'suffix' },
  { abbr: 'M.H.', nameId: 'Magister Hukum', nameEn: 'Master of Law', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Psi.', nameId: 'Magister Psikologi', nameEn: 'Master of Psychology', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Kes.', nameId: 'Magister Kesehatan', nameEn: 'Master of Health', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Hum.', nameId: 'Magister Humaniora', nameEn: 'Master of Humanities', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Ag.', nameId: 'Magister Agama', nameEn: 'Master of Religion', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Fil.', nameId: 'Magister Filsafat', nameEn: 'Master of Philosophy (ID)', locale: 'ID', position: 'suffix' },
  { abbr: 'M.Div.', nameId: 'Master of Divinity', nameEn: 'Master of Divinity', locale: 'BOTH', position: 'suffix' },
  { abbr: 'M.Min.', nameId: 'Master of Ministry', nameEn: 'Master of Ministry', locale: 'EN', position: 'suffix' },
  { abbr: 'B.A.', nameId: 'Bachelor of Arts', nameEn: 'Bachelor of Arts', locale: 'EN', position: 'suffix' },
  { abbr: 'B.Sc.', nameId: 'Bachelor of Science', nameEn: 'Bachelor of Science', locale: 'EN', position: 'suffix' },
  { abbr: 'B.Eng.', nameId: 'Bachelor of Engineering', nameEn: 'Bachelor of Engineering', locale: 'EN', position: 'suffix' },
  { abbr: 'B.Ed.', nameId: 'Bachelor of Education', nameEn: 'Bachelor of Education', locale: 'EN', position: 'suffix' },
  { abbr: 'B.Th.', nameId: 'Bachelor of Theology', nameEn: 'Bachelor of Theology', locale: 'EN', position: 'suffix' },
  { abbr: 'B.Div.', nameId: 'Bachelor of Divinity', nameEn: 'Bachelor of Divinity', locale: 'EN', position: 'suffix' },
  { abbr: 'B.B.A.', nameId: 'Bachelor of Business Administration', nameEn: 'Bachelor of Business Administration', locale: 'EN', position: 'suffix' },
  { abbr: 'M.A.', nameId: 'Master of Arts', nameEn: 'Master of Arts', locale: 'EN', position: 'suffix' },
  { abbr: 'M.Sc.', nameId: 'Master of Science', nameEn: 'Master of Science', locale: 'EN', position: 'suffix' },
  { abbr: 'M.Eng.', nameId: 'Master of Engineering', nameEn: 'Master of Engineering', locale: 'EN', position: 'suffix' },
  { abbr: 'M.Ed.', nameId: 'Master of Education', nameEn: 'Master of Education', locale: 'EN', position: 'suffix' },
  { abbr: 'M.B.A.', nameId: 'Master of Business Administration', nameEn: 'Master of Business Administration', locale: 'EN', position: 'suffix' },
  { abbr: 'M.Phil.', nameId: 'Master of Philosophy', nameEn: 'Master of Philosophy', locale: 'EN', position: 'suffix' },
  { abbr: 'Th.M.', nameId: 'Master of Theology', nameEn: 'Master of Theology', locale: 'EN', position: 'suffix' },
  { abbr: 'Ph.D.', nameId: 'Doctor of Philosophy', nameEn: 'Doctor of Philosophy', locale: 'EN', position: 'suffix' },
  { abbr: 'D.Min.', nameId: 'Doctor of Ministry', nameEn: 'Doctor of Ministry', locale: 'EN', position: 'suffix' },
  { abbr: 'Th.D.', nameId: 'Doctor of Theology', nameEn: 'Doctor of Theology', locale: 'EN', position: 'suffix' },
  { abbr: 'Ed.D.', nameId: 'Doctor of Education', nameEn: 'Doctor of Education', locale: 'EN', position: 'suffix' },
  { abbr: 'D.D.', nameId: 'Doctor of Divinity', nameEn: 'Doctor of Divinity', locale: 'EN', position: 'suffix' },
];

export type PersonNameParts = {
  churchTitle: ChurchTitleValue;
  givenName: string;
  middleName: string;
  familyName: string;
  academicTitles: string[];
};

export function emptyPersonName(): PersonNameParts {
  return { churchTitle: '', givenName: '', middleName: '', familyName: '', academicTitles: [] };
}

/** Title Case per kata, spasi di ujung tetap (aman untuk onChange). */
export function titleCaseName(input: string): string {
  return String(input || '').replace(/\S+/g, (w) => {
    if (!w) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

export function normalizeAcademicAbbr(raw: string): string {
  let s = String(raw || '').trim().replace(/\s+/g, '');
  if (!s) return '';
  if (!s.endsWith('.')) s += '.';
  return s;
}

export function churchTitleAbbr(value?: string | null, extra: Array<{ value: string; abbr: string }> = []): string {
  const key = String(value || '').toUpperCase();
  const hit = CHURCH_TITLES.find((t) => t.value === key) || extra.find((t) => t.value.toUpperCase() === key);
  return hit?.abbr || '';
}

function academicMeta(abbr: string): AcademicTitle | undefined {
  const n = normalizeAcademicAbbr(abbr).toLowerCase();
  return ACADEMIC_TITLES.find((t) => t.abbr.toLowerCase() === n);
}

export function searchAcademicTitles(q: string, list: AcademicTitle[] = ACADEMIC_TITLES): AcademicTitle[] {
  const term = q.trim().toLowerCase();
  const source = list.length ? list : ACADEMIC_TITLES;
  if (!term) return source;
  const compact = term.replace(/[.\s]/g, '');
  return source.filter((t) => {
    const hay = `${t.abbr} ${t.nameId} ${t.nameEn}`.toLowerCase();
    const hayCompact = hay.replace(/[.\s]/g, '');
    return hay.includes(term) || hayCompact.includes(compact);
  });
}

export type ComposeOpts = {
  church?: Array<{ value: string; abbr: string }>;
  academic?: AcademicTitle[];
};

export function composeOfficialName(parts: PersonNameParts, opts: ComposeOpts = {}): string {
  const church = churchTitleAbbr(parts.churchTitle, opts.church);
  const given = titleCaseName(parts.givenName).trim();
  const middle = titleCaseName(parts.middleName).trim();
  const family = titleCaseName(parts.familyName).trim();
  const academics = (parts.academicTitles || []).map(normalizeAcademicAbbr).filter(Boolean);
  const extras = opts.academic || [];
  const metaOf = (a: string) => extras.find((t) => t.abbr.toLowerCase() === a.toLowerCase()) || academicMeta(a);
  const prefixes = academics.filter((a) => metaOf(a)?.position === 'prefix');
  const suffixes = academics.filter((a) => metaOf(a)?.position !== 'prefix');
  const person = [given, middle, family].filter(Boolean).join(' ');
  const head = [church, ...prefixes, person].filter(Boolean).join(' ');
  if (!suffixes.length) return head.slice(0, 150);
  const tail = suffixes.join(', ');
  const withComma = tail.endsWith(',') ? tail : `${tail},`;
  return `${head} ${withComma}`.trim().slice(0, 150);
}

function stripTrailingComma(s: string) {
  return s.replace(/,+\s*$/, '').trim();
}

export function parseDisplayName(raw?: string | null): PersonNameParts {
  const empty = emptyPersonName();
  let s = stripTrailingComma(String(raw || '').trim());
  if (!s) return empty;

  const church = CHURCH_TITLES.find((t) => {
    const re = new RegExp(`^${t.abbr.replace('.', '\\.')}\\.?\\s+`, 'i');
    return re.test(s);
  });
  if (church) {
    empty.churchTitle = church.value;
    s = s.replace(new RegExp(`^${church.abbr.replace('.', '\\.')}\\.?\\s+`, 'i'), '').trim();
  }

  const tokens = s.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  const academics: string[] = [];
  const nameTokens: string[] = [];
  for (const tok of tokens) {
    const abbr = normalizeAcademicAbbr(tok);
    const known = academicMeta(abbr);
    const looksDegree = /^[A-Za-z]{1,8}(\.[A-Za-z]{1,8})+\.?$/.test(tok) || known;
    if (looksDegree && (known || tok.includes('.'))) {
      academics.push(known ? known.abbr : abbr);
    } else {
      nameTokens.push(tok);
    }
  }
  empty.academicTitles = [...new Set(academics)];
  if (nameTokens.length === 1) {
    empty.givenName = titleCaseName(nameTokens[0]);
  } else if (nameTokens.length === 2) {
    empty.givenName = titleCaseName(nameTokens[0]);
    empty.familyName = titleCaseName(nameTokens[1]);
  } else if (nameTokens.length > 2) {
    empty.givenName = titleCaseName(nameTokens[0]);
    empty.familyName = titleCaseName(nameTokens[nameTokens.length - 1]);
    empty.middleName = titleCaseName(nameTokens.slice(1, -1).join(' '));
  }
  return empty;
}

export function partsFromUser(user?: {
  name?: string | null;
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  churchTitle?: string | null;
  academicTitles?: unknown;
} | null): PersonNameParts {
  const hasParts = Boolean(user?.givenName || user?.familyName);
  if (!hasParts) return parseDisplayName(user?.name);
  const academics = Array.isArray(user?.academicTitles)
    ? (user!.academicTitles as unknown[]).map((x) => normalizeAcademicAbbr(String(x))).filter(Boolean)
    : [];
  const title = String(user?.churchTitle || '').toUpperCase();
  return {
    churchTitle: title,
    givenName: user?.givenName || '',
    middleName: user?.middleName || '',
    familyName: user?.familyName || '',
    academicTitles: academics,
  };
}

export function validatePersonName(parts: PersonNameParts): string | null {
  if (!titleCaseName(parts.givenName).trim()) return 'Nama depan wajib diisi.';
  if (!titleCaseName(parts.familyName).trim()) return 'Nama belakang wajib diisi.';
  if (parts.churchTitle) {
    const t = String(parts.churchTitle).toUpperCase();
    if (!CHURCH_TITLES.some((c) => c.value === t) && !/^[A-Z][A-Z0-9]{1,15}$/.test(t)) {
      return 'Gelar jabatan gereja tidak valid.';
    }
  }
  return null;
}
