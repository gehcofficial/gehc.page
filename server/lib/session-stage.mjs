/**
 * Status panggung sesi (modul rounds / screening / teams / fgd / song) — validasi murni.
 * Disimpan di config sesi — tanpa migrasi skema.
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

/** Normalisasi trigger pertanyaan mentor (MONOLOG gabungan): Q 0-5 + siapa pemicu. */
export function cleanFgd(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const currentQ = Math.min(5, Math.max(0, Number(raw.currentQ) || 0));
  const triggerBy = ['MENTOR', 'CO_MENTOR', 'PERWAKILAN'].includes(String(raw.triggerBy || '').toUpperCase())
    ? String(raw.triggerBy).toUpperCase()
    : null;
  const triggerName = str(raw.triggerName, 80) || null;
  return { currentQ, triggerBy, triggerName };
}

/** Normalisasi timer diskusi kelompok (MONOLOG gabungan): mulai/henti terpisah dari timer sesi. */
export function cleanDiscussion(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const startedAt = raw.startedAt ? String(raw.startedAt).slice(0, 30) : null;
  if (!startedAt) return null;
  const durationSec = Math.min(7200, Math.max(60, Number(raw.durationSec) || 1500));
  return { startedAt, durationSec };
}

/** Normalisasi lagu bedah (MONOLOG gabungan). */
export function cleanSong(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = str(raw.title, 200);
  if (!title) return null;
  return { title, about: str(raw.about, 2000), singer: str(raw.singer, 120) };
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
