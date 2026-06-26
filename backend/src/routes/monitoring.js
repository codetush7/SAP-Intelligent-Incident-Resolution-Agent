const express = require('express');
const router = express.Router();
const dataStore = require('../utils/dataStore');
const { getMonitoringStatus, runMonitoringCycle, initializeMonitoring, stopMonitoring, isSAPConfigured } = require('../services/monitoringService');

router.get('/status', async (req, res) => {
  const status = getMonitoringStatus();

  // Live SAP health check if configured
  let sapHealth = { configured: isSAPConfigured() };
  if (isSAPConfigured()) {
    try {
      const { healthCheck } = require('../services/sapCpiService');
      sapHealth = { ...sapHealth, ...(await healthCheck()) };
    } catch (e) {
      sapHealth.error = e.message;
    }
  }

  // ServiceNow health check
  let snowHealth = { configured: !!(process.env.SERVICENOW_INSTANCE && process.env.SERVICENOW_INSTANCE !== 'https://your-instance.service-now.com') };
  if (snowHealth.configured) {
    try {
      const { healthCheck: snowCheck } = require('../services/serviceNowService');
      snowHealth = { ...snowHealth, ...(await snowCheck()) };
    } catch (e) {
      snowHealth.error = e.message;
    }
  }

  res.json({
    ...status,
    alerts: dataStore.getAlerts().filter(a => !a.acknowledged).length,
    recentLogs: dataStore.getMonitoringLogs().slice(0, 10),
    sapHealth,
    snowHealth
  });
});

router.get('/logs', (req, res) => {
  const { limit = 50 } = req.query;
  res.json(dataStore.getMonitoringLogs().slice(0, parseInt(limit)));
});

router.get('/alerts', (req, res) => {
  res.json(dataStore.getAlerts());
});

router.post('/alerts/:id/acknowledge', (req, res) => {
  const alert = dataStore.acknowledgeAlert(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

router.post('/trigger-scan', async (req, res) => {
  try {
    await runMonitoringCycle();
    res.json({ message: 'Scan triggered', mode: getMonitoringStatus().mode, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', (req, res) => {
  initializeMonitoring();
  res.json({ message: 'Monitoring started', status: getMonitoringStatus() });
});

router.post('/stop', (req, res) => {
  stopMonitoring();
  res.json({ message: 'Monitoring stopped', status: getMonitoringStatus() });
});

// Real iFlows from SAP CPI (with fallback)
router.get('/iflows', async (req, res) => {
  if (!isSAPConfigured()) {
    return res.json([
      { id: 'SF_Order_Sync_v2', name: 'Salesforce Order Sync', interface: 'Salesforce', status: 'FAILED', lastRun: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: 'ECC_Order_Processing', name: 'ECC Order Processing', interface: 'SAP ECC', status: 'WARNING', lastRun: new Date(Date.now() - 3600000).toISOString() },
      { id: 'Banking_Payment_Gateway', name: 'Banking Payment Gateway', interface: 'Banking API', status: 'RUNNING', lastRun: new Date(Date.now() - 900000).toISOString() },
      { id: 'Finance_File_Transfer_v1', name: 'Finance File Transfer', interface: 'SFTP', status: 'RUNNING', lastRun: new Date(Date.now() - 1800000).toISOString() },
      { id: 'Customer_Data_Sync_v3', name: 'Customer Data Sync', interface: 'SAP ECC', status: 'FAILED', lastRun: new Date(Date.now() - 3600000).toISOString() }
    ]);
  }

  try {
    const { getIntegrationFlows } = require('../services/sapCpiService');
    const flows = await getIntegrationFlows();
    res.json(flows.map(f => ({
      id: f.Id,
      name: f.Name,
      interface: f.Name,
      status: f.Status === 'STARTED' ? 'RUNNING' : f.Status === 'ERROR' ? 'FAILED' : f.Status,
      version: f.Version,
      deployedBy: f.DeployedBy,
      lastRun: f.DeployedOn
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real certificates from SAP CPI
router.get('/certificates', async (req, res) => {
  if (!isSAPConfigured()) {
    return res.json([]);
  }
  try {
    const { getCertificates } = require('../services/sapCpiService');
    const certs = await getCertificates();
    res.json(certs.map(c => ({
      alias: c.Hexalias,
      type: c.KeyType,
      validFrom: c.ValidNotBefore,
      validUntil: c.ValidNotAfter
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
// already exported above
