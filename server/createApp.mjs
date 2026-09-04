import express from 'express';
import { attachUser } from './auth.mjs';
import { attachPlatformContext } from './lib/platform-rbac.mjs';

/**
 * Factory for Express app with shared middleware.
 * Route registration stays in index.mjs (or route modules) for now.
 */
export function createApp() {
  const app = express();

  app.set('json replacer', (_key, value) => (typeof value === 'bigint' ? Number(value) : value));

  const CORS_ALLOWED = String(process.env.CORS_ORIGIN || 'http://localhost:8787,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const reqOrigin = req.headers.origin;
    if (CORS_ALLOWED.includes('*')) {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (reqOrigin && CORS_ALLOWED.includes(reqOrigin)) {
      res.header('Access-Control-Allow-Origin', reqOrigin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '8mb' }));
  app.use(attachUser);
  app.use(attachPlatformContext);

  return app;
}
