const express = require('express');
const router = express.Router();

const dataStore = require('../utils/dataStore');
const {
  getMonitoringStatus,
  runMonitoringCycle,
  initializeMonitoring,
  stopMonitoring,
  isSAPConfigured
} = require('../services/monitoringService');

const { requireAuth } = require('../middleware/authMiddleware');
const requestContext = require('../utils/requestContext');
const logger = require('../utils/logger');

router.use(requireAuth);

/**
 * Monitoring status
 */
router.get('/status', async (req, res) => {
  try {
    const isSapConfig = await isSAPConfigured(req.user.id);
    const status = getMonitoringStatus(req.user.id, isSapConfig);

    let sapHealth = { configured: isSapConfig };
    if (isSapConfig) {
      try {
        sapHealth = await requestContext.runForUser(
          req.user.id,
          async () => {
            const { healthCheck } = require('../services/sapCpiService');
            return {
              ...sapHealth,
              ...(await healthCheck())
            };
          }
        );
      } catch (e) {
        sapHealth.error = e.message;
      }
    }

    let snowHealth = {
      configured: !!(
        process.env.SERVICENOW_INSTANCE &&
        process.env.SERVICENOW_INSTANCE !== 'https://your-instance.service-now.com'
      )
    };

    if (snowHealth.configured) {
      try {
        const { healthCheck: snowCheck } = require('../services/serviceNowService');
        snowHealth = {
          ...snowHealth,
          ...(await snowCheck())
        };
      } catch (e) {
        snowHealth.error = e.message;
      }
    }

    const alerts = await dataStore.getAlerts(req.user.id);
    const logs = await dataStore.getMonitoringLogs(req.user.id);

    res.json({
      ...status,
      alerts: alerts.filter(a => !a.acknowledged).length,
      recentLogs: logs.slice(0, 10),
      sapHealth,
      snowHealth
    });
  } catch (err) {
    logger.error(`[Monitoring] Status error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Monitoring logs
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await dataStore.getMonitoringLogs(req.user.id);
    res.json(logs.slice(0, parseInt(limit, 10)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await dataStore.getAlerts(req.user.id);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Acknowledge alert
 */
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const alert = await dataStore.acknowledgeAlert(req.user.id, req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Trigger monitoring scan for the currently authenticated user
 */
router.post('/trigger-scan', async (req, res) => {
  try {
    await runMonitoringCycle(req.user.id);
    const isSapConfig = await isSAPConfigured(req.user.id);

    res.json({
      message: 'Scan triggered',
      mode: getMonitoringStatus(req.user.id, isSapConfig).mode,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start monitoring scheduler
 */
router.post('/start', (req, res) => {
  initializeMonitoring();
  res.json({
    message: 'Monitoring started',
    status: getMonitoringStatus()
  });
});

/**
 * Stop monitoring scheduler
 */
router.post('/stop', (req, res) => {
  stopMonitoring();
  res.json({
    message: 'Monitoring stopped',
    status: getMonitoringStatus()
  });
});

/**
 * Real iFlows from SAP CPI with fallback mock data
 */
router.get('/iflows', async (req, res) => {
  const isSapConfig = await isSAPConfigured(req.user.id);
  if (!isSapConfig) {
    return res.json([
      {
        id: 'SF_Order_Sync_v2',
        name: 'Salesforce Order Sync',
        interface: 'Salesforce',
        status: 'FAILED',
        lastRun: new Date(Date.now() - 2 * 3600000).toISOString()
      },
      {
        id: 'ECC_Order_Processing',
        name: 'ECC Order Processing',
        interface: 'SAP ECC',
        status: 'WARNING',
        lastRun: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'Banking_Payment_Gateway',
        name: 'Banking Payment Gateway',
        interface: 'Banking API',
        status: 'RUNNING',
        lastRun: new Date(Date.now() - 900000).toISOString()
      },
      {
        id: 'Finance_File_Transfer_v1',
        name: 'Finance File Transfer',
        interface: 'SFTP',
        status: 'RUNNING',
        lastRun: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: 'Customer_Data_Sync_v3',
        name: 'Customer Data Sync',
        interface: 'SAP ECC',
        status: 'FAILED',
        lastRun: new Date(Date.now() - 3600000).toISOString()
      }
    ]);
  }

  try {
    const flows = await requestContext.runForUser(
      req.user.id,
      async () => {
        const { getIntegrationFlows } = require('../services/sapCpiService');
        return getIntegrationFlows();
      }
    );

    res.json(
      flows.map(f => ({
        id: f.Id,
        name: f.Name,
        interface: f.Name,
        status: f.Status === 'STARTED' ? 'RUNNING' : f.Status === 'ERROR' ? 'FAILED' : f.Status,
        version: f.Version,
        deployedBy: f.DeployedBy,
        lastRun: f.DeployedOn
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Real certificates from SAP CPI
 */
router.get('/certificates', async (req, res) => {
  const isSapConfig = await isSAPConfigured(req.user.id);
  if (!isSapConfig) {
    return res.json([]);
  }

  try {
    const certs = await requestContext.runForUser(
      req.user.id,
      async () => {
        const { getCertificates } = require('../services/sapCpiService');
        return getCertificates();
      }
    );

    res.json(
      certs.map(c => ({
        alias: c.Hexalias,
        type: c.KeyType,
        validFrom: c.ValidNotBefore,
        validUntil: c.ValidNotAfter
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;