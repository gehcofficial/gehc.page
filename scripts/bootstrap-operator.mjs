#!/usr/bin/env node
/**
 * Bootstrap production platform operator (run once).
 * Default: create if missing, never rotate an existing password.
 * Rotate only with OPERATOR_ROTATE=true.
 * Usage: npm run operator:bootstrap:prod
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ensureOperator, loadOperatorByEmail, upsertOperator } from '../server/platform-auth.mjs';

const rl = readline.createInterface({ input, output });
const rotate = String(process.env.OPERATOR_ROTATE || '').toLowerCase() === 'true';

const email = (process.env.OPERATOR_BOOTSTRAP_EMAIL || (await rl.question('Email operator prod: '))).toLowerCase().trim();
const displayName = process.env.OPERATOR_BOOTSTRAP_NAME || (await rl.question('Nama tampilan [GEHC Platform Ops]: ')) || 'GEHC Platform Ops';

const existing = await loadOperatorByEmail(email);
if (existing && !rotate) {
  rl.close();
  console.log('\n✓ Operator sudah ada — password/passkey tidak diubah');
  console.log(`  ID:    ${existing.id}`);
  console.log(`  Email: ${existing.email}`);
  console.log('  Set OPERATOR_ROTATE=true hanya jika memang ingin ganti break-glass.');
  process.exit(0);
}

const genPass = crypto.randomBytes(18).toString('base64url');
const useGen = (await rl.question(`Generate break-glass password? [Y/n]: `)).toLowerCase() !== 'n';
const password = useGen ? genPass : (await rl.question('Password break-glass: '));

const op = rotate
  ? await upsertOperator({
      id: existing?.id || `op-${crypto.randomBytes(16).toString('hex')}`,
      email,
      displayName,
      password: password || genPass,
    })
  : await ensureOperator({
      id: `op-${crypto.randomBytes(16).toString('hex')}`,
      email,
      displayName,
      password: password || genPass,
    });

rl.close();

console.log('\n✓ Operator bootstrap selesai');
console.log(`  ID:    ${op.id}`);
console.log(`  Email: ${op.email}`);
if (useGen) {
  console.log(`  Break-glass password (simpan di vault, rotate kuartal):`);
  console.log(`  ${password || genPass}`);
}
console.log('\nLangkah berikutnya:');
console.log('  1. Buka #/admin di production');
console.log('  2. Login break-glass → daftarkan passkey');
console.log('  3. Assign platform admin ke staf tech via UI');
