/**
 * Runbook acara standar H-21 → H+7.
 *
 * Sumber kebenaran naratif: docs/product/pancatugas-operating-model.md §3 (RACI)
 * dan §4 (runbook). File ini menerjemahkannya jadi deliverable yang bisa
 * di-generate ke MinistryWeekDeliverable begitu satu entri kalender punya tanggal.
 *
 * `division` memakai kode di src/lib/pantatugas.ts; `kind` memakai katalog
 * KINDS di server/routes/ministry-plans.mjs.
 */

export const MILESTONES = [
  { offset: -21, label: 'H-21 Kickoff' },
  { offset: -14, label: 'H-14 Perencanaan lintas tim' },
  { offset: -7, label: 'H-7 Finalisasi' },
  { offset: -3, label: 'H-3 Rehearsal' },
  { offset: -1, label: 'H-1 Pre-event' },
  { offset: 0, label: 'H+0 Event day' },
  { offset: 1, label: 'H+1 Post-event' },
  { offset: 7, label: 'H+7 Retro' },
];

const TASKS = [
  // H-21 — kickoff
  { offset: -21, division: 'KOINONIA', kind: 'DOCS', title: 'Proposal acara + rundown awal' },
  { offset: -21, division: 'KOINONIA', kind: 'DOCS', title: 'Kalender publikasi (Hubungan & Komunikasi)' },
  { offset: -21, division: 'BENZARPR', kind: 'CASHIER', title: 'Draft budget bersama Bendahara Tim Kerja' },

  // H-14 — perencanaan lintas tim
  { offset: -14, division: 'DIDASKALIA', kind: 'MODULE', title: 'Kebutuhan materi & sesi' },
  { offset: -14, division: 'LITURGIA', kind: 'RUNDOWN', title: 'Brief ibadah dari Koinonia' },
  { offset: -14, division: 'DIAKONIA', kind: 'LOGISTICS', title: 'Kebutuhan logistik, konsumsi, kesehatan' },
  { offset: -14, division: 'MARTURIA', kind: 'DOCS', title: 'Brief dokumentasi & desain' },
  { offset: -14, division: 'BENZARPR', kind: 'BENZUAR', title: 'Rencana merch / fundraising (opsional)' },

  // H-7 — finalisasi
  { offset: -7, division: 'LITURGIA', kind: 'RUNDOWN', title: 'Rundown spiritual + rencana rehearsal' },
  { offset: -7, division: 'DIAKONIA', kind: 'LOGISTICS', title: 'Cek venue & inventory' },
  { offset: -7, division: 'MARTURIA', kind: 'DOCS', title: 'Asset desain final → handoff Hubungan' },
  { offset: -7, division: 'DIDASKALIA', kind: 'MODULE', title: 'Materi siap distribusi mentor' },

  // H-3 — rehearsal
  { offset: -3, division: 'LITURGIA', kind: 'RUNDOWN', title: 'Rehearsal musik & vokal' },
  { offset: -3, division: 'KOINONIA', kind: 'RUNDOWN', title: 'Briefing MC' },
  { offset: -3, division: 'DIAKONIA', kind: 'LOGISTICS', title: 'Kit & protokol darurat (Kesehatan)' },

  // H-1 — pre-event
  { offset: -1, division: 'LITURGIA', kind: 'RUNDOWN', title: 'Prayer covering aktif (Doa & Intercession)' },
  { offset: -1, division: 'DIAKONIA', kind: 'LOGISTICS', title: 'Prep distribusi konsumsi' },
  { offset: -1, division: 'KOINONIA', kind: 'RUNDOWN', title: 'Ice breaker & welcome flow' },

  // H+0 — event day
  { offset: 0, division: 'MARTURIA', kind: 'BENZINEMA', title: 'Coverage dokumentasi aktif' },
  { offset: 0, division: 'KOINONIA', kind: 'RUNDOWN', title: 'HoD on-call; insiden → Ketua Tim Kerja' },

  // H+1 — post-event
  { offset: 1, division: 'MARTURIA', kind: 'DOCS', title: 'Upload hasil dokumentasi ke folder Drive event' },
  { offset: 1, division: 'KOINONIA', kind: 'DOCS', title: 'Input newcomer ke Jethro' },
  { offset: 1, division: 'DIAKONIA', kind: 'DOCS', title: 'Laporan insiden (jika ada)' },
  { offset: 1, division: 'BENZARPR', kind: 'CASHIER', title: 'Rekonsiliasi transaksi ke Bendahara' },

  // H+7 — retro
  { offset: 7, division: 'KOINONIA', kind: 'DOCS', title: 'Retro singkat dengan HoD terkait' },
  { offset: 7, division: 'MARTURIA', kind: 'DOCS', title: 'Kumpulkan draft testimoni (approve Komisi)' },
];

const LABEL_BY_OFFSET = new Map(MILESTONES.map((m) => [m.offset, m.label]));

export function milestoneLabel(offset) {
  return LABEL_BY_OFFSET.get(offset) || `H${offset >= 0 ? '+' : ''}${offset}`;
}

/**
 * Deliverable runbook untuk satu acara.
 * Judul diberi prefiks tonggak supaya urutannya terbaca di grid bulanan
 * dan supaya generate ulang bisa mendeteksi duplikat lewat judul.
 */
export function runbookTasks({ eventName }) {
  return TASKS.map((t) => ({
    offset: t.offset,
    division: t.division,
    kind: t.kind,
    title: `[${milestoneLabel(t.offset)}] ${t.title}${eventName ? ` — ${eventName}` : ''}`,
  }));
}

export function runbookDivisions() {
  return [...new Set(TASKS.map((t) => t.division))];
}
