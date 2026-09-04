const axios = require('axios');
const Joi = require('joi');
const tenantStore = require('../utils/tenantStore');
const logger = require('../utils/logger');

const tenantSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  environment: Joi.string().valid('DEV', 'TEST', 'QA', 'PROD').required(),
  baseUrl: Joi.string().uri().required(),
  tokenUrl: Joi.string().uri().required(),
  clientId: Joi.string().trim().min(1).required(),
  clientSecret: Joi.string().trim().min(1).required()
});

const updateSchema = tenantSchema.fork(
  ['name', 'environment', 'baseUrl', 'tokenUrl', 'clientId', 'clientSecret'],
  field => field.optional()
);

// Attempts an OAuth client-credentials token fetch against the tenant's Token URL.
// This is the real connectivity check — if this succeeds, the tenant is reachable
// and the credentials are valid.
async function testConnection({ tokenUrl, clientId, clientSecret, baseUrl }) {
  const tokenRes = await axios.post(
    tokenUrl,
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: clientSecret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    }
  );

  const accessToken = tokenRes.data?.access_token;
  if (!accessToken) {
    throw new Error('Token endpoint responded but did not return an access_token.');
  }

  // Optional secondary check: confirm the base host is reachable with the token.
  // Non-fatal if it fails — some tenants restrict this endpoint by role.
  let hostReachable = null;
  try {
    await axios.get(`${baseUrl}/api/v1/IntegrationRuntimeArtifacts?$top=1&$format=json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000
    });
    hostReachable = true;
  } catch (err) {
    hostReachable = false;
  }

  return { tokenObtained: true, hostReachable };
}

function listTenants(req, res) {
  res.json({ tenants: tenantStore.getAll(req.user.id) });
}

async function createTenant(req, res) {
  const { error, value } = tenantSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const tenant = tenantStore.create(req.user.id, value);

  try {
    const result = await testConnection(value);
    tenantStore.setStatus(tenant.id, req.user.id, 'CONNECTED', null);
    logger.info(`[Tenants] Connected tenant "${value.name}" (${value.environment})`);
    return res.status(201).json({ tenant: tenantStore.getByIdPublic(tenant.id, req.user.id), test: result });
  } catch (err) {
    const message = err.response?.data?.error_description || err.response?.data?.error || err.message;
    tenantStore.setStatus(tenant.id, 'FAILED', message);
    logger.warn(`[Tenants] Test failed for tenant "${value.name}": ${message}`);
    // Tenant is still saved so the user can edit and retry, but we report the failure.
    return res.status(201).json({
      tenant: tenantStore.getByIdPublic(tenant.id),
      test: { tokenObtained: false, error: message }
    });
  }
}

async function retestTenant(req, res) {
  const creds = tenantStore.getDecryptedCredentials(req.params.id, req.user.id);
  if (!creds) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await testConnection(creds);
    tenantStore.setStatus(creds.id, req.user.id, 'CONNECTED', null);
    return res.json({ tenant: tenantStore.getByIdPublic(creds.id, req.user.id), test: result });
  } catch (err) {
    const message = err.response?.data?.error_description || err.response?.data?.error || err.message;
    tenantStore.setStatus(creds.id, req.user.id, 'FAILED', message);
    return res.status(200).json({
      tenant: tenantStore.getByIdPublic(creds.id, req.user.id),
      test: { tokenObtained: false, error: message }
    });
  }
}

function updateTenant(req, res) {
  const { error, value } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const tenant = tenantStore.update(req.params.id, req.user.id, value);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  res.json({ tenant: tenantStore.getByIdPublic(tenant.id, req.user.id) });
}

function activateTenant(req, res) {
  const ok = tenantStore.setActive(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Tenant not found' });
  res.json({ tenant: tenantStore.getByIdPublic(req.params.id, req.user.id) });
}

function removeTenant(req, res) {
  const ok = tenantStore.remove(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Tenant not found' });
  res.json({ success: true });
}

module.exports = { listTenants, createTenant, retestTenant, updateTenant, activateTenant, removeTenant };
