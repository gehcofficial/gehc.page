/**
 * Sinkron key AI (OpenAI/Groq) dari `.env` lokal → Vercel (Production + Preview).
 *
 * Studio Didaskalia & asisten portal memakai `server/ai-provider.mjs`
 * (OPENAI_API_KEY utama, GROQ_API_KEY fallback). Bila key belum ada di Vercel,
 * AI gagal ("API key missing").
 *
 * Prasyarat: `vercel login` + repo tertaut (`vercel link`).
 *   npm run env:sync-ai-keys
 *
 * Nilai TIDAK dicetak (hanya nama key). Redeploy setelah ini agar berlaku.
 */
import 'dotenv/config';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const KEYS = ['OPENAI_API_KEY', 'GROQ_API_KEY', 'AI_MODEL_MAIN', 'AI_MODEL_FALLBACK'];

const present = KEYS.filter((k) => {
  const v = process.env[k];
  return v && String(v).trim();
});

if (!present.length) {
  console.error('Tidak ada key AI di .env (OPENAI_API_KEY/GROQ_API_KEY).');
  process.exit(1);
}

console.log(`Key yang akan disinkronkan: ${present.join(', ')}`);

for (const key of present) {
  const value = String(process.env[key]).trim();
  for (const env of ['preview', 'production']) {
    try {
      execSync(`vercel env add ${key} ${env} --value "${value}" --force --yes --sensitive`, {
        cwd: root,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      console.log(`  ✓ ${key} → ${env}`);
    } catch {
      console.error(`  ✗ gagal ${key} → ${env} (cek vercel login/link)`);
    }
  }
}

console.log('\nSelesai. Redeploy produksi (push commit / Redeploy di Vercel) agar berlaku.');
