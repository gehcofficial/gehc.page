/**
 * ID tenant Pemuda.
 *
 * Bukan pengganti `tenantForWrite(req)`. Hanya untuk data historis yang
 * memang milik unit Pemuda (seed, Creative Lab Beyonders, bundel access-group
 * tanpa kolom tenant) dan fallback host tak dikenal di `host-context.mjs`.
 */
export const YOUTH_TENANT_ID = 'tenant-youth';
