import { attachUser, requireRole, setSessionCookie, clearSessionCookie, loginWithGoogleCredential, verifyGoogleCredential, hashPassword, verifyPassword, loginLocal, isSuperadminEmail } from '../server/auth.mjs';

export default async function handler(req, res) {
  try {
    console.log('Testing auth module...');
    console.log('isSuperadminEmail:', isSuperadminEmail('test@test.com'));
    return res.json({ ok: true, message: 'Auth module works' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
}