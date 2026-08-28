import { getDashboard, runScan, recommendPlacement, executeSplit, executeMerge, shuffleRole, markAlumni } from '../server/engine.mjs';

export default async function handler(req, res) {
  try {
    console.log('Testing engine module...');
    return res.json({ ok: true, message: 'Engine module works' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
}