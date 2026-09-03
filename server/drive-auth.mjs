/**
 * Sekali jalan: OAuth akun Google One → refresh token untuk seed/unggah Drive.
 * Jalankan: npm run drive:auth
 *
 * Google Cloud Console → OAuth client → Authorized redirect URIs:
 *   http://127.0.0.1:8765/drive-auth/callback
 */
import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import {
  AUTH_PORT,
  AUTH_REDIRECT,
  DRIVE_USER_SCOPE,
  TOKEN_PATH,
  getOAuthClient,
  saveTokens,
} from './lib/gdrive-user-oauth.mjs';

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `cmd /c start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function main() {
  const oauth2 = getOAuthClient();
  const { verifier, challenge } = pkcePair();
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_USER_SCOPE],
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', AUTH_REDIRECT);
    if (url.pathname !== '/drive-auth/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const err = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    if (err || !code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<p>OAuth ditolak: ${err || 'tanpa code'}. Tutup tab ini.</p>`);
      server.close();
      process.exit(1);
      return;
    }
    try {
      const { tokens } = await oauth2.getToken({ code, codeVerifier: verifier });
      if (!tokens.refresh_token) {
        throw new Error(
          'Google tidak mengirim refresh_token. Hapus akses app di https://myaccount.google.com/permissions lalu ulangi npm run drive:auth.'
        );
      }
      saveTokens(tokens);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<p>Drive terhubung. Token disimpan. Anda boleh menutup tab ini dan kembali ke terminal.</p>'
      );
      console.log(`Token disimpan: ${TOKEN_PATH}`);
      console.log('Lanjut: npm run drive:seed-visuals');
      server.close();
      process.exit(0);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<p>Gagal menukar code: ${e.message}</p>`);
      console.error(e.message || e);
      server.close();
      process.exit(1);
    }
  });

  server.listen(AUTH_PORT, '127.0.0.1', () => {
    const viaServer = `http://localhost:${process.env.PORT || 8787}/api/drive-auth/start`;
    console.log(`Fallback listener: ${AUTH_REDIRECT}`);
    console.log('Utama (pakai callback login yang sudah ada):');
    console.log(`  ${viaServer}`);
    console.log('Daftarkan di OAuth client bila belum:');
    console.log('  http://localhost:8787/api/auth/google/callback');
    console.log(`  ${AUTH_REDIRECT}`);
    console.log('Login sebagai PEMILIK folder root Google Drive (akun Google One).\n');
    console.log(authUrl);
    console.log('');
    openBrowser(authUrl);
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
