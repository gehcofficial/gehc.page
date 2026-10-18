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
  // Pengumuman tambahan pre-roll layar (maks 6 baris, tiap baris 140 huruf).
  const preShow = (Array.isArray(raw.preShow) ? raw.preShow : [])
    .map((line) => str(line, 140).trim())
    .filter(Boolean)
    .slice(0, 6);
  return { title, durationMin, startedAt, preShow };
}

/**
 * Tebak durasi film (menit) dari judul draf — mis. "…(2017, 112 menit — …)" → 112.
 * Hanya angka 2–3 digit tepat sebelum kata "menit" (tahun 4-digit diabaikan).
 * Fallback 90 (slot F1 Pemutaran film).
 */
export function parseFilmDurationMin(title) {
  const m = String(title || '').match(/(\d{2,3})\s*menit/i);
  if (!m) return 90;
  return Math.min(180, Math.max(10, Number(m[1])));
}

/** Normalisasi gate Likert 2 ronde (BEDAH_FILM): AWAL (baseline) & AKHIR (ukur delta). */
export function cleanLikertRounds(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const gate = (v, fallback) => {
    const s = String(v ?? fallback).toLowerCase();
    return s === 'closed' ? 'closed' : 'open';
  };
  return { pre: gate(raw.pre, 'open'), post: gate(raw.post, 'closed') };
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

/** Nama fase MONOLOG yang sah (20'/25'/10'/5' = 60 menit). */
export const MONOLOG_PHASES = ['F1', 'F2', 'F3', 'CLOSING'];

/** Timer langkah BEDAH_FILM (tanpa timer sesi penuh): M0 Likert AWAL 5', M3 Likert AKHIR 5', M4 Undi & Kesaksian 10'. */
export const FILM_PHASES = ['M0', 'M3', 'M4'];

/** Durasi baku tiap fase MONOLOG (detik): F1 20' + F2 25' + F3 10' + Closing 5'. */
export const MONOLOG_PHASE_SECONDS = { F1: 1200, F2: 1500, F3: 600, CLOSING: 300 };

/** Durasi baku timer langkah film (detik): AWAL 5' + AKHIR 5' + Undi 10'. */
export const FILM_PHASE_SECONDS = { M0: 300, M3: 300, M4: 600 };

/** Normalisasi timer fase (MONOLOG F1/F2/F3/CLOSING + langkah film M0/M3/M4): satu fase aktif + countdown display-only. Transisi selalu manual. */
export function cleanPhase(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = String(raw.name || '').toUpperCase();
  if (![...MONOLOG_PHASES, ...FILM_PHASES].includes(name)) return null;
  const startedAt = raw.startedAt ? String(raw.startedAt).slice(0, 30) : null;
  if (!startedAt) return null;
  const durationSec = Math.min(7200, Math.max(60, Number(raw.durationSec) || MONOLOG_PHASE_SECONDS[name] || FILM_PHASE_SECONDS[name]));
  // Tampil di layar proyektor? Default true (perilaku lama); false = hitung
  // diam-diam (HP peserta tetap melihat sisa waktu).
  const showOnScreen = raw.showOnScreen === undefined || raw.showOnScreen === null
    ? true
    : !(raw.showOnScreen === false || raw.showOnScreen === 0 || String(raw.showOnScreen).toLowerCase() === 'false');
  return { name, startedAt, durationSec, showOnScreen };
}

/**
 * Preferensi tiap fase (diatur kontrol sebelum/saat live): durasi + tampil.
 * Kunci tak dikenal dibuang; tiap fase selalu lengkap (default baku).
 */
export function cleanPhasePrefs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const keys = Object.keys(raw).filter((k) => MONOLOG_PHASES.includes(String(k).toUpperCase()));
  if (!keys.length) return null;
  const out = {};
  for (const name of MONOLOG_PHASES) {
    const r = raw[name] || {};
    const durationSec = Math.min(7200, Math.max(60, Number(r.durationSec) || MONOLOG_PHASE_SECONDS[name]));
    const showOnScreen = r.showOnScreen === undefined || r.showOnScreen === null
      ? true
      : !(r.showOnScreen === false || r.showOnScreen === 0 || String(r.showOnScreen).toLowerCase() === 'false');
    out[name] = { durationSec, showOnScreen };
  }
  return out;
}

/** Preferensi baku (durasi baku + tampil semua). */
export function defaultPhasePrefs() {
  const out = {};
  for (const name of MONOLOG_PHASES) {
    out[name] = { durationSec: MONOLOG_PHASE_SECONDS[name], showOnScreen: true };
  }
  return out;
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
