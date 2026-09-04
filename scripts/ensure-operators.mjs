/**
 * Ensure break-glass operators exist. Never rotates password_hash / passkeys.
 * Usage: npm run operator:ensure:prod
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i)] = v;
  }
  return out;
}

for (const [k, v] of Object.entries(loadEnvFile('.env.production'))) {
  if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
}
process.env.GEHC_ENV = 'production';
process.env.DB_TARGET = 'production';
delete process.env.VERCEL_ENV;

const { getDbLabel, resolveDatabaseUrl } = await import('../server/db.mjs');
const { ensureOperator, loadOperatorByEmail, loginOperatorLocal } = await import('../server/platform-auth.mjs');

const url = resolveDatabaseUrl();
const parsed = new URL(url);
const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
const label = getDbLabel();
console.log('DB', label);
if (!label.startsWith('production')) throw new Error(`Refusing non-production target: ${label}`);
if (/staging/i.test(`${parsed.hostname}/${dbName}`)) {
  throw new Error(`Refusing staging-looking URL: ${parsed.hostname}/${dbName}`);
}

const vaultPath = '.env.operator-breakglass.local';
const vault = { ...loadEnvFile(vaultPath) };

const accounts = [
  {
    email: 'superadmin@gehc.page',
    displayName: 'GEHC Superadmin',
    envKey: 'OPERATOR_SUPERADMIN_PASSWORD',
  },
  {
    email: 'admin@gehc.page',
    displayName: 'GEHC Admin',
    envKey: 'OPERATOR_ADMIN_PASSWORD',
  },
];

let vaultDirty = false;

for (const a of accounts) {
  const before = await loadOperatorByEmail(a.email);
  let password = process.env[a.envKey] || vault[a.email] || '';
  if (!before && !password) {
    password = crypto.randomBytes(18).toString('base64url');
    vault[a.email] = password;
    vaultDirty = true;
  }
  const op = await ensureOperator({
    id: `op-${crypto.randomBytes(16).toString('hex')}`,
    email: a.email,
    displayName: a.displayName,
    password: password || undefined,
  });
  const action = before ? 'kept' : 'created';
  console.log(`${action} ${op.email} id=${op.id} hasPassword=${Boolean(op.passwordHash)}`);
  if (!before && password) await loginOperatorLocal(a.email, password);
}

if (vaultDirty) {
  const lines = [
    '# Platform operator break-glass — local vault, do not commit',
    `# written ${new Date().toISOString()}`,
    ...accounts
      .map((a) => {
        const p = vault[a.email] || process.env[a.envKey];
        return p ? `${a.email}=${p}` : '';
      })
      .filter(Boolean),
  ];
  fs.writeFileSync(vaultPath, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log('vault updated (.env.operator-breakglass.local)');
} else {
  console.log('no password rotation');
}

for (const a of accounts) {
  const password = process.env[a.envKey] || vault[a.email];
  if (!password) continue;
  try {
    await loginOperatorLocal(a.email, password);
    console.log(`loginVerify ${a.email} ok`);
  } catch {
    console.log(`loginVerify ${a.email} vault-mismatch`);
  }
}
