const dataStore = require('../utils/dataStore');
const {
  getMonitoringStatus,
  runMonitoringCycle,
  initializeMonitoring,
  stopMonitoring,
  isSAPConfigured
} = require('../services/monitoringService');
const requestContext = require('../utils/requestContext');

async function getStatus(req, res) {
  const status = getMonitoringStatus(req.user.id);

  // Live SAP health check if configured
  let sapHealth = {
    configured: isSAPConfigured(req.user.id)
  };

  if (isSAPConfigured(req.user.id)) {
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

  // ServiceNow health check
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

  res.json({
    ...status,
    alerts: dataStore.getAlerts(req.user.id).filter(a => !a.acknowledged).length,
    recentLogs: dataStore.getMonitoringLogs(req.user.id).slice(0, 10),
    sapHealth,
    snowHealth
  });
}

function getLogs(req, res) {
  const { limit = 50 } = req.query;
  res.json(dataStore.getMonitoringLogs(req.user.id).slice(0, parseInt(limit)));
}

function getAlerts(req, res) {
  res.json(dataStore.getAlerts(req.user.id));
}

function acknowledgeAlert(req, res) {
  const alert = dataStore.acknowledgeAlert(req.user.id, req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
}

async function triggerScan(req, res) {
  try {
    await runMonitoringCycle(req.user.id);
    res.json({
      message: 'Scan triggered',
      mode: getMonitoringStatus(req.user.id).mode,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function startMonitoring(req, res) {
  initializeMonitoring();
  res.json({
    message: 'Monitoring started',
    status: getMonitoringStatus()
  });
}

function stopMonitoringHandler(req, res) {
  stopMonitoring();
  res.json({
    message: 'Monitoring stopped',
    status: getMonitoringStatus()
  });
}

async function getIflows(req, res) {
  if (!isSAPConfigured(req.user.id)) {
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
        status:
          f.Status === 'STARTED' ? 'RUNNING' :
          f.Status === 'ERROR'   ? 'FAILED'  :
          f.Status,
        version: f.Version,
        deployedBy: f.DeployedBy,
        lastRun: f.DeployedOn
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getCertificates(req, res) {
  if (!isSAPConfigured(req.user.id)) {
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
}

module.exports = {
  getStatus,
  getLogs,
  getAlerts,
  acknowledgeAlert,
  triggerScan,
  startMonitoring,
  stopMonitoringHandler,
  getIflows,
  getCertificates
};
