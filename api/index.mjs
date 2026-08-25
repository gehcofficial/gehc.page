/**
 * Vercel serverless entry — membungkus Express app dari server/index.mjs.
 * app.listen() di server/index.mjs otomatis dilewati saat process.env.VERCEL aktif.
 */
import app from '../server/index.mjs';

export default app;