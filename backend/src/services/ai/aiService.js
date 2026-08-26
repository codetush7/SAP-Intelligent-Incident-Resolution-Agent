const { getAIProvider } = require('./providerFactory');
const logger = require('../../utils/logger');

// The only surface business logic (cpiAgent, investigationService, etc.)
// is allowed to depend on. Never import a provider or SDK directly elsewhere.

async function chat(messages, systemPrompt) {
  const provider = getAIProvider();
  return provider.chat(messages, systemPrompt);
}

// Calls the provider and parses the response as JSON. Throws if the
// response isn't valid JSON — callers decide their own fallback behavior,
// this layer never silently invents a result.
async function generateStructuredJSON(systemPrompt, userPrompt) {
  const provider = getAIProvider();
  const text = await provider.chat([{ role: 'user', content: userPrompt }], systemPrompt);

  const clean = text.trim().replace(/```json|```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AI provider (${provider.name}) returned no parseable JSON`);
  }
  return JSON.parse(jsonMatch[0]);
}

function getProviderInfo() {
  const provider = getAIProvider();
  return { provider: provider.name, model: provider.model };
}

module.exports = { chat, generateStructuredJSON, getProviderInfo };