import type { UserRole } from '../types';

/**
 * Aksi lintas-panel yang tidak selalu punya item nav sendiri.
 * Judul/langkah ada di i18n `portal.search.actions.<id>`.
 */
export type PortalActionDef = {
  id: string;
  /** PortalPage tujuan (id tab) — lihat `src/lib/portal-routes.ts`. */
  page: string;
  /** Peran yang boleh menjalankan. Kosong = semua peran. */
  requiredRoles?: UserRole[];
};

export const PORTAL_ACTIONS: PortalActionDef[] = [
  { id: 'event-penatalayan', page: 'events', requiredRoles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'] },
  { id: 'event-add-division', page: 'events', requiredRoles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'] },
  { id: 'event-create', page: 'events', requiredRoles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'] },
  { id: 'upload-rhb', page: 'divisions', requiredRoles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE'] },
  { id: 'people-provision', page: 'people', requiredRoles: ['SUPERADMIN', 'KOMISI'] },
  { id: 'wa-channels', page: 'wa-channels', requiredRoles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'] },
  { id: 'manage-warta', page: 'content-weekly', requiredRoles: ['SUPERADMIN', 'COMMITTEE'] },
  { id: 'write-kesaksian', page: 'kesaksian', requiredRoles: ['MENTEE'] },
  { id: 'request-prayer', page: 'pastoral-care' },
  { id: 'open-event-info', page: 'event-info' },
  { id: 'send-announcement', page: 'announcements', requiredRoles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ', 'MENTOR', 'CO_MENTOR'] },
  { id: 'broadcast-wa', page: 'groups-monitoring', requiredRoles: ['SUPERADMIN', 'KOMISI', 'MENTOR', 'CO_MENTOR'] },
];

export const PORTAL_ACTION_IDS = PORTAL_ACTIONS.map((a) => a.id);
