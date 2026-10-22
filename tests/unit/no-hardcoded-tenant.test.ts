import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Literal tenant Pemuda hanya boleh hidup di peta host/BIPRA dan seed/migrasi.
 * Request baru memakai tenantForWrite / resolveRoleTenant.
 */
const ALLOW = new Set([
  'server/lib/tenant-defaults.mjs',
  'server/lib/host-context.mjs',
  'server/lib/tenant-map.mjs',
  'server/lib/church-p1.mjs',
  'server/lib/report-data.mjs',
  'server/routes/unit-landing.mjs',
]);

function walk(dir: string, out: string[] = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.relative(process.cwd(), abs).split(path.sep).join('/');
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      if (name === 'node_modules') continue;
      walk(abs, out);
      continue;
    }
    if (!/\.(mjs|js|cjs|ts)$/.test(name)) continue;
    const base = path.basename(name);
    if (base.startsWith('seed') || base.startsWith('_')) continue;
    if (ALLOW.has(rel)) continue;
    out.push(rel);
  }
  return out;
}

describe('no new hardcoded youth tenant', () => {
  it('server request code does not embed the youth tenant id', () => {
    const hits: string[] = [];
    for (const rel of walk(path.join(process.cwd(), 'server'))) {
      const text = fs.readFileSync(rel, 'utf8');
      if (text.includes('tenant-youth')) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});
