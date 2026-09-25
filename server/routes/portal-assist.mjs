import { requireRole } from '../auth.mjs';
import { jethroGenerateText } from '../ai-provider.mjs';
import { portalCatalogForRole } from '../lib/portal-feature-catalog.mjs';

const MAX_QUESTION = 500;

function parseJsonLoose(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * POST /api/portal/ask — asisten fitur portal (Tanya AI).
 * Katalog difilter per peran; AI tidak mengeksekusi aksi apa pun.
 */
export function registerPortalAssistRoutes(app, { wrap }) {
  app.post('/api/portal/ask', requireRole(), wrap(async (req, res) => {
    const hasKey = Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY);
    if (!hasKey) return res.status(503).json({ error: 'Asisten AI belum dikonfigurasi.' });

    const question = String(req.body?.question || '').trim().slice(0, MAX_QUESTION);
    if (!question) return res.status(400).json({ error: 'Pertanyaan wajib diisi.' });

    const roles = (req.authUser?.roles || []).map((r) => r.role);
    const catalog = portalCatalogForRole(roles);
    const allowedPages = new Set(catalog.map((f) => f.page));
    const catalogText = catalog
      .map((f, i) => `${i + 1}. id=${f.id} | ${f.title} | page=${f.page} | ${f.purpose}`)
      .join('\n');

    const system = [
      'You are the GEHC Youth portal assistant. Answer in Indonesian, concise (max 3 sentences).',
      'Then give up to 4 short actionable steps.',
      'Only use the features listed below for this user\'s role. Never invent features.',
      'Pick the single best "page" id from the list.',
      'Respond ONLY as JSON: {"answer": string, "steps": string[], "page": string}.',
      '',
      'Fitur yang tersedia untuk peran ini:',
      catalogText,
    ].join('\n');

    let text;
    try {
      text = (await jethroGenerateText({ system, prompt: question, maxOutputTokens: 400 })).text;
    } catch (e) {
      console.error('[portal-assist] gagal:', e?.message || e);
      return res.status(502).json({ error: 'Asisten gagal menjawab. Coba pencarian kata kunci.' });
    }

    const parsed = parseJsonLoose(text);
    const page = parsed && typeof parsed.page === 'string' && allowedPages.has(parsed.page) ? parsed.page : null;
    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps.filter((s) => typeof s === 'string' && s.trim()).slice(0, 6)
      : [];
    const answer = typeof parsed?.answer === 'string' && parsed.answer.trim()
      ? parsed.answer.trim()
      : (typeof text === 'string' ? text.slice(0, 600) : '');

    res.json({ answer, steps, page });
  }));
}
