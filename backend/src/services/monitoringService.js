const cron = require('node-cron');
const logger = require('../utils/logger');
const dataStore = require('../utils/dataStore');
const { broadcastEvent } = require('./websocketService');

function firstNonEmpty(...values) {
  return values.find(v => v !== undefined && v !== null && `${v}`.toString().trim() !== '') || null;
}

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
    const newFailure = failed.find(msg => {
      // Skip if same MessageGuid already ticketed
      const guidMatch = existingTickets.some(t => t.sapMessageGuid === msg.MessageGuid);
      if (guidMatch) return false;

      // Skip if same iFlow + Package + error within last 60 minutes
      const cutoff = Date.now() - 60 * 60 * 1000;
      const duplicateMatch = existingTickets.some(t =>
        t.iflow === msg.IntegrationFlowName &&
        t.packageId === msg.IntegrationArtifact?.PackageId &&
        t.status !== 'RESOLVED' &&
        new Date(t.createdAt).getTime() > cutoff
      );
      if (duplicateMatch) return false;

      return true;
    });

    if (!newFailure) return null;

    // Enrich with full error info
    const errorInfo = await getMessageErrorInfo(newFailure.MessageGuid);
    const runs = await getMessageRuns(newFailure.MessageGuid);
    const lastRun = runs[runs.length - 1] || {};
    const protocol = firstNonEmpty(
      lastRun.TransportProtocol,
      lastRun.Protocol,
      lastRun.AdapterType,
      lastRun.Channel,
      lastRun.Transport,
      lastRun.ProtocolType,
      lastRun.TransportType
    ) || 'N/A';

    const sender = firstNonEmpty(
      newFailure.Sender,
      newFailure.SenderParty,
      newFailure.SenderService,
      newFailure.SenderName,
      lastRun.Sender,
      lastRun.SenderParty,
      lastRun.SenderService,
      lastRun.SenderName,
      newFailure.SourceSystem,
      newFailure.SenderAddress,
      lastRun.SourceSystem
    );

    const receiver = firstNonEmpty(
      newFailure.Receiver,
      newFailure.ReceiverParty,
      newFailure.ReceiverService,
      newFailure.ReceiverName,
      lastRun.Receiver,
      lastRun.ReceiverParty,
      lastRun.ReceiverService,
      lastRun.ReceiverName,
      newFailure.TargetSystem,
      newFailure.ReceiverAddress,
      lastRun.TargetSystem
    );

    const adapterDetails = firstNonEmpty(
      [lastRun.AdapterName, lastRun.AdapterType, lastRun.Channel, lastRun.Transport, lastRun.Protocol].filter(Boolean).join(' | '),
      lastRun.AdapterName,
      lastRun.AdapterType,
      lastRun.Channel,
      lastRun.Transport,
      newFailure.AdapterName,
      newFailure.AdapterType,
      sender,
      receiver
    ) || 'N/A';

    let packageName = firstNonEmpty(
      newFailure.IntegrationFlowPackageName,
      newFailure.PackageName,
      newFailure.IntegrationFlowPackageId,
      newFailure.PackageId,
      lastRun.IntegrationFlowPackageName,
      lastRun.PackageName,
      lastRun.IntegrationFlowPackageId,
      lastRun.PackageId
    );
    let packageId = firstNonEmpty(
      newFailure.IntegrationFlowPackageId,
      newFailure.PackageId,
      newFailure.PackageUUID,
      newFailure.PackageId,
      lastRun.IntegrationFlowPackageId,
      lastRun.PackageId,
      lastRun.PackageUUID,
      lastRun.Id
    );
    let iflowName = firstNonEmpty(
      newFailure.IntegrationFlowName,
      newFailure.IntegrationFlowId,
      newFailure.Name,
      newFailure.ArtifactName,
      lastRun.IntegrationFlowName,
      lastRun.Name,
      lastRun.ArtifactName
    );
    let iflowId = firstNonEmpty(
      newFailure.IntegrationFlowId,
      newFailure.IntegrationFlowName,
      newFailure.ArtifactId,
      newFailure.Id,
      lastRun.IntegrationFlowId,
      lastRun.ArtifactId,
      lastRun.Id
    );

    if ((!packageName || !packageId || !iflowId) && (newFailure.IntegrationFlowName || newFailure.IntegrationFlowId || newFailure.ArtifactId || newFailure.Id)) {
      try {
        const { getIntegrationFlows } = require('./sapCpiService');
        const integrationFlows = await getIntegrationFlows();
        const matchedFlow = integrationFlows.find(flow =>
          flow.Name === newFailure.IntegrationFlowName ||
          flow.IntegrationFlowName === newFailure.IntegrationFlowName ||
          flow.ArtifactId === newFailure.IntegrationFlowId ||
          flow.Id === newFailure.IntegrationFlowId ||
          flow.Name === newFailure.IntegrationFlowId ||
          flow.IntegrationFlowId === newFailure.IntegrationFlowId ||
          flow.Id === newFailure.ArtifactId ||
          flow.ArtifactId === newFailure.ArtifactId ||
          flow.Name === newFailure.ArtifactId ||
          flow.IntegrationFlowName === newFailure.ArtifactId
        );

        if (matchedFlow) {
          packageName = packageName || matchedFlow.IntegrationFlowPackageName || matchedFlow.PackageName || matchedFlow.Package || matchedFlow.PackageId;
          packageId = packageId || matchedFlow.IntegrationFlowPackageId || matchedFlow.PackageId || matchedFlow.PackageUUID || matchedFlow.Id;
          iflowName = iflowName || matchedFlow.IntegrationFlowName || matchedFlow.Name;
          iflowId = iflowId || matchedFlow.IntegrationFlowId || matchedFlow.ArtifactId || matchedFlow.Id;
        }
      } catch (flowErr) {
        logger.warn(`[Monitor] Could not enrich iflow/package metadata: ${flowErr.message}`);
      }
    }

    const errorCode = mapSAPErrorToCode({
      ErrorInformation: errorInfo,
      AdapterName: lastRun.AdapterName || newFailure.Sender || ''
    });

    return {
  errorCode,
  interface: newFailure.IntegrationArtifact?.Name || 'SAP CPI',
  iflow: newFailure.IntegrationFlowName,
  iflowId: newFailure.IntegrationArtifact?.Id,
  packageId: newFailure.IntegrationArtifact?.PackageId,
  packageName: newFailure.IntegrationArtifact?.PackageName,
  sender: newFailure.Sender,
  receiver: newFailure.Receiver,
  correlationId: newFailure.CorrelationId,
  transactionId: newFailure.TransactionId,
  logLevel: newFailure.LogLevel,
  monitorUrl: newFailure.AlternateWebLink,
  errorMessage: errorInfo || 'Message processing failed',
  sapMessageGuid: newFailure.MessageGuid,
  errorTimestamp: new Date(parseInt(newFailure.LogEnd?.match(/\d+/)?.[0] || Date.now())).toISOString(),
  payload: {
    messageGuid: newFailure.MessageGuid,
    correlationId: newFailure.CorrelationId,
    transactionId: newFailure.TransactionId,
    packageId: newFailure.IntegrationArtifact?.PackageId,
    packageName: newFailure.IntegrationArtifact?.PackageName,
    iflowId: newFailure.IntegrationArtifact?.Id,
    sender: newFailure.Sender,
    receiver: newFailure.Receiver,
    logStart: new Date(parseInt(newFailure.LogStart?.match(/\d+/)?.[0] || Date.now())).toISOString(),
    logEnd: new Date(parseInt(newFailure.LogEnd?.match(/\d+/)?.[0] || Date.now())).toISOString(),
    logLevel: newFailure.LogLevel,
    adapterName: lastRun?.AdapterName,
    monitorUrl: newFailure.AlternateWebLink
  },
  timestamp: new Date().toISOString()
};
  } catch (err) {
    logger.error(`[Monitor] SAP CPI message log check failed: ${err.message}`);
    dataStore.addMonitoringLog({
      type: 'ERROR',
      message: `SAP CPI API access failed: ${err.message}`,
      status: 'ERROR'
    });

    broadcastEvent('monitoring_status', {
      status: 'ERROR',
      mode: 'LIVE',
      message: `SAP CPI API access failed: ${err.message}`,
      timestamp: new Date().toISOString()
    });

    // Do not create a false CPI iFlow ticket when the SAP CPI API itself is inaccessible.
    return null;
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
