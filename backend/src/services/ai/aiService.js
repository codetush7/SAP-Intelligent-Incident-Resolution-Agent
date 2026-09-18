const { getAIProvider, resetProviderCache, getSupportedProviders } = require('./providerFactory');
const aiConfigStore = require('../../utils/aiConfigStore');
const logger = require('../../utils/logger');

// The only surface business logic (cpiAgent, investigationService, etc.)
// is allowed to depend on. Never import a provider or SDK directly elsewhere.
//
// `override` is optional: { provider: 'groq'|'gemini', model, apiKey }.
// Pass it through from a request body (e.g. the AI Agent chat provider
// dropdown) to use a different provider/model for a single call without
// touching the globally saved configuration.

async function chat(messages, systemPrompt, override) {
  const provider = getAIProvider(override);
  return provider.chat(messages, systemPrompt);
}

// Calls the provider and parses the response as JSON. Throws if the
// response isn't valid JSON — callers decide their own fallback behavior,
// this layer never silently invents a result.
async function generateStructuredJSON(systemPrompt, userPrompt, override) {
  const provider = getAIProvider(override);
  const text = await provider.chat([{ role: 'user', content: userPrompt }], systemPrompt);

  const clean = text.trim().replace(/```json|```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AI provider (${provider.name}) returned no parseable JSON`);
  }
  return JSON.parse(jsonMatch[0]);
}

function getProviderInfo(override) {
  const provider = getAIProvider(override);
  return { provider: provider.name, model: provider.model };
}

// Used by Settings > AI Configuration and the AgentPage provider dropdown
// to know which providers currently have a usable key (env or saved config).
function getProviderStatus() {
  const saved = aiConfigStore.get();
  return getSupportedProviders().map((name) => {
    const envKey = name === 'groq'
      ? (process.env.GROQ_API_KEY || process.env.AI_API_KEY)
      : (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const savedKey = saved?.provider === name ? saved.apiKey : '';
    return { provider: name, configured: !!(envKey || savedKey) };
  });
}

function saveProviderConfig({ provider, model, apiKey }) {
  aiConfigStore.set({ provider, model, apiKey });
  resetProviderCache();
  logger.info(`[AI Provider] Runtime config updated → provider: ${provider}, model: ${model}`);
}

module.exports = {
  chat,
  generateStructuredJSON,
  getProviderInfo,
  getProviderStatus,
  saveProviderConfig
};
