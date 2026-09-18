const { createGroqProvider } = require('./providers/groqProvider');
const { createGeminiProvider } = require('./providers/geminiProvider');
const aiConfigStore = require('../../utils/aiConfigStore');
const logger = require('../../utils/logger');

const SUPPORTED = ['groq', 'gemini'];

// Cache per (provider+model+key) combo so switching providers at runtime
// (Settings page / AgentPage dropdown) doesn't require a server restart.
const providerCache = new Map();

function buildProvider(providerName, opts) {
  switch (providerName) {
    case 'groq':
      return createGroqProvider(opts);
    case 'gemini':
      return createGeminiProvider(opts);
    default:
      throw new Error(`Unknown AI provider "${providerName}". Supported: ${SUPPORTED.join(', ')}.`);
  }
}

/**
 * Resolve the active AI provider.
 * Priority for provider/model/apiKey (highest first):
 *   1. Explicit `override` param (per-request, e.g. from the AI Agent chat dropdown)
 *   2. Saved runtime config (Settings > AI Configuration, persisted via aiConfigStore)
 *   3. Environment variables (.env)
 */
function getAIProvider(override = {}) {
  const saved = aiConfigStore.get(); // { provider, model, apiKey } | null

  const providerName = (
    override.provider ||
    saved?.provider ||
    process.env.AI_PROVIDER ||
    'groq'
  ).toLowerCase();

  if (!SUPPORTED.includes(providerName)) {
    throw new Error(`Unknown AI_PROVIDER "${providerName}". Supported: ${SUPPORTED.join(', ')}.`);
  }

  const model = override.model || (saved?.provider === providerName ? saved?.model : undefined);
  const apiKey = override.apiKey || (saved?.provider === providerName ? saved?.apiKey : undefined);

  const cacheKey = `${providerName}:${model || 'default'}:${apiKey ? 'custom-key' : 'env-key'}`;
  if (providerCache.has(cacheKey)) return providerCache.get(cacheKey);

  const provider = buildProvider(providerName, { model, apiKey });
  providerCache.set(cacheKey, provider);

  logger.info(`[AI Provider] Active provider: ${provider.name} (model: ${provider.model})`);
  return provider;
}

// Called after Settings > AI Configuration is saved so the very next
// request picks up the new provider/model/key without a restart.
function resetProviderCache() {
  providerCache.clear();
}

function getSupportedProviders() {
  return SUPPORTED;
}

module.exports = { getAIProvider, resetProviderCache, getSupportedProviders };
