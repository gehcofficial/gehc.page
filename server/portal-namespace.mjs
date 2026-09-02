/** Role → URL namespace (shared server + client semantics). */
export const ROLE_NAMESPACE = {
  SUPERADMIN: 'superadmin',
  BPMJ: 'bpmj',
  KOMISI: 'komisi',
  COMMITTEE: 'committee',
  MENTOR: 'mentor',
  CO_MENTOR: 'co-mentor',
  MENTEE: 'mentee',
  ALUMNI: 'alumni',
};

export function roleToNamespace(role) {
  return ROLE_NAMESPACE[role] || 'mentee';
}

export function namespaceToRole(ns) {
  const entry = Object.entries(ROLE_NAMESPACE).find(([, v]) => v === ns);
  return entry ? entry[0] : null;
}
