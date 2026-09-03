/**
 * OAuth akun Google One untuk tulis Drive (kuota manusia, bukan SA).
 * Token: .gdrive-user-token.json atau GDRIVE_USER_REFRESH_TOKEN.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

export const DRIVE_USER_SCOPE = 'https://www.googleapis.com/auth/drive';
export const AUTH_PORT = 8765;
export const AUTH_REDIRECT = `http://127.0.0.1:${AUTH_PORT}/drive-auth/callback`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TOKEN_PATH = join(ROOT, '.gdrive-user-token.json');

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID wajib di .env.');
  }
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || undefined;
  if (!clientSecret) {
    console.warn(
      'GOOGLE_CLIENT_SECRET kosong — memakai PKCE (public client).\n' +
        `Tambahkan redirect URI: ${AUTH_REDIRECT}`
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, AUTH_REDIRECT);
}

function loadSavedTokens() {
  if (process.env.GDRIVE_USER_REFRESH_TOKEN) {
    return {
      refresh_token: process.env.GDRIVE_USER_REFRESH_TOKEN,
      token_type: 'Bearer',
    };
  }
  if (existsSync(TOKEN_PATH)) {
    return JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  }
  return null;
}

export function saveTokens(tokens) {
  const prev = existsSync(TOKEN_PATH) ? JSON.parse(readFileSync(TOKEN_PATH, 'utf8')) : {};
  const next = { ...prev, ...tokens };
  writeFileSync(TOKEN_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function hasUserDriveToken() {
  return Boolean(loadSavedTokens()?.refresh_token);
}

/** Drive client sebagai pemilik Google One. */
export async function getUserDrive() {
  const tokens = loadSavedTokens();
  if (!tokens?.refresh_token) {
    throw new Error(
      'Belum ada token Drive user. Jalankan: npm run drive:auth\n' +
        `(login sebagai pemilik folder root, izinkan scope Drive, token tersimpan di ${TOKEN_PATH})`
    );
  }
  const auth = getOAuthClient();
  auth.setCredentials(tokens);
  auth.on('tokens', (fresh) => {
    if (fresh.access_token || fresh.refresh_token) saveTokens(fresh);
  });
  return google.drive({ version: 'v3', auth });
}
