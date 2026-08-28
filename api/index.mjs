import 'dotenv/config';
import express from 'express';

const app = express();

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/api/auth/config', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    configured: Boolean(process.env.GOOGLE_CLIENT_ID),
  });
});

export default app;