const axios = require('axios');
const logger = require('../../../utils/logger');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

class AIProviderError extends Error {
  constructor(message, category) {
    super(message);
    this.name = 'AIProviderError';
    this.category = category; // AUTH | RATE_LIMIT | TIMEOUT | UNAVAILABLE | INVALID_MODEL | INVALID_RESPONSE | UNKNOWN
  }
}

function categorizeError(err) {
  const status = err?.response?.status;
  if (status === 400 && /API key/i.test(JSON.stringify(err?.response?.data || ''))) return 'AUTH';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 404) return 'INVALID_MODEL';
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') return 'TIMEOUT';
  if (status >= 500) return 'UNAVAILABLE';
  return 'UNKNOWN';
}

function toGeminiContents(messages) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
}

// Sleep helper for backoff
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function createGeminiProvider(opts = {}) {
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const initialModel = opts.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  if (!apiKey) {
    logger.warn('[AI Provider] GEMINI_API_KEY not set — Gemini provider will fail on first call.');
  }

  // Fallback candidate models if the primary model hits temporary 503 / UNAVAILABLE
  const fallbackCandidates = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

  return {
    name: 'gemini',
    model: initialModel,

    async chat(messages, systemPrompt) {
      const modelsToTry = [initialModel];
      for (const fb of fallbackCandidates) {
        if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
      }

      let lastError = null;

      for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
        const currentModel = modelsToTry[mIdx];

        // Try up to 2 attempts per model (with 1s backoff for 503 UNAVAILABLE / 429)
        for (let attempt = 1; attempt <= 2; attempt++) {
          const start = Date.now();
          try {
            const response = await axios.post(
              `${GEMINI_BASE_URL}/${currentModel}:generateContent`,
              {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: toGeminiContents(messages),
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: 2048,
                  topP: 0.95
                }
              },
              {
                params: { key: apiKey },
                headers: { 'Content-Type': 'application/json' },
                timeout: 35000
              }
            );

            const candidate = response?.data?.candidates?.[0];
            const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
            const usage = response?.data?.usageMetadata;

            if (!text) {
              const finishReason = candidate?.finishReason || 'UNKNOWN';
              throw new AIProviderError(`Gemini returned no content (finishReason: ${finishReason})`, 'INVALID_RESPONSE');
            }

            logger.debug(`[AI Provider] gemini (${currentModel}) chat ok — ${Date.now() - start}ms, tokens: ${usage?.totalTokenCount ?? 'n/a'}`);
            return text;
          } catch (err) {
            if (err instanceof AIProviderError) throw err;
            const category = categorizeError(err);
            const message = err?.response?.data?.error?.message || err.message;
            lastError = { category, message };

            // If it's a temporary 503 UNAVAILABLE or 429 RATE_LIMIT, backoff and retry
            if ((category === 'UNAVAILABLE' || category === 'RATE_LIMIT') && attempt === 1) {
              logger.warn(`[AI Provider] gemini (${currentModel}) high demand/rate-limit (${category}), retrying in 1.2s...`);
              await sleep(1200);
              continue;
            }

            // If 503 UNAVAILABLE persists on this model and we have another model to try, try fallback
            if (category === 'UNAVAILABLE' && mIdx < modelsToTry.length - 1) {
              logger.warn(`[AI Provider] gemini (${currentModel}) unavailable after retry. Falling back to ${modelsToTry[mIdx + 1]}...`);
              break; // break inner loop to try next model
            }

            // If non-retryable error (AUTH, INVALID_MODEL), fail immediately
            logger.error(`[AI Provider] gemini chat failed (${category}): ${message}`);
            throw new AIProviderError(message, category);
          }
        }
      }

      throw new AIProviderError(lastError?.message || 'Gemini service unavailable', lastError?.category || 'UNAVAILABLE');
    }
  };
}

module.exports = { createGeminiProvider, AIProviderError };