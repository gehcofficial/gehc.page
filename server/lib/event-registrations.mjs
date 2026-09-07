export const REGISTRATION_STATUS_LABEL = {
  REGISTERED: 'Counter (nama & WA)',
  WAITING_POOL: 'Menunggu profil',
  PROFILE_COMPLETED: 'Menunggu role',
  ROLE_ASSIGNED: 'Sudah peran',
  ATTENDEE: 'Akun event',
};

function pick(userVal, poolVal) {
  const u = userVal == null ? '' : String(userVal).trim();
  if (u) return userVal;
  return poolVal ?? null;
}

export function registrationFromWaitingPool(entry) {
  const user = entry?.user || {};
  const status = entry?.status || 'REGISTERED';
  return {
    id: entry.id,
    source: 'waiting_pool',
    userId: entry.userId || null,
    name: pick(user.name, entry.name) || '—',
    email: pick(user.email, entry.email),
    phone: pick(user.phone, entry.phone),
    gender: pick(user.gender, entry.gender),
    origin: pick(user.origin, entry.origin),
    domicileKind: pick(user.domicileKind, entry.domicileKind),
    domicileDetail: pick(user.domicileDetail, entry.domicileDetail),
    status,
    statusLabel: REGISTRATION_STATUS_LABEL[status] || status,
    hasAccount: Boolean(entry.userId),
    registeredAt: entry.registeredAt || null,
  };
}

export function registrationFromAttendee(row) {
  const user = row?.user || {};
  return {
    id: row.id,
    source: 'event_attendee',
    userId: row.userId || null,
    name: user.name || '—',
    email: user.email || null,
    phone: user.phone || null,
    gender: user.gender || null,
    origin: user.origin || null,
    domicileKind: user.domicileKind || null,
    domicileDetail: user.domicileDetail || null,
    status: 'ATTENDEE',
    statusLabel: REGISTRATION_STATUS_LABEL.ATTENDEE,
    hasAccount: Boolean(row.userId),
    registeredAt: row.registeredAt || null,
  };
}

export function summarizeRegistrations(rows) {
  let withAccount = 0;
  let counterOnly = 0;
  for (const row of rows) {
    if (row.hasAccount) withAccount += 1;
    else counterOnly += 1;
  }
  return { total: rows.length, withAccount, counterOnly };
}

export function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function registrationsToCsv(rows) {
  const header = 'nama,email,wa,asal,domisili,status,punya_akun,terdaftar_pada';
  const lines = rows.map((r) => [
    csvCell(r.name),
    csvCell(r.email),
    csvCell(r.phone),
    csvCell(r.origin),
    csvCell([r.domicileKind, r.domicileDetail].filter(Boolean).join(' · ')),
    csvCell(r.statusLabel || r.status),
    r.hasAccount ? 'ya' : 'tidak',
    csvCell(r.registeredAt ? new Date(r.registeredAt).toISOString() : ''),
  ].join(','));
  return [header, ...lines].join('\n');
}
