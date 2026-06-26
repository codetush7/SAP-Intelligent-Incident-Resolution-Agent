const cron = require('node-cron');
const logger = require('../utils/logger');
const dataStore = require('../utils/dataStore');
const { broadcastEvent } = require('./websocketService');

let monitoringActive = false;
let monitoringJob = null;

// Check if SAP CPI is configured
function isSAPConfigured() {
  return !!(
    process.env.SAP_CPI_BASE_URL &&
    process.env.SAP_CPI_CLIENT_ID &&
    process.env.SAP_CPI_CLIENT_SECRET &&
    process.env.SAP_CPI_TOKEN_URL &&
    process.env.SAP_CPI_BASE_URL !== 'https://your-tenant.it-cpi.cfapps.sap.hana.ondemand.com'
  );
}

// ─── REAL: Check SAP CPI Failed Message Logs ──────────────────────────────────
async function checkMessageProcessingLogs() {
  if (!isSAPConfigured()) return simulateFallback('message_logs');

  try {
    const { getFailedMessages, getMessageErrorInfo, getMessageRuns, mapSAPErrorToCode } = require('./sapCpiService');
    const failed = await getFailedMessages(10);

    if (failed.length === 0) return null;

    // Pick the most recent failure not already ticketed
    const existingTickets = dataStore.getTickets();
    const newFailure = failed.find(msg =>
      !existingTickets.some(t => t.sapMessageGuid === msg.MessageGuid)
    );

    if (!newFailure) return null;

    // Enrich with full error info
    const errorInfo = await getMessageErrorInfo(newFailure.MessageGuid);
    const runs = await getMessageRuns(newFailure.MessageGuid);
    const lastRun = runs[runs.length - 1] || {};

    const errorCode = mapSAPErrorToCode({
      ErrorInformation: errorInfo,
      AdapterName: lastRun.AdapterName || newFailure.Sender || ''
    });

    return {
      errorCode,
      interface: newFailure.Receiver || newFailure.Sender || 'SAP CPI',
      iflow: newFailure.IntegrationFlowName || 'Unknown iFlow',
      errorMessage: errorInfo || newFailure.Status || 'Message processing failed',
      sapMessageGuid: newFailure.MessageGuid,
      payload: {
        messageGuid: newFailure.MessageGuid,
        correlationId: newFailure.CorrelationId,
        sender: newFailure.Sender,
        receiver: newFailure.Receiver,
        logStart: newFailure.LogStart,
        logEnd: newFailure.LogEnd,
        adapterName: lastRun.AdapterName
      },
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error(`[Monitor] SAP CPI message log check failed: ${err.message}`);
    return {
      errorCode: 'HTTP_403',
      interface: 'SAP CPI API',
      iflow: 'MessageProcessingLogs Access',
      errorMessage: `Unable to read SAP CPI failed message logs: ${err.message}`,
      payload: {
        apiEndpoint: 'MessageProcessingLogs',
        reason: err.message
      },
      timestamp: new Date().toISOString()
    };
  }
}

// ─── REAL: Check JMS Queue Buildup ───────────────────────────────────────────
async function checkJMSQueues() {
  if (!isSAPConfigured()) return null;

  try {
    const { getJMSResources } = require('./sapCpiService');
    const brokers = await getJMSResources();

    for (const broker of brokers) {
      const queueSize = parseInt(broker.QueueNumber || 0);
      const threshold = parseInt(process.env.QUEUE_SIZE_THRESHOLD || 1000);

      if (queueSize > threshold) {
        return {
          errorCode: 'QUEUE_THRESHOLD_EXCEEDED',
          interface: 'SAP CPI JMS',
          iflow: 'JMS Broker Monitor',
          queueName: broker.Name || 'JMS Broker',
          queueSize,
          errorMessage: `JMS queue has ${queueSize} messages (threshold: ${threshold})`
        };
      }
    }
    return null;
  } catch (err) {
    logger.warn(`[Monitor] JMS check failed: ${err.message}`);
    return null;
  }
}

// ─── REAL: Check Certificate Expiry ──────────────────────────────────────────
async function checkCertificates() {
  if (!isSAPConfigured()) return null;

  try {
    const { getCertificates } = require('./sapCpiService');
    const certs = await getCertificates();
    const warningDays = parseInt(process.env.CERT_EXPIRY_WARNING_DAYS || 30);
    const now = Date.now();

    for (const cert of certs) {
      if (!cert.ValidNotAfter) continue;

      // SAP returns date as /Date(timestamp)/
      let expiry;
      const match = cert.ValidNotAfter.match(/\/Date\((\d+)\)\//);
      if (match) {
        expiry = parseInt(match[1]);
      } else {
        expiry = new Date(cert.ValidNotAfter).getTime();
      }

      const daysLeft = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysLeft <= warningDays && daysLeft >= 0) {
        // Check if already ticketed
        const existing = dataStore.getTickets().find(t =>
          t.certName === cert.Hexalias && t.status !== 'RESOLVED'
        );
        if (existing) continue;

        return {
          errorCode: 'CERT_EXPIRY_WARNING',
          interface: 'SAP CPI Keystore',
          iflow: 'Certificate Monitor',
          certName: cert.Hexalias,
          daysUntilExpiry: daysLeft,
          errorMessage: `Certificate "${cert.Hexalias}" expiring in ${daysLeft} days (${new Date(expiry).toDateString()})`,
          payload: {
            alias: cert.Hexalias,
            type: cert.KeyType,
            validFrom: cert.ValidNotBefore,
            validUntil: cert.ValidNotAfter,
            daysLeft
          }
        };
      }
    }
    return null;
  } catch (err) {
    logger.warn(`[Monitor] Certificate check failed: ${err.message}`);
    return null;
  }
}

// ─── REAL: Check iFlow Runtime Status ────────────────────────────────────────
async function checkIFlowStatus() {
  if (!isSAPConfigured()) return null;

  try {
    const { getIntegrationFlows } = require('./sapCpiService');
    const iflows = await getIntegrationFlows();

    const errored = iflows.find(f =>
      f.Status === 'ERROR' || f.Status === 'FAILED'
    );

    if (!errored) return null;

    return {
      errorCode: 'HTTP_500',
      interface: errored.Name || 'Unknown',
      iflow: errored.Name,
      errorMessage: `iFlow "${errored.Name}" is in ${errored.Status} state`,
      payload: {
        id: errored.Id,
        version: errored.Version,
        status: errored.Status,
        deployedBy: errored.DeployedBy,
        deployedOn: errored.DeployedOn
      }
    };
  } catch (err) {
    logger.warn(`[Monitor] iFlow status check failed: ${err.message}`);
    return null;
  }
}

// ─── FALLBACK: Simulate when SAP not configured ───────────────────────────────
function simulateFallback(type) {
  const rand = Math.random();
  if (rand > 0.12) return null; // 12% chance of simulated event

  const scenarios = [
    { errorCode: 'HTTP_401', interface: 'Salesforce', iflow: 'SF_Order_Sync_v2', errorMessage: 'HTTP 401 Unauthorized - OAuth token expired' },
    { errorCode: 'MAPPING_EXCEPTION', interface: 'SAP ECC', iflow: 'ECC_Customer_Sync', errorMessage: 'NullPointerException: Field CustomerID is null', failedField: 'CustomerID' },
    { errorCode: 'HTTP_503', interface: 'Banking API', iflow: 'Banking_Payment_Gateway', errorMessage: 'Service Unavailable - upstream at capacity' }
  ];

  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

// ─── Main Monitoring Cycle ────────────────────────────────────────────────────
async function runMonitoringCycle() {
  if (!monitoringActive) return;

  const sapConfigured = isSAPConfigured();
  logger.info(`[Monitor] Running cycle (SAP: ${sapConfigured ? 'REAL' : 'SIMULATED'})`);

  dataStore.addMonitoringLog({
    type: 'CHECK',
    message: `Running monitoring cycle (mode: ${sapConfigured ? 'SAP CPI Live' : 'Simulation'})`,
    status: 'RUNNING'
  });

  broadcastEvent('monitoring_status', {
    status: 'CHECKING',
    mode: sapConfigured ? 'LIVE' : 'SIMULATION',
    message: `Scanning ${sapConfigured ? 'SAP CPI' : 'simulated'} integrations...`,
    timestamp: new Date().toISOString()
  });

  try {
    // Run all checks in parallel
    const [msgIssue, jmsIssue, certIssue, iflowIssue] = await Promise.all([
      checkMessageProcessingLogs(),
      checkJMSQueues(),
      checkCertificates(),
      checkIFlowStatus()
    ]);

    const issues = [msgIssue, jmsIssue, certIssue, iflowIssue].filter(Boolean);

    if (issues.length > 0) {
      logger.info(`[Monitor] Found ${issues.length} real issue(s)`);

      for (const issue of issues) {
        const alert = dataStore.addAlert({
          type: issue.errorCode,
          severity: ['HTTP_503', 'QUEUE_THRESHOLD_EXCEEDED'].includes(issue.errorCode) ? 'CRITICAL' : 'HIGH',
          message: issue.errorMessage
        });

        dataStore.addMonitoringLog({
          type: 'ALERT',
          message: `Issue detected: ${issue.errorCode} in ${issue.interface}`,
          status: 'ALERT_CREATED'
        });

        broadcastEvent('new_alert', {
          alert,
          issue,
          message: `🚨 ${issue.errorCode}: ${issue.errorMessage}`,
          timestamp: new Date().toISOString()
        });

        // Auto-process with AI agent + ServiceNow
        try {
          const { processIncident } = require('../agents/cpiAgent');
          await processIncident({ ...issue, timestamp: new Date().toISOString() });
        } catch (agentErr) {
          logger.error(`[Monitor] Agent processing failed: ${agentErr.message}`);
        }
      }
    } else {
      dataStore.addMonitoringLog({
        type: 'CHECK',
        message: `Monitoring cycle complete — no issues detected (${sapConfigured ? 'SAP CPI Live' : 'Simulation'})`,
        status: 'OK'
      });

      broadcastEvent('monitoring_status', {
        status: 'OK',
        mode: sapConfigured ? 'LIVE' : 'SIMULATION',
        message: 'All systems operational',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    logger.error(`[Monitor] Cycle error: ${err.message}`);
    dataStore.addMonitoringLog({
      type: 'ERROR',
      message: `Monitoring cycle error: ${err.message}`,
      status: 'ERROR'
    });
  }
}

function initializeMonitoring() {
  const intervalSeconds = parseInt(process.env.MONITORING_INTERVAL_SECONDS) || 60;
  logger.info(`[Monitor] Initializing — interval: ${intervalSeconds}s, SAP: ${isSAPConfigured() ? 'LIVE' : 'SIMULATION'}`);
  monitoringActive = true;

  setTimeout(runMonitoringCycle, 5000);
  monitoringJob = cron.schedule(`*/${intervalSeconds} * * * * *`, runMonitoringCycle);
  logger.info('[Monitor] Monitoring service started');
}

function stopMonitoring() {
  monitoringActive = false;
  if (monitoringJob) { monitoringJob.stop(); monitoringJob = null; }
  logger.info('[Monitor] Monitoring service stopped');
}

function getMonitoringStatus() {
  return {
    active: monitoringActive,
    mode: isSAPConfigured() ? 'LIVE' : 'SIMULATION',
    sapConfigured: isSAPConfigured(),
    intervalSeconds: parseInt(process.env.MONITORING_INTERVAL_SECONDS) || 60,
    lastChecked: new Date().toISOString()
  };
}

module.exports = {
  initializeMonitoring,
  stopMonitoring,
  getMonitoringStatus,
  runMonitoringCycle,
  isSAPConfigured
};
