const axios = require('axios');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');

function formatAxiosError(err) {
  if (err.response) {
    return `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
  }
  return err.message;
}

function getActiveCreds() {
  const ctx = requestContext.getContext();
  const creds = ctx && ctx.creds;
  if (!creds) {
    throw new Error('No SAP CPI tenant is connected for this user. Add and activate a tenant in Tenant Connect.');
  }
  return creds;
}
// ─── Token Cache (per tenant) ─────────────────────────────────────────────────
const tokenCache = new Map(); // tenantId -> { token, expiry }

async function getSAPToken() {
  const creds = getActiveCreds();
  const cached = tokenCache.get(creds.id);
  if (cached && Date.now() < cached.expiry) {
    return cached.token;
  }

  logger.info(`[SAP CPI] Fetching new OAuth token for tenant "${creds.name}"...`);

  try {
    const response = await axios.post(
      creds.tokenUrl,
      'grant_type=client_credentials',
      {
        auth: {
          username: creds.clientId,
          password: creds.clientSecret
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      }
    );

    const token = response.data.access_token;
    const expiry = Date.now() + (response.data.expires_in - 60) * 1000;
    tokenCache.set(creds.id, { token, expiry });
    logger.info('[SAP CPI] OAuth token obtained successfully');
    return token;
  } catch (err) {
    const errorDetail = formatAxiosError(err);
    logger.error(`[SAP CPI] OAuth token request failed: ${errorDetail}`);
    throw new Error(`SAP CPI token request failed: ${errorDetail}`);
  }
}

function getBaseUrl() {
  return getActiveCreds().baseUrl;
}

function sapHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

// ─── Message Processing Logs ──────────────────────────────────────────────────
async function getFailedMessages(top = 20) {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/MessageProcessingLogs` +
    `?$filter=Status eq 'FAILED'&$top=${top}&$orderby=LogEnd desc&$format=json`;

  const response = await axios.get(url, {
    headers: sapHeaders(token),
    timeout: 30000
  });
  const results = response.data?.d?.results || [];
  // if (results.length > 0) {
  //   logger.info('[SAP DEBUG] First message fields: ' + JSON.stringify(results[0], null, 2));
  // }
  return results;
}

// ─── Message Processing Log Error Info ────────────────────────────────────────
async function getMessageErrorInfo(messageGuid) {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/MessageProcessingLogs('${messageGuid}')/ErrorInformation/$value`;

  try {
    const response = await axios.get(url, {
      headers: sapHeaders(token),
      timeout: 15000
    });
    return response.data || '';
  } catch (err) {
    return '';
  }
}

// ─── Message Processing Log Runs (adapter details) ───────────────────────────
async function getMessageRuns(messageGuid) {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/MessageProcessingLogs('${messageGuid}')/MessageProcessingLogRuns?$format=json`;

  try {
    const response = await axios.get(url, {
      headers: sapHeaders(token),
      timeout: 15000
    });
    return response.data?.d?.results || [];
  } catch (err) {
    return [];
  }
}

// ─── Integration Flows (deployed iFlows) ─────────────────────────────────────
async function getIntegrationFlows() {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/IntegrationRuntimeArtifacts?$format=json`;

  const response = await axios.get(url, {
    headers: sapHeaders(token),
    timeout: 30000
  });

  return response.data?.d?.results || [];
}

// ─── Data Store Entries ───────────────────────────────────────────────────────
async function getDataStoreEntries() {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/DataStores?$format=json`;

  try {
    const response = await axios.get(url, {
      headers: sapHeaders(token),
      timeout: 15000
    });
    return response.data?.d?.results || [];
  } catch (err) {
    logger.warn('[SAP CPI] DataStore fetch failed: ' + err.message);
    return [];
  }
}
async function resolveIntegrationArtifactId(key) {
  if (!key) return null;
  const flows = await getIntegrationFlows();
  const match = flows.find(f =>
    f.ArtifactId === key ||
    f.Id === key ||
    f.Name === key ||
    f.IntegrationFlowName === key ||
    f.IntegrationFlowId === key
  );
  return match?.ArtifactId || match?.Id || null;
}

async function fixIntegrationFlow(artifactKey) {
  const artifactId = await resolveIntegrationArtifactId(artifactKey);
  if (!artifactId) {
    throw new Error('Unable to resolve CPI integration flow artifact id for fix action.');
  }

  if (process.env.SAP_CPI_ENABLE_FIX !== 'true') {
    throw new Error('SAP CPI fix actions are disabled. Set SAP_CPI_ENABLE_FIX=true to enable real fix actions.');
  }

  const token = await getSAPToken();
  const candidateActions = ['Restart', 'Start'];
  let lastError = null;

  for (const action of candidateActions) {
    const url = `${getBaseUrl()}/api/v1/IntegrationRuntimeArtifacts('${artifactId}')/${action}`;
    try {
      const response = await axios.post(url, null, {
        headers: sapHeaders(token),
        timeout: 30000
      });
      logger.info(`[SAP CPI] Fix action ${action} executed for artifact ${artifactId}`);
      return { action, result: response.data };
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      if ([404, 405, 501].includes(status)) {
        continue;
      }
      throw err;
    }
  }

  throw new Error(`SAP CPI fix action failed for artifact ${artifactId}: ${formatAxiosError(lastError)}`);
}
// ─── JMS Resources ────────────────────────────────────────────────────────────
async function getJMSResources() {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/JMSBrokers?$format=json`;

  try {
    const response = await axios.get(url, {
      headers: sapHeaders(token),
      timeout: 15000
    });
    return response.data?.d?.results || [];
  } catch (err) {
    logger.warn('[SAP CPI] JMS fetch failed: ' + err.message);
    return [];
  }
}

// ─── Keystore / Certificates ─────────────────────────────────────────────────
async function getCertificates() {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/KeystoreEntries?$format=json`;

  const response = await axios.get(url, {
    headers: sapHeaders(token),
    timeout: 15000
  });

  return response.data?.d?.results || [];
}

// ─── Security Material (OAuth, credentials) ───────────────────────────────────
async function getSecurityMaterial() {
  const token = await getSAPToken();
  const url = `${getBaseUrl()}/api/v1/SecureParameters?$format=json`;

  try {
    const response = await axios.get(url, {
      headers: sapHeaders(token),
      timeout: 15000
    });
    return response.data?.d?.results || [];
  } catch (err) {
    logger.warn('[SAP CPI] Security material fetch failed: ' + err.message);
    return [];
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────
async function healthCheck() {
  try {
    const token = await getSAPToken();
    await axios.get(
      `${getBaseUrl()}/api/v1/IntegrationRuntimeArtifacts?$top=1&$format=json`,
      { headers: sapHeaders(token), timeout: 10000 }
    );
    return { connected: true, timestamp: new Date().toISOString() };
  } catch (err) {
    return { connected: false, error: err.message, timestamp: new Date().toISOString() };
  }
}

// ─── Map SAP error details to our error codes ─────────────────────────────────
function safeString(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function mapSAPErrorToCode(msg) {
  const errorInfo = safeString(msg.ErrorInformation || msg.MessageText || msg.ErrorLog || '').toLowerCase();
  const adapterName = safeString(msg.AdapterName || '').toLowerCase();
  const status = safeString(msg.Status || '').toLowerCase();

  if (errorInfo.includes('401') || errorInfo.includes('unauthorized')) return 'HTTP_401';
  if (errorInfo.includes('403') || errorInfo.includes('forbidden')) return 'HTTP_403';
  if (errorInfo.includes('503') || errorInfo.includes('unavailable')) return 'HTTP_503';
  if (errorInfo.includes('500')) return 'HTTP_500';
  if (adapterName.includes('sftp') || errorInfo.includes('sftp') || errorInfo.includes('ssh')) return 'SFTP_AUTH_FAILURE';
  if (errorInfo.includes('certificate') || errorInfo.includes('pkix') || errorInfo.includes('ssl')) return 'PKIX_CERT_ERROR';
  if (errorInfo.includes('oauth') || errorInfo.includes('token')) return 'OAUTH_TOKEN_EXPIRED';
  if (errorInfo.includes('mapping') || errorInfo.includes('null') || errorInfo.includes('xslt')) return 'MAPPING_EXCEPTION';
  if (adapterName.includes('jms') || errorInfo.includes('queue')) return 'QUEUE_THRESHOLD_EXCEEDED';
  if (errorInfo.includes('data store') || errorInfo.includes('datastore')) return 'DATA_STORE_FAILURE';
  if (adapterName.includes('https') || adapterName.includes('http') || errorInfo.includes('http') || errorInfo.includes('responseexception')) return 'HTTP_500';
  return 'GENERAL_ERROR';
}

module.exports = {
  getSAPToken,
  getFailedMessages,
  getMessageErrorInfo,
  getMessageRuns,
  getIntegrationFlows,
  getDataStoreEntries,
  getJMSResources,
  getCertificates,
  getSecurityMaterial,
  fixIntegrationFlow,
  healthCheck,
  mapSAPErrorToCode
};
