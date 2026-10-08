/**
 * Baseline pola-untuk-alur pembekalan: pola ibadah yang dipakai saat
 * Bagian A/B (deliveryPlan/prepChecklist/discussionFlow) terakhir disegarkan.
 *
 * Disimpan di localStorage per pekan (tanpa mengubah skema DB): bila pola
 * pekan diganti sesudahnya, alur lama dianggap basi sampai disegarkan ulang
 * via endpoint `/extras`.
 */

export function flowBaselineKey(yearMonth: string, weekIndex: number): string {
  return `didaskalia-flow-pattern:${yearMonth}:${weekIndex}`;
}

export function readFlowBaseline(yearMonth: string, weekIndex: number): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(flowBaselineKey(yearMonth, weekIndex));
  } catch {
    return null;
  }
}

export function writeFlowBaseline(yearMonth: string, weekIndex: number, patternCode: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(flowBaselineKey(yearMonth, weekIndex), String(patternCode || 'MONOLOG').toUpperCase());
  } catch {
    /* abaikan */
  }
}

/** Basi bila ada baseline tercatat + pola aktif berbeda + alur sudah terisi. */
export function isFlowStale(baseline: string | null, patternCode: string | undefined, flowCount: number): boolean {
  if (!baseline || flowCount <= 0) return false;
  return baseline.toUpperCase() !== String(patternCode || 'MONOLOG').toUpperCase();
}
