const express = require('express');
const axios = require('axios');
const Joi = require('joi');
const router = express.Router();

const tenantStore = require('../utils/tenantStore');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

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

// GET /api/tenants — list all tenants for the authenticated user
router.get('/', async (req, res) => {
  try {
    const tenants = await tenantStore.getAll(req.user.id);
    res.json({ tenants });
  } catch (err) {
    logger.error(`[Tenants] Failed to fetch tenants: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tenants — create a tenant, then test the connection immediately
router.post('/', async (req, res) => {
  const { error, value } = tenantSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const tenant = await tenantStore.create(req.user.id, value);

    try {
      const result = await testConnection(value);
      await tenantStore.setStatus(tenant.id, req.user.id, 'CONNECTED', null);
      logger.info(`[Tenants] Connected tenant "${value.name}" (${value.environment})`);
      const publicTenant = await tenantStore.getByIdPublic(tenant.id, req.user.id);
      return res.status(201).json({ tenant: publicTenant, test: result });
    } catch (err) {
      const message = err.response?.data?.error_description || err.response?.data?.error || err.message;
      await tenantStore.setStatus(tenant.id, req.user.id, 'FAILED', message);
      logger.warn(`[Tenants] Test failed for tenant "${value.name}": ${message}`);
      const publicTenant = await tenantStore.getByIdPublic(tenant.id, req.user.id);
      return res.status(201).json({
        tenant: publicTenant,
        test: { tokenObtained: false, error: message }
      });
    }
  } catch (err) {
    logger.error(`[Tenants] Create tenant error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tenants/:id/test — re-test an existing tenant's connection
router.post('/:id/test', async (req, res) => {
  const creds = await tenantStore.getDecryptedCredentials(req.params.id, req.user.id);
  if (!creds) return res.status(404).json({ error: 'Tenant not found' });

  try {
    const result = await testConnection(creds);
    await tenantStore.setStatus(creds.id, req.user.id, 'CONNECTED', null);
    const tenant = await tenantStore.getByIdPublic(creds.id, req.user.id);
    return res.json({ tenant, test: result });
  } catch (err) {
    const message = err.response?.data?.error_description || err.response?.data?.error || err.message;
    await tenantStore.setStatus(creds.id, req.user.id, 'FAILED', message);
    const tenant = await tenantStore.getByIdPublic(creds.id, req.user.id);
    return res.status(200).json({
      tenant,
      test: { tokenObtained: false, error: message }
    });
  }
});

// PATCH /api/tenants/:id — update tenant fields
router.patch('/:id', async (req, res) => {
  const { error, value } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const tenant = await tenantStore.update(req.params.id, req.user.id, value);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const publicTenant = await tenantStore.getByIdPublic(tenant.id, req.user.id);
    res.json({ tenant: publicTenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tenants/:id/activate — set this tenant as active
router.post('/:id/activate', async (req, res) => {
  try {
    const ok = await tenantStore.setActive(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Tenant not found' });
    const publicTenant = await tenantStore.getByIdPublic(req.params.id, req.user.id);
    res.json({ tenant: publicTenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tenants/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await tenantStore.remove(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;