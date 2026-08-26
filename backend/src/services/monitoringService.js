const SERVER_START_TIME = new Date();
const cron = require('node-cron');
const logger = require('../utils/logger');
const dataStore = require('../utils/dataStore');
const { broadcastEvent } = require('./websocketService');
const { normalizeFingerprint, createIssueFingerprint, createMessageFingerprint } = require('../utils/fingerprint');
const tenantStore = require('../utils/tenantStore');
const userStore = require('../utils/userStore');
const requestContext = require('../utils/requestContext');

function firstNonEmpty(...values) {
  return values.find(v => v !== undefined && v !== null && `${v}`.toString().trim() !== '') || null;
}

let monitoringActive = false;
let monitoringJob = null;

function isSAPConfigured(userId) {
  const creds = tenantStore.getActiveTenantCredentials(userId);
  return !!(creds && creds.baseUrl && creds.clientId && creds.clientSecret && creds.tokenUrl);
}

// ─── REAL: Check SAP CPI Failed Message Logs ──────────────────────────────────
async function checkMessageProcessingLogs(userId) {
  if (!isSAPConfigured(userId)) return simulateFallback('message_logs');

  try {
    const { getFailedMessages, getMessageErrorInfo, getMessageRuns, mapSAPErrorToCode } = require('./sapCpiService');
    const failed = await getFailedMessages(10);

    if (failed.length === 0) return null;

    const recentFailed = failed.filter(msg => {
      const logEndMs = parseInt(msg.LogEnd?.match(/\d+/)?.[0] || 0);
      return logEndMs && new Date(logEndMs) > SERVER_START_TIME;
    });

    if (recentFailed.length === 0) return null;

    const existingTickets = dataStore.getTickets(userId);
    const newFailure = recentFailed.find(msg => {
      const failureFingerprint = createIssueFingerprint({
        iflow: msg.IntegrationFlowName || msg.IntegrationFlowId || msg.ArtifactName,
        packageId: msg.IntegrationArtifact?.PackageId || msg.PackageId || msg.IntegrationFlowPackageId || msg.PackageUUID,
        packageName: msg.IntegrationFlowPackageName || msg.PackageName,
        errorCode: mapSAPErrorToCode({
          ErrorInformation: msg.ErrorInformation || msg.MessageText || '',
          AdapterName: msg.AdapterName || ''
        }),
        errorMessage: msg.ErrorInformation || msg.MessageText || ''
      });

      const duplicateMatch = existingTickets.some(t => {
        const ticketFingerprint = t.issueFingerprint
          ? normalizeFingerprint(t.issueFingerprint)
          : createIssueFingerprint({
            iflow: t.iflow || t.interface,
            packageId: t.packageId,
            packageName: t.packageName,
            errorCode: t.errorCode,
            errorId: t.errorId,
            errorMessage: t.errorMessage
          });
        return ticketFingerprint && ticketFingerprint === failureFingerprint;
      });
      if (duplicateMatch) return false;
      return true;
    });

    if (!newFailure) return null;

    const errorInfo = await getMessageErrorInfo(newFailure.MessageGuid);
    const runs = await getMessageRuns(newFailure.MessageGuid);
    const lastRun = runs[runs.length - 1] || {};

    const protocolValue = firstNonEmpty(
      lastRun.Protocol, newFailure.Protocol, lastRun.Transport, newFailure.Transport,
      lastRun.AdapterType, lastRun.AdapterName, 'N/A'
    );

    const sender = firstNonEmpty(
      newFailure.Sender, newFailure.SenderParty, newFailure.SenderService, newFailure.SenderName,
      lastRun.Sender, lastRun.SenderParty, lastRun.SenderService, lastRun.SenderName,
      newFailure.SourceSystem, newFailure.SenderAddress, lastRun.SourceSystem
    );

    const receiver = firstNonEmpty(
      newFailure.Receiver, newFailure.ReceiverParty, newFailure.ReceiverService, newFailure.ReceiverName,
      lastRun.Receiver, lastRun.ReceiverParty, lastRun.ReceiverService, lastRun.ReceiverName,
      newFailure.TargetSystem, newFailure.ReceiverAddress, lastRun.TargetSystem
    );

    const adapterDetails = firstNonEmpty(
      [lastRun.AdapterName, lastRun.AdapterType, lastRun.Channel, lastRun.Transport, lastRun.Protocol].filter(Boolean).join(' | '),
      lastRun.AdapterName, lastRun.AdapterType, lastRun.Channel, lastRun.Transport,
      newFailure.AdapterName, newFailure.AdapterType, sender, receiver
    ) || 'N/A';

    let packageName = firstNonEmpty(
      newFailure.IntegrationFlowPackageName, newFailure.PackageName, newFailure.IntegrationFlowPackageId, newFailure.PackageId,
      lastRun.IntegrationFlowPackageName, lastRun.PackageName, lastRun.IntegrationFlowPackageId, lastRun.PackageId
    );
    let packageId = firstNonEmpty(
      newFailure.IntegrationFlowPackageId, newFailure.PackageId, newFailure.PackageUUID, newFailure.PackageId,
      lastRun.IntegrationFlowPackageId, lastRun.PackageId, lastRun.PackageUUID, lastRun.Id
    );
    let iflowName = firstNonEmpty(
      newFailure.IntegrationFlowName, newFailure.IntegrationFlowId, newFailure.Name, newFailure.ArtifactName,
      lastRun.IntegrationFlowName, lastRun.Name, lastRun.ArtifactName
    );
    let iflowId = firstNonEmpty(
      newFailure.IntegrationFlowId, newFailure.IntegrationFlowName, newFailure.ArtifactId, newFailure.Id,
      lastRun.IntegrationFlowId, lastRun.ArtifactId, lastRun.Id
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
      interface: newFailure.IntegrationArtifact?.Name || iflowName || 'SAP CPI',
      iflow: iflowName || newFailure.IntegrationFlowName,
      iflowId: iflowId || newFailure.IntegrationArtifact?.Id,
      packageId: packageId || newFailure.IntegrationArtifact?.PackageId,
      packageName: packageName || newFailure.IntegrationArtifact?.PackageName,
      sender: sender || newFailure.Sender,
      receiver: receiver || newFailure.Receiver,
      adapterDetails,
      protocol: protocolValue,
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
    dataStore.addMonitoringLog(userId, {
      type: 'ERROR',
      message: `SAP CPI API access failed: ${err.message}`,
      status: 'ERROR'
    });
    broadcastEvent('monitoring_status', {
      status: 'ERROR', mode: 'LIVE',
      message: `SAP CPI API access failed: ${err.message}`,
      timestamp: new Date().toISOString()
    }, userId);
    return null;
  }
}

// ─── REAL: Check JMS Queue Buildup ───────────────────────────────────────────
async function checkJMSQueues(userId) {
  if (!isSAPConfigured(userId)) return null;
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
    logger.debug(`[Monitor] JMS not available on this tenant`);
    return null;
  }
}

// ─── REAL: Check Certificate Expiry ──────────────────────────────────────────
async function checkCertificates(userId) {
  if (!isSAPConfigured(userId)) return null;
  try {
    const { getCertificates } = require('./sapCpiService');
    const certs = await getCertificates();
    const warningDays = parseInt(process.env.CERT_EXPIRY_WARNING_DAYS || 30);
    const now = Date.now();

    for (const cert of certs) {
      if (!cert.ValidNotAfter) continue;
      let expiry;
      const match = cert.ValidNotAfter.match(/\/Date\((\d+)\)\//);
      expiry = match ? parseInt(match[1]) : new Date(cert.ValidNotAfter).getTime();
      const daysLeft = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysLeft <= warningDays && daysLeft >= 0) {
        const existing = dataStore.getTickets(userId).find(t => t.certName === cert.Hexalias);
        if (existing) continue;

        return {
          errorCode: 'CERT_EXPIRY_WARNING',
          interface: 'SAP CPI Keystore',
          iflow: 'Certificate Monitor',
          certName: cert.Hexalias,
          daysUntilExpiry: daysLeft,
          errorMessage: `Certificate "${cert.Hexalias}" expiring in ${daysLeft} days (${new Date(expiry).toDateString()})`,
          payload: { alias: cert.Hexalias, type: cert.KeyType, validFrom: cert.ValidNotBefore, validUntil: cert.ValidNotAfter, daysLeft }
        };
      }
    }
    return null;
  } catch (err) {
    logger.debug(`[Monitor] Certificate API not available on this tenant`);
    return null;
  }
}

// ─── REAL: Check iFlow Runtime Status ────────────────────────────────────────
async function checkIFlowStatus(userId) {
  if (!isSAPConfigured(userId)) return null;
  try {
    const { getIntegrationFlows } = require('./sapCpiService');
    const iflows = await getIntegrationFlows();
    const errored = iflows.find(f => f.Status === 'ERROR' || f.Status === 'FAILED');
    if (!errored) return null;

    const existing = dataStore.getTickets(userId).find(t => t.iflow === errored.Name && t.errorCode === 'HTTP_500');
    if (existing) return null;

    return {
      errorCode: 'HTTP_500',
      interface: errored.Name || 'Unknown',
      iflow: errored.Name,
      errorMessage: `iFlow "${errored.Name}" is in ${errored.Status} state`,
      payload: { id: errored.Id, version: errored.Version, status: errored.Status, deployedBy: errored.DeployedBy, deployedOn: errored.DeployedOn }
    };
  } catch (err) {
    logger.warn(`[Monitor] iFlow status check failed: ${err.message}`);
    return null;
  }
}

// ─── FALLBACK: Simulate when a user has no tenant connected ─────────────────
function simulateFallback() {
  const rand = Math.random();
  if (rand > 0.12) return null;
  const scenarios = [
    { errorCode: 'HTTP_401', interface: 'Salesforce', iflow: 'SF_Order_Sync_v2', errorMessage: 'HTTP 401 Unauthorized - OAuth token expired' },
    { errorCode: 'MAPPING_EXCEPTION', interface: 'SAP ECC', iflow: 'ECC_Customer_Sync', errorMessage: 'NullPointerException: Field CustomerID is null', failedField: 'CustomerID' },
    { errorCode: 'HTTP_503', interface: 'Banking API', iflow: 'Banking_Payment_Gateway', errorMessage: 'Service Unavailable - upstream at capacity' }
  ];
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

// ─── Per-user cycle ────────────────────────────────────────────────────────
async function runUserMonitoringCycle(userId, creds) {
  const mode = creds ? 'LIVE' : 'SIMULATION';
  logger.info(`[Monitor] Cycle for user ${userId} (${creds ? `tenant: ${creds.name}` : 'no tenant connected — simulation'})`);

  dataStore.addMonitoringLog(userId, {
    type: 'CHECK',
    message: `Running monitoring cycle (mode: ${mode})`,
    status: 'RUNNING'
  });

  broadcastEvent('monitoring_status', {
    status: 'CHECKING', mode,
    message: `Scanning ${creds ? 'SAP CPI' : 'simulated'} integrations...`,
    timestamp: new Date().toISOString()
  }, userId);

  try {
    const msgIssue = await checkMessageProcessingLogs(userId);
    const jmsIssue = await checkJMSQueues(userId);
    const certIssue = await checkCertificates(userId);
    const iflowIssue = await checkIFlowStatus(userId);

    const rawIssues = [msgIssue, jmsIssue, certIssue, iflowIssue].filter(Boolean);
    const issues = [];
    const seenFingerprints = new Set();
    const seenMessageIds = new Set();

    for (const issue of rawIssues) {
      const issueFp = createIssueFingerprint(issue);
      const messageFp = createMessageFingerprint({ sapMessageGuid: issue.sapMessageGuid });
      if (messageFp && seenMessageIds.has(messageFp)) continue;
      if (issueFp && seenFingerprints.has(issueFp)) continue;
      if (messageFp) seenMessageIds.add(messageFp);
      if (issueFp) seenFingerprints.add(issueFp);
      issues.push(issue);
    }

    if (issues.length > 0) {
      logger.info(`[Monitor] Found ${issues.length} issue(s) for user ${userId}`);

      for (const issue of issues) {
        let result;
        try {
          const { processIncident } = require('../agents/cpiAgent');
          result = await processIncident({ ...issue, timestamp: new Date().toISOString() }, userId);
        } catch (agentErr) {
          logger.error(`[Monitor] Agent processing failed: ${agentErr.message}`);
          continue;
        }

        if (!result || !result.ticket) continue;

        const alert = dataStore.addAlert(userId, {
          type: issue.errorCode,
          severity: ['HTTP_503', 'QUEUE_THRESHOLD_EXCEEDED'].includes(issue.errorCode) ? 'CRITICAL' : 'HIGH',
          message: issue.errorMessage
        });

        dataStore.addMonitoringLog(userId, {
          type: 'ALERT',
          message: `Issue detected: ${issue.errorCode} in ${issue.interface}`,
          status: 'ALERT_CREATED'
        });

        broadcastEvent('new_alert', {
          alert, issue,
          message: `🚨 ${issue.errorCode}: ${issue.errorMessage}`,
          timestamp: new Date().toISOString()
        }, userId);
      }
    } else {
      dataStore.addMonitoringLog(userId, {
        type: 'CHECK',
        message: `Monitoring cycle complete — no issues detected (${mode})`,
        status: 'OK'
      });
      broadcastEvent('monitoring_status', {
        status: 'OK', mode,
        message: 'All systems operational',
        timestamp: new Date().toISOString()
      }, userId);
    }
  } catch (err) {
    logger.error(`[Monitor] Cycle error for user ${userId}: ${err.message}`);
    dataStore.addMonitoringLog(userId, {
      type: 'ERROR',
      message: `Monitoring cycle error: ${err.message}`,
      status: 'ERROR'
    });
  }
}

// ─── Main entry point ──────────────────────────────────────────────────────
// targetUserId omitted -> loop every user (used by the cron job).
// targetUserId provided -> run just that one user (used by "trigger scan" from the UI).
async function runMonitoringCycle(targetUserId) {
  if (!monitoringActive && !targetUserId) return; // cron respects the active flag; manual triggers don't

  const users = targetUserId
    ? [{ id: targetUserId }]
    : userStore.getAll();

  for (const user of users) {
    const creds = tenantStore.getActiveTenantCredentials(user.id);
    if (creds) {
      await requestContext.run({ userId: user.id, creds }, () => runUserMonitoringCycle(user.id, creds));
    } else {
      await runUserMonitoringCycle(user.id, null);
    }
  }
}

function initializeMonitoring() {
  const intervalSeconds = parseInt(process.env.MONITORING_INTERVAL_SECONDS) || 60;
  logger.info(`[Monitor] Initializing — interval: ${intervalSeconds}s`);
  monitoringActive = true;

  setTimeout(() => runMonitoringCycle(), 5000);
  monitoringJob = cron.schedule(`*/${intervalSeconds} * * * * *`, () => runMonitoringCycle());
  logger.info('[Monitor] Monitoring service started');
}

function stopMonitoring() {
  monitoringActive = false;
  if (monitoringJob) { monitoringJob.stop(); monitoringJob = null; }
  logger.info('[Monitor] Monitoring service stopped');
}

function getMonitoringStatus(userId) {
  return {
    active: monitoringActive,
    mode: isSAPConfigured(userId) ? 'LIVE' : 'SIMULATION',
    sapConfigured: isSAPConfigured(userId),
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