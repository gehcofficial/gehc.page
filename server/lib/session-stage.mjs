/**
 * Status panggung sesi (modul rounds / screening / teams) — validasi murni.
 * Disimpan di config sesi (rounds / screening / teams) — tanpa migrasi skema.
 * Ditulis endpoint stage (admin Didaskalia, boleh saat live).
 */

const str = (v, max = 500) => {
  if (v === undefined || v === null) return '';
  return String(v).slice(0, max);
};

export const ROUND_PHASES = ['brief', 'pro', 'kontra', 'sanggah', 'blow', 'jeda', 'selesai'];

export const ROUND_PHASE_LABEL = {
  brief: 'Briefing mosi',
  pro: 'Pemaparan PRO',
  kontra: 'Pemaparan KONTRA',
  sanggah: 'Sanggahan',
  blow: 'Final Blow',
  jeda: 'Jeda & transisi',
  selesai: 'Ronde selesai',
};

/** Normalisasi state ronde debat (maks 5 ronde). */
export function cleanRounds(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const list = (Array.isArray(raw.rounds) ? raw.rounds : []).slice(0, 5).map((r) => ({
    mosi: str(r?.mosi, 500),
    pro: str(r?.pro, 120),
    kontra: str(r?.kontra, 120),
    proScore: Math.max(0, Number(r?.proScore) || 0),
    kontraScore: Math.max(0, Number(r?.kontraScore) || 0),
  }));
  const current = Math.min(Math.max(0, Number(raw.current) || 0), Math.max(0, list.length - 1));
  const phase = ROUND_PHASES.includes(String(raw.phase)) ? String(raw.phase) : 'brief';
  return { rounds: list, current, phase };
}

/** Normalisasi status pemutaran film. */
export function cleanScreening(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = str(raw.title, 200);
  if (!title) return null;
  const durationMin = Math.min(180, Math.max(10, Number(raw.durationMin) || 90));
  const startedAt = raw.startedAt ? String(raw.startedAt).slice(0, 30) : null;
  return { title, durationMin, startedAt };
}

/** Normalisasi papan tim misi (maks 8 tim, 20 anggota per tim). */
export function cleanTeams(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const teams = (Array.isArray(raw.teams) ? raw.teams : []).slice(0, 8).map((t) => ({
    name: str(t?.name, 80),
    task: str(t?.task, 200),
    members: (Array.isArray(t?.members) ? t.members : []).slice(0, 20).map((m) => str(m, 80)).filter(Boolean),
    done: Boolean(t?.done),
  })).filter((t) => t.name);
  if (!teams.length) return null;
  return { teams };
}
