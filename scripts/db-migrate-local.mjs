/**
 * Jalankan semua migrasi TiDB idempotent (server/_migrate-*.cjs) + prisma generate.
 * Aman dijalankan berulang — hanya menambah kolom/tabel yang belum ada.
 *
 * Usage:
 *   npm run db:migrate:local
 *   npm run db:migrate:local:staging
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Urutan penting — jangan diacak */
const STEPS = [
  {
    script: 'server/_migrate-profile-phase1.cjs',
    label: 'Profil fase 1 (work_industry, work_role, major_other)',
    required: true,
  },
  {
    script: 'server/_migrate-profile-church-request.cjs',
    label: 'Permintaan ubah data gereja',
    required: true,
  },
  {
    script: 'server/_migrate-jethro-placement.cjs',
    label: 'Jethro placement batches',
    required: false,
  },
  {
    script: 'server/_migrate-birth-date.cjs',
    label: 'Tanggal lahir (birth_date)',
    required: true,
  },
  {
    script: 'server/_migrate-org-hierarchy.cjs',
    label: 'Org hierarchy (org_nodes, org_assignments, membership_kind)',
    required: true,
  },
  {
    script: 'server/_migrate-waiting-pool.cjs',
    label: 'Waiting pool onboarding table (waiting_pool)',
    required: true,
  },
  {
    script: 'server/_migrate-event-workspace.cjs',
    label: 'Event workspace (EventProgram, EventDivision, EventMeeting)',
    required: true,
  },
  {
    script: 'server/_migrate-e10-bakutau.cjs',
    label: 'E10 BAKU TAU (domicile, whatsapp_group_url, claim_token)',
    required: true,
  },
  {
    script: 'server/_migrate-bakutau-venue.cjs',
    label: 'BAKU TAU venue (GMIM Eben Haezer, 12 Sep 2026)',
    required: true,
  },
  {
    script: 'server/_migrate-event-attendees.cjs',
    label: 'Event attendees (event_attendees)',
    required: true,
  },
  {
    script: 'server/_migrate-testimonials.cjs',
    label: 'Landing testimonials (testimonials)',
    required: true,
  },
  {
    script: 'server/_migrate-must-change-password.cjs',
    label: 'Local auth must_change_password',
    required: true,
  },
];

const strict = process.argv.includes('--strict');

function runStep(step) {
  const scriptPath = path.join(root, step.script);
  console.log(`\n▶ ${step.label}`);
  console.log(`  node ${step.script}`);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  const out = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  if (out) console.log(out.split('\n').map((l) => `  ${l}`).join('\n'));

  if (result.status !== 0) {
    const msg = `Gagal: ${step.script} (exit ${result.status})`;
    if (step.required) {
      console.error(`\n❌ ${msg}`);
      if (!strict && step.script.includes('placement')) {
        console.warn('   (placement opsional — lanjut jika belum pakai fitur Jethro placement)');
        return { ok: false, optional: true };
      }
      process.exit(result.status || 1);
    }
    console.warn(`\n⚠️  ${msg} — dilewati (opsional)`);
    return { ok: false, optional: true };
  }

  console.log('  ✓ selesai');
  return { ok: true };
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL tidak ada — isi .env atau gunakan db:migrate:local:staging');
    process.exit(1);
  }

  console.log('=== GEHC db:migrate:local ===');
  console.log(`Database: ${maskDbUrl(process.env.DATABASE_URL)}`);

  const results = STEPS.map(runStep);

  console.log('\n▶ prisma generate');
  const gen = spawnSync('npx', ['prisma', 'generate'], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    env: process.env,
  });
  if (gen.stdout?.trim()) console.log(gen.stdout.trim());
  if (gen.status !== 0) {
    const err = (gen.stderr || gen.stdout || '').trim();
    if (err.includes('EPERM') && err.includes('query_engine')) {
      console.warn('\n⚠️  prisma generate gagal (file terkunci — stop dev server dulu, lalu ulangi).');
      console.warn('   Migrasi kolom/tabel sudah selesai; client Prisma mungkin masih valid.\n');
    } else {
      console.error(err || 'prisma generate gagal');
      process.exit(gen.status || 1);
    }
  } else {
    console.log('  ✓ prisma client diperbarui');
  }

  const failedRequired = results.filter((r, i) => STEPS[i].required && r && !r.ok);
  console.log('\n=== Ringkasan ===');
  if (failedRequired.length) {
    console.log('⚠️  Beberapa langkah wajib gagal — periksa log di atas.');
    process.exit(1);
  }
  console.log('✓ Schema lokal sinkron. Jalankan: npm run dev:all');
}

function maskDbUrl(url) {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '').split('?')[0];
    return `${u.hostname}:${u.port || 4000}/${db}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

main();
