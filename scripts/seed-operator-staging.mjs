/**
 * Seed platform operator for local/staging (idempotent).
 * Usage: npm run db:seed:operator:staging
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { upsertOperator } from '../server/platform-auth.mjs';

const email = process.env.OPERATOR_SEED_EMAIL || 'ops-staging@gehc.demo';
const password = process.env.OPERATOR_SEED_PASSWORD || process.env.DEMO_PASSWORD || 'password123';
const displayName = process.env.OPERATOR_SEED_NAME || 'GEHC Platform Ops (Staging)';

const op = await upsertOperator({
  id: 'op-staging-root',
  email,
  displayName,
  password,
});

console.log(`✓ Platform operator: ${op.email} (id=${op.id})`);
console.log('  Login: #/admin → break-glass atau passkey');
console.log('  WEBAUTHN_MOCK=true untuk E2E tanpa passkey fisik');
