import type { GroupBatch } from '../types';

/**
 * Satu sumber kebenaran untuk Family Tree batch berjalan.
 *
 * Aturan (keputusan audit hantu Okt 2026): pohon batch BERJALAN hanya
 * menampilkan mentee berstatus ACTIVE. ALUMNI / PAST / MOVED tetap
 * tersimpan dan hanya tampil di tab Riwayat/Regenerasi (badge warna).
 * Tanpa helper ini, penghapusan/penandaan alumni tidak tercermin di pohon
 * (kasus Nicole — baris orphan/MOVED/ALUMNI tetap tampil).
 */

export type TreeMentee = {
  name: string;
  note?: string;
  avatar?: string;
  status?: string;
};

export const isActiveMentee = (m: Pick<TreeMentee, 'status'> | null | undefined): boolean =>
  String(m?.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

/** Mentee untuk pohon batch berjalan (selalu ACTIVE saja). */
export function activeMentees(batch: Pick<GroupBatch, 'mentees'> | null | undefined): TreeMentee[] {
  return ((batch?.mentees || []) as TreeMentee[]).filter(isActiveMentee);
}

/** Semua mentee untuk tampilan riwayat (generasi lalu ikut tercatat). */
export function historyMentees(batch: Pick<GroupBatch, 'mentees'> | null | undefined): TreeMentee[] {
  return [...((batch?.mentees || []) as TreeMentee[])];
}
