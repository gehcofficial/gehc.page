import { resolveAccess, matrixForUser, parseTag } from '../server/gdrive-policy.mjs';

export default async function handler(req, res) {
  try {
    console.log('Testing gdrive-policy module...');
    console.log('parseTag:', parseTag('test [GROUP:test]'));
    return res.json({ ok: true, message: 'GDrive Policy module works' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
}