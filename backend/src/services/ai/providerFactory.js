const { createGroqProvider } = require('./providers/groqProvider');
const logger = require('../../utils/logger');

let cachedProvider = null;

function getAIProvider() {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.AI_PROVIDER || 'groq').toLowerCase();

  switch (providerName) {
    case 'groq':
      cachedProvider = createGroqProvider();
      break;
    // Future: case 'openai': cachedProvider = createOpenAIProvider(); break;
    // Future: case 'gemini': cachedProvider = createGeminiProvider(); break;
    default:
      throw new Error(`Unknown AI_PROVIDER "${providerName}". Supported: groq. (openai/gemini adapters not yet implemented.)`);
  }

  logger.info(`[AI Provider] Active provider: ${cachedProvider.name} (model: ${cachedProvider.model})`);
  return cachedProvider;
}

module.exports = { getAIProvider };