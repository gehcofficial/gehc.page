import { narrateDashboard } from '../server/jethro-ai.mjs';

export default async function handler(req, res) {
  try {
    console.log('Testing jethro-ai module...');
    return res.json({ ok: true, message: 'Jethro AI module works' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
}