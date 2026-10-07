/**
 * Representative Day — template agenda rapat petugas gabungan per Minggu serving.
 * Satu sumber kebenaran (server); klien mengambil via GET /api/representative-day/template.
 * Format agenda: "Judul | PIC | deadline" (sesuai parser EventWorkspacePanel).
 */

export const REP_DAY_AGENDA = [
  {
    title: 'Konteks firman pekan ini → Pembaca Firman',
    pic: 'Didaskalia',
    hint: 'Bagikan ringkasan + materi pembekalan 01; pastikan pembaca firman paham penekanan.',
  },
  {
    title: 'Jadwal latihan + setlist lagu',
    pic: 'Liturgia',
    hint: 'Tetapkan hari/jam latihan; kunci setlist dari Pustaka Lagu.',
  },
  {
    title: 'Slide/proyektor + shotlist dokumentasi',
    pic: 'Marturia',
    hint: 'Koordinasi operator multimedia & fotografer; file slide siap H-1.',
  },
  {
    title: 'Perlengkapan venue + konsumsi',
    pic: 'Diakonia',
    hint: 'Cek venue, sound, dan konsumsi; catat kebutuhan ke checklist.',
  },
  {
    title: 'Tuan rumah + absensi QR + flow newcomer',
    pic: 'Koinonia',
    hint: 'Briefing penerima tamu; pastikan QR absensi & grup WA temporer tersebar.',
  },
  {
    title: 'Doa covering + pokok doa',
    pic: 'Liturgia (Doa)',
    hint: 'Tim doa siaga pra-acara; kumpulkan pokok doa mingguan.',
  },
];

export function repDayTitle(eventName, eventDateISO) {
  const d = String(eventDateISO || '').slice(0, 10);
  return `Representative Day — ${eventName || 'Ibadah'} ${d}`;
}

/** agendaText siap tempel (deadline default H-1 tanggal ibadah). */
export function repDayAgendaText(eventDateISO) {
  const day = new Date(`${String(eventDateISO).slice(0, 10)}T00:00:00Z`);
  const h1 = Number.isNaN(day.getTime())
    ? ''
    : new Date(day.getTime() - 86400000).toISOString().slice(0, 10);
  return REP_DAY_AGENDA.map((a) => `${a.title} | ${a.pic} | ${h1}`).join('\n');
}

export function repDayAttendeesHint() {
  return [
    'HOD Liturgia (atau perwakilan)',
    'HOD Didaskalia (atau perwakilan)',
    'HOD Koinonia (atau perwakilan)',
    'HOD Diakonia (atau perwakilan)',
    'HOD Marturia (atau perwakilan)',
    'Mentor kelompok penanggung',
    'Mentor kelompok tuan rumah',
    'BOD Tim Kerja',
  ].join('\n');
}
