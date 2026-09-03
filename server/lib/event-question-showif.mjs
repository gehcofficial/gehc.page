/** showIf v1: { key, equals } atau { key, in: string[] } */

export function parseShowIf(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
}

export function answerScalar(value) {
  if (value && typeof value === 'object' && 'value' in value) return value.value;
  return value;
}

export function isQuestionVisible(question, answersByKey) {
  const rule = parseShowIf(question?.showIf);
  if (!rule?.key) return true;
  const actual = answerScalar(answersByKey?.[rule.key]);
  if (Object.prototype.hasOwnProperty.call(rule, 'equals')) {
    return actual === rule.equals;
  }
  if (Array.isArray(rule.in)) return rule.in.includes(actual);
  return true;
}

export function asalFromOrigin(origin) {
  const s = String(origin || '').trim();
  if (!s) return { asalRegion: 'KOSONG', asalPlace: '' };
  if (/^sulut\b/i.test(s)) {
    return { asalRegion: 'SULUT', asalPlace: s.replace(/^sulut\s*·\s*/i, '').trim() };
  }
  if (/^luar sulut\b/i.test(s)) {
    return { asalRegion: 'NON_SULUT', asalPlace: s.replace(/^luar sulut\s*·\s*/i, '').trim() };
  }
  return { asalRegion: 'KOSONG', asalPlace: s };
}

export function resolveWhatsAppUrl({ dbUrl, envUrl, channelUrl } = {}) {
  const ok = (u) => {
    const t = String(u || '').trim();
    return /^https:\/\/(chat\.whatsapp\.com\/|wa\.me\/)/i.test(t) ? t : null;
  };
  return ok(dbUrl) || ok(envUrl) || ok(channelUrl) || null;
}

export function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatAnswerCsv(value) {
  if (value === true) return 'Ya';
  if (value === false) return 'Tidak';
  if (Array.isArray(value)) return value.join('; ');
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
