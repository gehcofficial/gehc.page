/**
 * Usulan peran pelayanan — re-export katalog baku (satu sumber di server).
 */

export {
  displayServiceRoleName,
  buildResponsibleGroupCaption,
  buildBodCaptionLinks,
  rolesForPattern,
  WORSHIP_ORDER_ROLES,
  resolveRoleKey,
  canonicalLabel,
  ownerScopeForRoleKey,
  WORSHIP_PATTERN_CODES,
} from '../../server/lib/serving-role-catalog.mjs';

export type ProposedServingRole = {
  order: number;
  segment: string;
  roleKey?: string;
  name: string;
  division: string;
  optional: boolean;
  note: string;
};
