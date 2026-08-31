export const DOMICILE_KINDS = ['KOSTAN', 'SBH', 'NBH', 'ELVIS', 'MONROE', 'KGR', 'OTHER'];

export const DOMICILE_DETAIL_REQUIRED = new Set(['KOSTAN', 'OTHER']);

export function emptyDomicileStats() {
  return Object.fromEntries(DOMICILE_KINDS.map((k) => [k, 0]));
}

export function isValidDomicileKind(kind) {
  return DOMICILE_KINDS.includes(String(kind));
}
