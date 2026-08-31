/**
 * Sync BAKU_TAU_WA_GROUP_URL from local .env to Vercel preview + production.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';

const val = process.env.BAKU_TAU_WA_GROUP_URL?.trim();
if (!val) {
  console.error('BAKU_TAU_WA_GROUP_URL missing in .env');
  process.exit(1);
}

for (const env of ['preview', 'production']) {
  console.log(`> vercel env add BAKU_TAU_WA_GROUP_URL ${env}`);
  execSync(`vercel env add BAKU_TAU_WA_GROUP_URL ${env} --force`, {
    input: val,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

console.log('✓ BAKU_TAU_WA_GROUP_URL synced to Vercel preview + production');
