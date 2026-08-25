/**
 * Jalankan Backend Express (8787) + Frontend Vite (3000) sekaligus.
 * Satu perintah: npm run dev:all
 * Ctrl+C sekali → kedua proses ikut mati.
 */
import { spawn } from 'node:child_process';

const children = [];

function run(name, command, args, color) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  children.push(child);

  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) out(`${tag} ${line}`);
    });
  };
  pipe(child.stdout, console.log);
  pipe(child.stderr, console.error);

  child.on('exit', (code) => {
    console.log(`${tag} keluar (code ${code})`);
    if (code !== null && code !== 0) shutdown(code ?? 1);
  });
  return child;
}

function shutdown(exitCode = 0) {
  for (const c of children) {
    try { c.kill(); } catch { /* abaikan */ }
  }
  process.exit(exitCode);
}

console.log('▶ Menjalankan Backend (8787) + Frontend (3000)…');
run('server', 'node', ['server/index.mjs'], '36');   // cyan
run('vite', 'npx', ['vite', '--port=3000', '--host=0.0.0.0'], '35'); // magenta

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
