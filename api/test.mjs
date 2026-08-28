export default async function handler(req, res) {
  res.json({ ok: true, message: 'Test endpoint works', timestamp: new Date().toISOString() });
}