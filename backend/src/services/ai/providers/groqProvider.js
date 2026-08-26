const Groq = require('groq-sdk');
const logger = require('../../../utils/logger');

class AIProviderError extends Error {
  constructor(message, category) {
    super(message);
    this.name = 'AIProviderError';
    this.category = category; // AUTH | RATE_LIMIT | TIMEOUT | UNAVAILABLE | INVALID_MODEL | INVALID_RESPONSE | UNKNOWN
  }
}

function categorizeError(err) {
  const status = err?.status || err?.response?.status;
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 404) return 'INVALID_MODEL';
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') return 'TIMEOUT';
  if (status >= 500) return 'UNAVAILABLE';
  return 'UNKNOWN';
}

function createGroqProvider() {
  const apiKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;
  const model = process.env.GROQ_MODEL || process.env.AI_MODEL || 'openai/gpt-oss-20b';

  if (!apiKey) {
    logger.warn('[AI Provider] GROQ_API_KEY not set — Groq provider will fail on first call.');
  }

  const client = new Groq({ apiKey });

  return {
    name: 'groq',
    model,

    async chat(messages, systemPrompt) {
      const start = Date.now();
      try {
        const response = await client.chat.completions.create({
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          model,
          temperature: 0.2
        });
        const text = response?.choices?.[0]?.message?.content || '';
        logger.debug(`[AI Provider] groq chat ok — ${Date.now() - start}ms, tokens: ${response?.usage?.total_tokens ?? 'n/a'}`);
        return text;
      } catch (err) {
        const category = categorizeError(err);
        logger.error(`[AI Provider] groq chat failed (${category}): ${err.message}`);
        throw new AIProviderError(err.message, category);
      }
    }
  };
}

module.exports = { createGroqProvider, AIProviderError };