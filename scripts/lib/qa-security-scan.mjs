/** Pure helpers for security QA smoke (importable from vitest). */

const PII_KEYS = new Set([
  'email',
  'phone',
  'userId',
  'alumniNote',
  'attendanceRate',
  'joinedDate',
  'mentorUserId',
  'comentorUserId',
  'passwordHash',
]);

const PII_PATTERN = /@[a-z0-9.-]+\.[a-z]{2,}|(\+62|08)\d{7,}|usr-[a-f0-9-]{8,}/i;

export function collectPiiFindings(value, path = '$', out = []) {
  if (value == null) return out;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectPiiFindings(value[i], `${path}[${i}]`, out);
    }
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEYS.has(k)) out.push(`${path}.${k}`);
      collectPiiFindings(v, `${path}.${k}`, out);
    }
    return out;
  }
  if (typeof value === 'string' && PII_PATTERN.test(value)) {
    out.push(`${path}="${value.slice(0, 40)}…"`);
  }
  return out;
}

export function assertNoPublicPii(payload, label) {
  const findings = collectPiiFindings(payload);
  return { ok: findings.length === 0, label, findings };
}

export function tenantIdsInGroups(groups) {
  return [...new Set((groups || []).map((g) => g.tenantId).filter(Boolean))];
}

export function memberHasContact(member) {
  if (!member) return false;
  if (member.email || member.phone || member.userId) return true;
  const u = member.user;
  if (u && (u.email || u.phone || u.id)) return true;
  return false;
}
