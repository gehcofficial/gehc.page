import type { PortalId } from './portal-profiles';

export type YouthBodPanelAccessCtx = {
  portalId: PortalId;
  isSuperAdmin?: boolean;
  isBodTimkerja?: boolean;
};

/** BOD Tim Kerja Youth + SUPERADMIN — bukan divisi/HOD saja. */
export function canAccessYouthBodPanel(ctx: YouthBodPanelAccessCtx): boolean {
  if (ctx.portalId !== 'youth') return false;
  return Boolean(ctx.isSuperAdmin || ctx.isBodTimkerja);
}

export const BOD_PANEL_TABS = ['penatalayan', 'antrean', 'caption', 'rundown', 'sesi'] as const;
export type BodPanelTab = (typeof BOD_PANEL_TABS)[number];

export function parseBodPanelTab(raw: string | null | undefined): BodPanelTab {
  const t = String(raw || '').toLowerCase();
  return (BOD_PANEL_TABS as readonly string[]).includes(t) ? (t as BodPanelTab) : 'penatalayan';
}
