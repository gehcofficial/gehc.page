/**
 * Sync GITHUB_PUBLISH_* from local .env to Vercel preview + production.
 * Requires: npx vercel login (once)
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';

const keys = ['GITHUB_PUBLISH_TOKEN', 'GITHUB_REPO', 'GITHUB_PUBLISH_WORKFLOW'];
const values = {};
for (const key of keys) {
  const val = process.env[key]?.trim();
  if (!val) {
    if (key === 'GITHUB_PUBLISH_TOKEN') {
      console.error(`${key} missing in .env`);
      process.exit(1);
    }
    continue;
  }
  values[key] = val;
}

for (const env of ['preview', 'production']) {
  for (const [key, val] of Object.entries(values)) {
    console.log(`> vercel env add ${key} ${env}`);
    execSync(`vercel env add ${key} ${env} --force`, {
      input: val,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  }
}

console.log('✓ GITHUB_PUBLISH_* synced to Vercel preview + production');
console.log('  Redeploy staging/production agar badge "Token CI" hilang.');
