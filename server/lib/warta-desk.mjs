/**
 * Helper Warta: rangkai petugas penatalayan, penanggung/tuan rumah, pokok doa,
 * dan jadwal minggu depan dari jadwal pelayanan + rencana bulan.
 *
 * Semua fungsi di sini murni (tanpa DB) supaya mudah diuji.
 */

const DAY_MS = 86400000;

/** Urutan divisi penatalayan yang ditampilkan di warta. */
export const DIVISION_ORDER = ['LITURGIA', 'MARTURIA'];
const DIVISION_LABEL = { LITURGIA: 'LITURGIA', MARTURIA: 'MARTURIA' };

export const PRAYER_KIND_LABEL = {
  SAKIT: 'Sakit',
  DUKA: 'Duka',
  YUDISIUM: 'Yudisium',
  WISUDA: 'Wisuda',
  KERJA: 'Kerja / pindah',
  LAINNYA: 'Lainnya',
  UMUM: 'Umum',
};

export function formatDateID(iso) {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

/** Date | ISO | string → 'YYYY-MM-DD' (aman untuk nilai Prisma @db.Date). */
export function toDayISO(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  const s = String(value);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : '';
}

/**
 * Kelompokkan jadwal petugas per komponen (ServiceRole).
 * schedules: [{ serviceRoleId, serviceRole:{id,name,division,sortOrder}, user:{id,name} }]
 */
export function groupOfficers(schedules = []) {
  const byRole = new Map();
  for (const s of schedules || []) {
    const role = s?.serviceRole || {};
    const key = s?.serviceRoleId || role.id || role.name;
    if (!key) continue;
    if (!byRole.has(key)) {
      byRole.set(key, {
        roleId: String(key),
        role: role.name || 'Petugas',
        division: String(role.division || 'LAINNYA').toUpperCase(),
        sortOrder: Number(role.sortOrder ?? 0),
        people: [],
      });
    }
    const entry = byRole.get(key);
    const name = s?.user?.name || s?.userName || null;
    if (name && !entry.people.includes(name)) entry.people.push(name);
  }
  const rank = (division) => {
    const i = DIVISION_ORDER.indexOf(division);
    return i === -1 ? 99 : i;
  };
  return [...byRole.values()].sort(
    (a, b) => rank(a.division) - rank(b.division)
      || a.sortOrder - b.sortOrder
      || a.role.localeCompare(b.role),
  );
}

/**
 * Pilih baris serving untuk tanggal Minggu tsb.
 * Bila tidak ada baris tepat di tanggal itu, pakai baris terdekat dalam 21 hari
 * dan tandai `projected` (perkiraan) — tanpa menghitung ulang siklus.
 */
export function pickServingForDate(rows = [], dateISO) {
  const target = toDayISO(dateISO);
  if (!target || !Array.isArray(rows) || !rows.length) return { row: null, projected: false };
  const keyed = rows
    .map((r) => ({ row: r, day: toDayISO(r?.eventDate) }))
    .filter((x) => x.day);
  const exact = keyed.find((x) => x.day === target);
  if (exact) return { row: exact.row, projected: false };
  const t = Date.parse(`${target}T00:00:00Z`);
  if (Number.isNaN(t)) return { row: null, projected: false };
  let best = null;
  for (const x of keyed) {
    const d = Math.abs(Date.parse(`${x.day}T00:00:00Z`) - t);
    if (!Number.isFinite(d) || d > 21 * DAY_MS) continue;
    if (!best || d < best.d) best = { row: x.row, d };
  }
  return best ? { row: best.row, projected: true } : { row: null, projected: false };
}

/** Ambil entri pekan (tema/ayat) dari MinistryMonthPlan.weeks untuk tanggal tsb. */
export function pickWeekTheme(weeks, dateISO) {
  const target = toDayISO(dateISO);
  if (!target || !Array.isArray(weeks)) return null;
  return weeks.find((w) => toDayISO(w?.date) === target) || null;
}

/** Saran pokok doa dari Portal Doa — DISAMARKAN (nama depan + jenis, tanpa isi catatan). */
export function maskPrayerSuggestions(notes = []) {
  return (notes || []).map((n) => ({
    name: n?.isGeneral ? 'Doa umum' : firstName(n?.subject?.name || n?.subjectName) || '—',
    kind: PRAYER_KIND_LABEL[String(n?.kind || '').toUpperCase()] || n?.kind || '-',
    occurredOn: n?.occurredOn || null,
  }));
}

/** Teks bagian "Pelayanan" pada warta. */
export function buildWartaPelayanan({
  responsibleGroup = null,
  hostGroup = null,
  officers = [],
  projected = false,
} = {}) {
  const lines = [];
  lines.push(`Penanggung Jawab: ${responsibleGroup?.name || 'belum ditetapkan'}`);
  lines.push(`Tuan Rumah: ${hostGroup?.name || 'belum ditetapkan'}`);
  if (projected) lines.push('(perkiraan — jadwal minggu ini belum ditetapkan)');
  if (!officers.length) {
    lines.push('', 'Petugas penatalayan: belum ada yang terjadwal.');
    return lines.join('\n');
  }
  const byDiv = new Map();
  for (const o of officers) {
    const list = byDiv.get(o.division) || [];
    list.push(o);
    byDiv.set(o.division, list);
  }
  for (const [division, list] of byDiv) {
    lines.push('', `— ${DIVISION_LABEL[division] || division} —`);
    for (const o of list) {
      lines.push(`${o.role}: ${o.people.length ? o.people.join(', ') : '—'}`);
    }
  }
  return lines.join('\n');
}

/** Teks bagian "Doa" (pekan ini + bulan ini). */
export function buildWartaDoa({
  monthTheme = null,
  weekTheme = null,
  verse = null,
  servingVerse = null,
  suggestions = [],
  includeSuggestions = true,
} = {}) {
  const lines = ['POKOK DOA PEKAN INI'];
  if (weekTheme) lines.push(`Tema: ${weekTheme}`);
  const ayat = verse || servingVerse;
  if (ayat) lines.push(`Ayat: ${ayat}`);
  if (includeSuggestions && suggestions.length) {
    lines.push('', 'Konteks doa (data privat — sunting sebelum terbit):');
    for (const s of suggestions) lines.push(`- ${s.name} (${s.kind})`);
  }
  if (!weekTheme && !ayat && !suggestions.length) lines.push('(belum ada tema/ayat pekan ini)');
  if (monthTheme) lines.push('', 'POKOK DOA BULAN INI', `Tema: ${monthTheme}`);
  return lines.join('\n');
}

/** Teks bagian "Jadwal Minggu Depan". */
export function buildWartaJadwal({ nextDate = null, nextResponsible = null, nextHost = null } = {}) {
  const lines = [];
  if (nextDate) lines.push(formatDateID(nextDate));
  lines.push(`Penanggung Jawab: ${nextResponsible?.name || 'belum ditetapkan'}`);
  lines.push(`Tuan Rumah: ${nextHost?.name || 'belum ditetapkan'}`);
  return lines.join('\n');
}

/** Ringkas seluruh "desk" warta dari data mentah (dipakai endpoint & test). */
export function buildWartaDesk({
  date = null,
  serving = { row: null, projected: false },
  nextServing = { row: null, projected: false },
  schedules = [],
  monthPlan = null,
  prayerNotes = [],
  includeSuggestions = true,
} = {}) {
  const officers = groupOfficers(schedules);
  const week = pickWeekTheme(monthPlan?.weeks, date);
  const suggestions = includeSuggestions ? maskPrayerSuggestions(prayerNotes) : [];
  const nextDate = toDayISO(nextServing?.row?.eventDate) || null;
  const texts = {
    pelayanan: buildWartaPelayanan({
      responsibleGroup: serving?.row?.responsibleGroup,
      hostGroup: serving?.row?.hostGroup,
      officers,
      projected: Boolean(serving?.projected),
    }),
    doa: buildWartaDoa({
      monthTheme: monthPlan?.theme || null,
      weekTheme: week?.theme || week?.servingTheme || null,
      verse: week?.verse || null,
      servingVerse: week?.servingVerse || null,
      suggestions,
      includeSuggestions,
    }),
    jadwal: buildWartaJadwal({
      nextDate,
      nextResponsible: nextServing?.row?.responsibleGroup,
      nextHost: nextServing?.row?.hostGroup,
    }),
  };
  return {
    date: String(date || '').slice(0, 10),
    responsibleGroup: serving?.row?.responsibleGroup || null,
    hostGroup: serving?.row?.hostGroup || null,
    projected: Boolean(serving?.projected),
    officers,
    themes: {
      monthTheme: monthPlan?.theme || null,
      weekTheme: week?.theme || week?.servingTheme || null,
      verse: week?.verse || null,
      servingVerse: week?.servingVerse || null,
    },
    suggestions,
    suggestionsPrivate: suggestions.length > 0,
    next: {
      date: nextDate,
      responsibleGroup: nextServing?.row?.responsibleGroup || null,
      hostGroup: nextServing?.row?.hostGroup || null,
      projected: Boolean(nextServing?.projected),
    },
    texts,
  };
}
