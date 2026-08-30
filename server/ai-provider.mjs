/**
 * Centralized AI Provider — Vercel AI SDK (OpenAI + Groq fallback)
 * Mirrors AISIGHT ai-provider.ts pattern adapted for GEHC Express server.
 *
 * Env: OPENAI_API_KEY, GROQ_API_KEY, AI_MODEL_MAIN, AI_MODEL_FALLBACK
 */
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

// ---------------------------------------------------------------------------
// Provider factories
// ---------------------------------------------------------------------------
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = process.env.GROQ_API_KEY
  ? createGroq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------
export function mainModel() {
  const id = process.env.AI_MODEL_MAIN || 'gpt-4o-mini';
  return openai.chat(id);
}

export function fallbackModel() {
  if (!groq) return null;
  const id = process.env.AI_MODEL_FALLBACK || 'openai/gpt-oss-20b';
  return groq.chat(id);
}

// ---------------------------------------------------------------------------
// isRetryable — same logic as AISIGHT
// ---------------------------------------------------------------------------
function isRetryableError(error) {
  if (!error) return false;
  const name = error.name || '';
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  if (error.statusCode != null) {
    return error.statusCode === 408 || error.statusCode === 429 || error.statusCode >= 500;
  }
  return false;
}

// ---------------------------------------------------------------------------
// jethroGenerateText — try main, fallback on retryable error
// ---------------------------------------------------------------------------
export async function jethroGenerateText({ system, prompt, maxTokens = 1024 }) {
  const models = [mainModel(), fallbackModel()].filter(Boolean);

  let lastError;
  for (const model of models) {
    try {
      const { text } = await generateText({
        model,
        system,
        prompt,
        maxTokens,
      });
      return text.trim();
    } catch (err) {
      console.error('[ai-provider] Model failed:', model?.modelId || model, err.message);
      if (!isRetryableError(err)) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('No AI models available');
}

// ---------------------------------------------------------------------------
// jethroGenerateObject — structured output with JSON
// ---------------------------------------------------------------------------
export async function jethroGenerateObject({ system, prompt, schema }) {
  const models = [mainModel(), fallbackModel()].filter(Boolean);

  let lastError;
  for (const model of models) {
    try {
      const { object } = await generateText({
        model,
        system,
        prompt,
        experimental_output: schema,
      });
      return object;
    } catch (err) {
      console.error('[ai-provider] Object generation failed:', model?.modelId || model, err.message);
      if (!isRetryableError(err)) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('No AI models available');
}
